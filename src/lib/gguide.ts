/**
 * G-Guide (bangumi.org) scraper for JP EPG data.
 *
 * Scrapes the official 番組表.Gガイド website for rich program data
 * including thumbnails, cast/talent info, and proper genre categories.
 *
 * Endpoints used:
 *   EPG grid:  https://bangumi.org/epg/td?broad=dt&area={area}&ggdate=today&ggtime=now
 *              https://bangumi.org/epg/bs?ggdate=today&ggtime=now
 *              https://bangumi.org/epg/cs?ggdate=today&ggtime=now
 *   Detail:    https://bangumi.org/tv_events/{eventId}?overwrite_area={area}
 */

import * as cheerio from "cheerio";
import { redis } from "./db.ts";
import { env } from "../env.ts";
import { logger } from "./logger.ts";

// ── Configuration ────────────────────────────────────────────
const GGUIDE_BASE = "https://bangumi.org";
const DEFAULT_AREA = "23"; // Tokyo
const GGUIDE_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** How long (seconds) to cache the EPG grid scrape in Redis */
const GRID_CACHE_TTL = 30 * 60; // 30 minutes
/** How long (seconds) to cache program detail pages in Redis */
const DETAIL_CACHE_TTL = 24 * 60 * 60; // 24 hours

// ── Types ────────────────────────────────────────────────────
export interface GGuideChannel {
    /** Column index on the grid (1-based) */
    lineIndex: number;
    /** Channel number (e.g. "1", "4", "161") */
    number: string;
    /** Display name (e.g. "NHK総合") */
    name: string;
    /** Full name (untruncated) – resolved later from detail pages */
    fullName: string | null;
    /** Broadcast type: dt (terrestrial), bs, cs */
    broad: "dt" | "bs" | "cs";
    /** Stable ID we generate: gguide-{broad}-{number} */
    id: string;
    /** Logo URL if discovered */
    logo: string | null;
}

export interface GGuideProgram {
    /** Our channel id: gguide-{broad}-{number} */
    channelId: string;
    /** Start time as epoch seconds */
    startUtc: number;
    /** End time as epoch seconds */
    endUtc: number;
    /** JST formatted "YYYY-MM-DD HH:mm:ss" */
    startJst: string;
    endJst: string;
    /** Program title */
    title: string;
    /** Short description from grid */
    description: string | null;
    /** Genre CSS class → mapped to genre name */
    genre: string | null;
    /** Genre class from grid (gc-anime, gc-drama, etc.) */
    genreClass: string | null;
    /** bangumi.org event ID (for detail page) */
    eventId: string | null;
    /** contentsId from data-content JSON */
    contentsId: number | null;
    /** programId (season-level) */
    programId: string | null;
    /** Stable listing ID */
    listingId: string;
    /** Title contains [新] or [初] marker (new/premiere) */
    isNew: boolean;
}

export interface GGuideProgramDetail {
    /** Program thumbnail URL */
    image: string | null;
    /** Proper genre text (e.g. "ニュース／報道") */
    genre: string | null;
    /** Season/series title */
    masterTitle: string | null;
    /** Full description */
    description: string | null;
    /** Full letter body (longer description) */
    letterBody: string | null;
    /** Channel + time text (e.g. "3月5日 木曜 21:00 -22:00 NHK総合1・東京") */
    scheduleText: string | null;
    /** Cast list */
    cast: GGuideCastMember[];
    /** Season ID for grouping */
    seasonId: string | null;
}

export interface GGuideCastMember {
    name: string;
    talentId: string | null;
    role: string | null;
    image: string | null;
}

export interface GGuideTalentDetail {
    name: string;
    image: string | null;
    /** Upcoming programs this talent appears in */
    programs: {
        title: string;
        channelName: string | null;
        scheduleText: string | null;
        eventId: string | null;
        genre: string | null;
        image: string | null;
    }[];
}

// ── Genre map from CSS classes ───────────────────────────────
const GENRE_CLASS_MAP: Record<string, string | null> = {
    "gc-anime": "アニメ",
    "gc-drama": "ドラマ",
    "gc-sports": "スポーツ",
    "gc-movie": "映画",
    "gc-music": "音楽",
    "gc-variety": "バラエティ",
    "gc-news": "ニュース",
    "gc-documentary": "ドキュメンタリー",
    "gc-hobby": "趣味",
    "gc-education": "教育",
    "gc-theater": "演劇",
    "gc-welfare": "福祉",
    "no_genre": null,
};

// ── Date/time helpers ────────────────────────────────────────

/**
 * Year-offset compensation.
 *
 * The system clock may be set to a different year (e.g. 2026) while
 * bangumi.org returns real-world dates (e.g. 2025).  We detect this
 * on the first grid scrape and shift all programme timestamps to
 * match the system clock so the Wii U's time window queries work.
 */
let dateOffsetSeconds: number | null = null;
let dateOffsetSetAt = 0;
const DATE_OFFSET_MAX_AGE = 6 * 60 * 60 * 1000; // recalculate every 6 hours

/** Called once with the raw date from the first programme to compute the shift. */
function ensureDateOffset(realYYYYMMDD: string): void {
    if (dateOffsetSeconds !== null && Date.now() - dateOffsetSetAt < DATE_OFFSET_MAX_AGE) return;
    if (!/^\d{8}$/.test(realYYYYMMDD)) {
        logger.warn("G-Guide: invalid date format for offset: %s", realYYYYMMDD);
        dateOffsetSeconds = 0;
        return;
    }
    const realYear = parseInt(realYYYYMMDD.slice(0, 4), 10);
    const systemYear = parseInt(todayJstStr().slice(0, 4), 10);

    if (realYear === systemYear) {
        dateOffsetSeconds = 0;
        return;
    }

    // Compute offset from actual full dates (handles year boundary correctly)
    const realMd = realYYYYMMDD.slice(4); // MMDD
    const sysTodayStr = todayJstStr(); // YYYYMMDD
    const realEpoch =
        new Date(`${realYear}-${realMd.slice(0, 2)}-${realMd.slice(2, 4)}T00:00:00+09:00`).getTime() / 1000;
    const sysEpoch =
        new Date(`${sysTodayStr.slice(0, 4)}-${sysTodayStr.slice(4, 6)}-${sysTodayStr.slice(6, 8)}T00:00:00+09:00`).getTime() / 1000;

    if (isNaN(realEpoch) || isNaN(sysEpoch)) {
        logger.warn("G-Guide: NaN in date offset calculation, defaulting to 0");
        dateOffsetSeconds = 0;
        return;
    }
    dateOffsetSeconds = sysEpoch - realEpoch;
    dateOffsetSetAt = Date.now();
    logger.info(
        "G-Guide: date offset = %d s  (real year %d → system year %d)",
        dateOffsetSeconds,
        realYear,
        systemYear,
    );
}

/** Return the real-world JST today string (YYYYMMDD) for bangumi.org URLs. */
function realTodayJst(): string {
    if (dateOffsetSeconds !== null && dateOffsetSeconds !== 0) {
        // Subtract the offset to get the real-world "now"
        const realNow = new Date(Date.now() - dateOffsetSeconds * 1000);
        const parts = new Intl.DateTimeFormat("sv-SE", {
            timeZone: "Asia/Tokyo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(realNow);
        const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
        return `${get("year")}${get("month")}${get("day")}`;
    }
    return todayJstStr();          // no offset known yet; fall back to system date
}

/**
 * Parse bangumi.org time format "202503050500" → epoch seconds (JST input),
 * shifted to the system clock's year so the Wii U's queries match.
 * Format: YYYYMMDDHHmm (12 chars) or YYYYMMDDHHmmss (14 chars)
 */
function parseGGuideTime(raw: string): number {
    if (!raw || raw.length < 12) return 0;
    const yyyy = raw.slice(0, 4);
    const MM = raw.slice(4, 6);
    const dd = raw.slice(6, 8);
    const hh = raw.slice(8, 10);
    const mm = raw.slice(10, 12);
    const ss = raw.length >= 14 ? raw.slice(12, 14) : "00";
    // These are JST times
    const iso = `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}+09:00`;
    const epoch = Math.floor(new Date(iso).getTime() / 1000);
    if (isNaN(epoch)) return 0;

    // Shift to match system clock year
    return epoch + (dateOffsetSeconds ?? 0);
}

/** epoch seconds → JST "YYYY-MM-DD HH:mm:ss" */
function epochToJst(epoch: number): string {
    const d = new Date(epoch * 1000);
    const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Formatted date for URL: "today", "20260305", etc. */
function todayJstStr(): string {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}${get("month")}${get("day")}`;
}

// ── HTTP fetch helper ────────────────────────────────────────
async function gFetch(url: string, retries = 2): Promise<string> {
    for (let i = 0; i <= retries; i++) {
        try {
            const resp = await fetch(url, {
                headers: {
                    "User-Agent": GGUIDE_USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "ja,en;q=0.5",
                    "Accept-Encoding": "gzip, deflate, br",
                },
                redirect: "follow",
                signal: AbortSignal.timeout(30_000), // Increased to 30s for large CS grids
            });
            if (!resp.ok) {
                throw new Error(`G-Guide fetch ${url} → ${resp.status}`);
            }
            return await resp.text();
        } catch (err: any) {
            if (i === retries) {
                throw err;
            }
            const delay = 1000 * Math.pow(2, i);
            logger.warn("G-Guide: fetch failed for %s, retrying in %dms... (%s)", url, delay, err.message);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error("Unreachable");
}

// ── Grid scraper ─────────────────────────────────────────────

/** Build the URL for an EPG grid page */
function gridUrl(broad: "dt" | "bs" | "cs", area: string, ggdate: string = "today"): string {
    const baseUrl = broad === "dt" ? `${GGUIDE_BASE}/epg/td` : `${GGUIDE_BASE}/epg/${broad}`;
    const params = new URLSearchParams({
        broad,
        ggdate,
        ggtime: "now",
    });
    if (broad === "dt") {
        params.set("area", area);
    }
    return `${baseUrl}?${params.toString()}`;
}

interface GridScrapeResult {
    channels: GGuideChannel[];
    programs: GGuideProgram[];
}

/**
 * Scrape a single EPG grid page and extract channels + programs.
 */
function parseGrid(html: string, broad: "dt" | "bs" | "cs"): GridScrapeResult {
    const $ = cheerio.load(html);
    const channels: GGuideChannel[] = [];
    const programs: GGuideProgram[] = [];

    // ── Extract channel headers ──
    // Channel columns: <li class="js_channel topmost"><p>1 NHK総合1..</p></li>
    const chHeaders: string[] = [];
    $("#ch_area li.js_channel.topmost").each((_, el) => {
        const text = $(el).find("p").text().trim();
        chHeaders.push(text);
    });

    // Build channel objects from headers
    for (let i = 0; i < chHeaders.length; i++) {
        const raw = chHeaders[i]!;
        if (!raw.trim()) continue;
        // Format: "1 NHK総合1.." or "161 QVC" — number then name
        const m = raw.match(/^(\d+)\s+(.+)$/);
        const number = m ? m[1]! : String(i + 1);
        let name = m ? m[2]! : raw;
        // Remove trailing dots (truncation indicator)
        name = name.replace(/\.{2,}$/, "").trim();
        // Remove trailing "1" that indicates sub-channel (e.g. "TBS1" → "TBS")
        // But keep it if the channel is entirely numeric+letter like "BS11"
        const cleanName = name.replace(/(\D)1$/, "$1").trim();

        const id = `gguide-${broad}-${number}`;
        channels.push({
            lineIndex: i + 1,
            number,
            name: cleanName || name,
            fullName: null,
            broad,
            id,
            logo: null,
        });
    }

    // ── Extract programs from each column ──
    // Each column: <ul id="program_line_N"> with <li s="..." e="..." pid="..." se-id="...">
    for (let colIdx = 0; colIdx < channels.length; colIdx++) {
        const channel = channels[colIdx]!;
        const lineId = `program_line_${colIdx + 1}`;
        const column = $(`#${lineId}`);

        column.find("li[s][e]").each((_, el) => {
            const $li = $(el);
            const startRaw = $li.attr("s") ?? "";
            const endRaw = $li.attr("e") ?? "";

            // On the very first programme we see, detect real-world
            // vs system-clock year offset so timestamps are shifted.
            if (startRaw.length >= 8) ensureDateOffset(startRaw.slice(0, 8));

            const startUtc = parseGGuideTime(startRaw);
            const endUtc = parseGGuideTime(endRaw);
            if (!startUtc || !endUtc) return;

            // Title — detect JP broadcast markers then strip them
            const rawTitle = $li.find(".program_title").text().trim() || "不明";
            const isNew = /[\[【]新[\]】]/.test(rawTitle) || /[\[【]初[\]】]/.test(rawTitle);
            const title = rawTitle.replace(/[\[【][新初再終字二デ多SS解無双映Ｎ前後][\]】]/g, "").trim();

            // Description (short, from grid)
            const desc = $li.find(".program_detail").text().trim() || null;

            // Genre from program_time class (e.g. "program_time gc-anime")
            const timeDiv = $li.find(".program_time");
            const timeClass = timeDiv.attr("class") ?? "";
            let genreClass: string | null = null;
            for (const cls of Object.keys(GENRE_CLASS_MAP)) {
                if (timeClass.includes(cls)) {
                    genreClass = cls;
                    break;
                }
            }
            const genre = genreClass ? GENRE_CLASS_MAP[genreClass] ?? null : null;

            // Event ID from href: /tv_events/{eventId}?overwrite_area=23
            const href = $li.find("a.title_link").attr("href") ?? "";
            const eventMatch = href.match(/\/tv_events\/([^?]+)/);
            const eventId = eventMatch ? eventMatch[1]! : null;

            // data-content JSON for contentsId, programId
            const dataContent = $li.find("a.title_link").attr("data-content") ?? "";
            let contentsId: number | null = null;
            let programId: string | null = null;
            try {
                const dc = JSON.parse(dataContent);
                contentsId = dc.contentsId ?? null;
                programId = dc.programId != null ? String(dc.programId) : null;
            } catch {
                // data-content might have HTML entities; try decoding
                try {
                    const decoded = dataContent
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/&apos;/g, "'")
                        .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
                        .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&amp;/g, "&");
                    const dc = JSON.parse(decoded);
                    contentsId = dc.contentsId ?? null;
                    programId = dc.programId != null ? String(dc.programId) : null;
                } catch {
                    // skip
                }
            }

            const listingId = `gguide-${channel.id}-${startUtc}`;

            programs.push({
                channelId: channel.id,
                startUtc,
                endUtc,
                startJst: epochToJst(startUtc),
                endJst: epochToJst(endUtc),
                title,
                description: desc,
                genre,
                genreClass,
                eventId,
                contentsId,
                programId,
                listingId,
                isNew,
            });
        });
    }

    return { channels, programs };
}

// ── Detail page scraper ──────────────────────────────────────

/**
 * Scrape a program detail page to get rich metadata.
 */
async function scrapeDetail(eventId: string, area: string = DEFAULT_AREA): Promise<GGuideProgramDetail | null> {
    // Validate eventId to prevent path traversal
    if (!/^[\w-]+$/.test(eventId)) return null;

    const cacheKey = `gguide:detail:${eventId}:${area}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch {
            await redis.del(cacheKey);
        }
    }

    try {
        const url = `${GGUIDE_BASE}/tv_events/${eventId}?overwrite_area=${area}`;
        const html = await gFetch(url);
        const $ = cheerio.load(html);

        // Image: <img class="top_img" src="...">
        const image = $("img.top_img").attr("src") || null;

        // Genre: <p class="genre nomal">ニュース／報道</p>
        const genreEl = $("p.genre");
        const genre = genreEl.text().trim() || null;

        // Master title: <h1 class="master_title">ニュースウオッチ9</h1>
        const masterTitle = $("h1.master_title").text().trim() || null;

        // Description: <p class="description"> in the main content
        const description = $("section.detail p.description").first().text().trim() || null;

        // Letter body: <p class="letter_body">
        const letterBody = $("p.letter_body").text().trim() || null;

        // Schedule text: <div class="schedule"><p>3月5日 木曜 21:00 <span>-</span>22:00 NHK総合1・東京</p>
        const scheduleText = $("div.schedule p").text().trim().replace(/\s+/g, " ") || null;

        // Season ID from canonical URL or share links
        let seasonId: string | null = null;
        const canonical = $("link[rel='canonical']").attr("href") ?? "";
        const seasonMatch = canonical.match(/season_id=(\d+)/);
        if (seasonMatch) {
            seasonId = seasonMatch[1]!;
        } else {
            // Try from share links
            $("a[href*='season_id=']").each((_, el) => {
                const h = $(el).attr("href") ?? "";
                const m = h.match(/season_id=(\d+)/);
                if (m) seasonId = m[1]!;
            });
        }

        // Cast from heading section
        const cast: GGuideCastMember[] = [];

        // First: structured cast from the heading "出演者"
        $("h3.heading").each((_, el) => {
            const headingText = $(el).text().trim();
            if (headingText !== "出演者") return;

            // The cast is in the next <p> sibling
            const castP = $(el).parent().find("p").first();
            const castHtml = castP.html() ?? "";

            // Parse talent links: <a href='https://bangumi.org/talents/319237'>広内仁</a>
            // And role prefixes: 【キャスター】
            let currentRole: string | null = null;
            const parts = castHtml.split(/(<a[^>]*>.*?<\/a>|【[^】]+】)/g);
            for (const part of parts) {
                const roleMatch = part.match(/【([^】]+)】/);
                if (roleMatch) {
                    currentRole = roleMatch[1]!;
                    continue;
                }
                const linkMatch = part.match(/href=['"]https?:\/\/bangumi\.org\/talents\/(\d+)['"][^>]*>([^<]+)<\/a>/);
                if (linkMatch) {
                    cast.push({
                        name: linkMatch[2]!.trim(),
                        talentId: linkMatch[1]!,
                        role: currentRole,
                        image: null,
                    });
                }
            }
        });

        // Second: images from talent_panel
        $("ul.talent_panel li").each((_, el) => {
            const $li = $(el);
            const dataContent = $li.find("a.js-logging").attr("data-content") ?? "";
            let talentId: string | null = null;
            let talentName: string | null = null;

            try {
                const dc = JSON.parse(dataContent.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
                talentId = dc.talentId ? String(dc.talentId) : null;
                talentName = dc.name || null;
            } catch { /* skip */ }

            const img = $li.find("img.parts_program_image").attr("src") || null;
            // Don't include the noimage placeholder
            const hasRealImage = img && !img.includes("noimage");

            // Match with existing cast entry to add image
            if (talentId) {
                const existing = cast.find((c) => c.talentId === talentId);
                if (existing && hasRealImage) {
                    existing.image = img;
                } else if (!existing && talentName) {
                    cast.push({
                        name: talentName,
                        talentId,
                        role: null,
                        image: hasRealImage ? img : null,
                    });
                }
            }
        });

        const detail: GGuideProgramDetail = {
            image,
            genre,
            masterTitle,
            description,
            letterBody,
            scheduleText,
            cast,
            seasonId,
        };

        // Cache in Redis
        await redis.set(cacheKey, JSON.stringify(detail), "EX", DETAIL_CACHE_TTL);

        return detail;
    } catch (err: any) {
        logger.error("G-Guide detail scrape failed for %s: %s", eventId, err.message);
        return null;
    }
}

// ── In-memory cache ──────────────────────────────────────────
interface AreaCache {
    channels: Map<string, GGuideChannel>;
    programs: GGuideProgram[];
    lastRefresh: number;
    consecutiveFailures: number;
    refreshPromise: Promise<void> | null;
}

const areaCaches: Map<string, AreaCache> = new Map();
const gridRefreshMs = (env.VINO_JP_GGUIDE_REFRESH_MINUTES ?? 30) * 60 * 1000;

function getAreaCache(area: string): AreaCache {
    let cache = areaCaches.get(area);
    if (!cache) {
        cache = {
            channels: new Map(),
            programs: [],
            lastRefresh: 0,
            consecutiveFailures: 0,
            refreshPromise: null,
        };
        areaCaches.set(area, cache);
    }
    return cache;
}

// ── Grid refresh logic ───────────────────────────────────────

/**
 * Scrape all three grid types (dt, bs, cs) and merge into a single
 * channel list + program list.
 */
async function refreshGrids(area: string): Promise<void> {
    const cache = getAreaCache(area);
    const now = Date.now();
    if (now - cache.lastRefresh < gridRefreshMs && cache.channels.size > 0) return;

    // Prevent concurrent refreshes — reuse in-flight promise
    if (cache.refreshPromise) return cache.refreshPromise;
    cache.refreshPromise = doRefreshGrids(area, now).finally(() => { cache.refreshPromise = null; });
    return cache.refreshPromise;
}

async function doRefreshGrids(area: string, now: number): Promise<void> {
    const cache = getAreaCache(area);
    logger.info("G-Guide: refreshing EPG grids for area %s...", area);

    const broadTypes: ("dt" | "bs" | "cs")[] = ["dt", "bs", "cs"];
    const allChannels: Map<string, GGuideChannel> = new Map();
    let allPrograms: GGuideProgram[] = [];

    /** Fetch one grid page (today or tomorrow) for a broadcast type. */
    async function fetchGridPage(
        broad: "dt" | "bs" | "cs",
        dateStr: string,
        cacheKey: string,
        label: string,
    ): Promise<{ channels: GGuideChannel[]; programs: GGuideProgram[] } | null> {
        let html: string | null = null;
        const cached = await redis.get(cacheKey);
        if (cached) {
            html = cached;
        } else {
            try {
                html = await gFetch(gridUrl(broad, area, dateStr));
                await redis.set(cacheKey, html, "EX", GRID_CACHE_TTL);
            } catch (err: any) {
                if (label.includes("tomorrow")) {
                    logger.warn("G-Guide: tomorrow's %s grid not available: %s", broad, err.message);
                } else {
                    logger.error("G-Guide: failed to fetch %s grid: %s", broad, err.message);
                }
                return null;
            }
        }
        return parseGrid(html, broad);
    }

    // 1. Fetch "today" grids first.
    // We do this to ensure dateOffsetSeconds is set before we calculate tomorrowStr.
    // Constructing tomorrowStr with a 2026 date (system clock) will fail on bangumi.org.
    const todayJobs = broadTypes.map((broad) =>
        fetchGridPage(broad, "today", `gguide:grid:${broad}:${area}:${todayJstStr()}`, `${broad}/today`),
    );
    const todayResults = await Promise.allSettled(todayJobs);

    todayResults.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const val = r.value;
        if (!val) return;
        const broad = broadTypes[i]!;
        const { channels, programs } = val;
        for (const ch of channels) allChannels.set(ch.id, ch);
        allPrograms = allPrograms.concat(programs);
        logger.info("G-Guide:   %s → %d channels, %d programs", broad, channels.length, programs.length);
    });

    // 2. Now we can safely calculate tomorrowStr using the offset detected from "today" grids.
    const realToday = realTodayJst();
    const realTodayDate = new Date(
        `${realToday.slice(0, 4)}-${realToday.slice(4, 6)}-${realToday.slice(6, 8)}T12:00:00+09:00`,
    );
    const realTomorrowDate = new Date(realTodayDate.getTime() + 24 * 60 * 60 * 1000);
    const rParts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(realTomorrowDate);
    const rGet = (t: string) => rParts.find((p) => p.type === t)?.value ?? "";
    const tomorrowStr = `${rGet("year")}${rGet("month")}${rGet("day")}`;

    // 3. Fetch "tomorrow" grids.
    const tomorrowJobs = broadTypes.map((broad) =>
        fetchGridPage(broad, tomorrowStr, `gguide:grid:${broad}:${area}:${tomorrowStr}`, `${broad}/tomorrow`),
    );
    const tomorrowResults = await Promise.allSettled(tomorrowJobs);

    tomorrowResults.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const val = r.value;
        if (!val) return;
        const broad = broadTypes[i]!;
        const { channels, programs } = val;
        // We don't add channels from tomorrow (they should be the same as today)
        allPrograms = allPrograms.concat(programs);
        logger.info("G-Guide:   %s (tomorrow) → %d channels, %d programs", broad, channels.length, programs.length);
    });

    // Deduplicate programs (same channel + same start time)
    const seen = new Set<string>();
    allPrograms = allPrograms.filter((p) => {
        const key = `${p.channelId}|${p.startUtc}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Sort by start time
    allPrograms.sort((a, b) => a.startUtc - b.startUtc);

    // Only overwrite cache if we got at least some data; otherwise keep stale cache
    if (allChannels.size > 0) {
        cache.channels = allChannels;
        cache.programs = allPrograms;
        cache.lastRefresh = now;
        cache.consecutiveFailures = 0;

        logger.success(
            "G-Guide: loaded %d channels, %d programs for area %s (today + tomorrow)",
            cache.channels.size,
            cache.programs.length,
            area,
        );
    } else {
        logger.warn("G-Guide: all fetches failed for area %s, keeping previous cache (%d channels, %d programs)",
            area, cache.channels.size, cache.programs.length);
        cache.lastRefresh = now - gridRefreshMs + Math.min(300_000, 60_000 * Math.pow(2, cache.consecutiveFailures)); // exponential backoff, max 5 min
        cache.consecutiveFailures++;
    }
}

// ── Public API (drop-in replacement for xmltv.ts) ────────────

/**
 * Returns all channels scraped from G-Guide.
 * Keys are our generated IDs: gguide-{broad}-{number}
 */
export async function getChannels(area: string = DEFAULT_AREA): Promise<Map<string, GGuideChannel>> {
    await refreshGrids(area);
    return getAreaCache(area).channels;
}

/**
 * Returns programs for a specific channel within a UTC time window.
 */
export async function getPrograms(
    channelId: string,
    startUtc: number,
    endUtc: number,
    area: string = DEFAULT_AREA,
): Promise<GGuideProgram[]> {
    await refreshGrids(area);
    return getAreaCache(area).programs.filter(
        (p) =>
            p.channelId === channelId &&
            p.endUtc > startUtc &&
            p.startUtc < endUtc,
    );
}

/** Find a program by its listingId */
export async function findByListingId(listingId: string, area: string = DEFAULT_AREA): Promise<GGuideProgram | undefined> {
    await refreshGrids(area);
    return getAreaCache(area).programs.find((p) => p.listingId === listingId);
}

/** All programs (for broad searches) */
export async function getAllPrograms(area: string = DEFAULT_AREA): Promise<GGuideProgram[]> {
    await refreshGrids(area);
    return getAreaCache(area).programs;
}

/**
 * Fetch rich detail for a program (image, cast, genre).
 * Uses the eventId from the program to scrape the detail page.
 * Returns null if no eventId or scrape fails.
 */
export async function getProgramDetail(program: GGuideProgram, area: string = DEFAULT_AREA): Promise<GGuideProgramDetail | null> {
    if (!program.eventId) return null;
    return scrapeDetail(program.eventId, area);
}

/**
 * Fetch detail by eventId directly.
 */
export async function getDetailByEventId(eventId: string, area: string = DEFAULT_AREA): Promise<GGuideProgramDetail | null> {
    return scrapeDetail(eventId, area);
}

/**
 * Map a G-Guide genre class to a TVii showTypeID.
 *   "M" = Movie, "O" = Sports, "Y" = News, "A" = Animated/Anime,
 *   "W" = Music, "D" = Documentary, "6" = Comedy/Variety,
 *   "1" = Series/Drama (default)
 */
export function genreToShowTypeId(genreClass: string | null, genre: string | null, title: string = ""): string {
    // bangumi.org only uses ~5 CSS classes (gc-anime, gc-drama, gc-movie,
    // gc-music, gc-sports, no_genre) and frequently misclassifies programs
    // (e.g. news shows as gc-sports). Title-based checks are more reliable,
    // so we apply them first to override known misclassifications.

    const t = title;

    // ── Title-based detection (highest priority) ──
    if (/ニュース|報道|NEWS|ＮＨＫジャーナル|ワールド[A-Zａ-ｚ]*ニュース/.test(t)) return "Y"; // News
    if (/アニメ/.test(t)) return "A";
    if (/映画|劇場版|ロードショー|シネマ/.test(t)) return "M";
    if (/講座|テレビ体操|にほんごであそぼ|えいご|すくすく|知恵泉|サイエンス|百科/.test(t)) return "D"; // Education → Documentary
    if (/お買物情報|テレビショッピング|ショッピング|通販/.test(t)) return "H"; // Shopping → Lifestyle

    // ── CSS class from G-Guide grid ──
    if (genreClass) {
        switch (genreClass) {
            case "gc-anime": return "A";
            case "gc-movie": return "M";
            case "gc-sports": {
                // Verify it's actually sports via title keywords
                if (/野球|サッカー|ゴルフ|テニス|スポーツ|相撲|駅伝|ラグビー|バレー|卓球|水泳|NBA|NFL|MLB|F1|ボクシング|柔道|レスリング|競馬|マラソン|陸上|WBC|甲子園|Jリーグ/.test(t)) {
                    return "O";
                }
                // Otherwise fall through to further heuristics
                break;
            }
            case "gc-music": return "W";
            case "gc-drama": return "1";
            case "gc-news": return "Y";
            case "gc-variety": return "6";
            case "gc-documentary": return "D";
            case "gc-hobby": return "6";
            case "gc-education": return "D";
            case "gc-theater": return "1";
            case "gc-welfare": return "D";
        }
    }

    // ── Genre text from detail page ──
    const g = (genre ?? "").toLowerCase();
    if (/映画/.test(g)) return "M";
    if (/スポーツ/.test(g)) return "O";
    if (/ニュース|報道/.test(g)) return "Y";
    if (/アニメ/.test(g)) return "A";
    if (/音楽/.test(g)) return "W";
    if (/ドキュメンタリー|教養/.test(g)) return "D";
    if (/バラエティ|趣味|娯楽/.test(g)) return "6";
    if (/ドラマ/.test(g)) return "1";

    // ── More title heuristics ──
    if (/野球|サッカー|ゴルフ|テニス|スポーツ/.test(t)) return "O";
    if (/音楽|ライブ|コンサート/.test(t)) return "W";
    if (/バラエティ|笑/.test(t)) return "6";
    if (/ドキュメント|探検|ルポ/.test(t)) return "D";

    return "1"; // Default: Series/Drama
}

/**
 * Parse sports team/event info from a JP program title.
 * Many JP sports programs encode match info in the title, e.g.:
 *   "プロ野球 巨人×広島"
 *   "サッカー Jリーグ 浦和レッズvs鹿島アントラーズ"
 *   "テニス 全豪オープン 決勝"
 */
export function parseSportsTeamInfo(
    title: string,
    description: string | null,
    genreClass: string | null,
): { league: string; team1: string; team2: string; location: string; sportEvent: string } | null {
    if (genreClass !== "gc-sports") return null;

    let league = "";
    let team1 = "";
    let team2 = "";
    let location = "";
    let sportEvent = "";

    // Detect league/sport type from title
    const leaguePatterns: [RegExp, string][] = [
        [/プロ野球/, "プロ野球"],
        [/Jリーグ|J1|J2|J3/, "Jリーグ"],
        [/プレミアリーグ/, "プレミアリーグ"],
        [/ラ・リーガ|リーガ/, "ラ・リーガ"],
        [/ブンデスリーガ/, "ブンデスリーガ"],
        [/セリエA/, "セリエA"],
        [/チャンピオンズリーグ|CL/, "UEFAチャンピオンズリーグ"],
        [/ワールドカップ|W杯/, "ワールドカップ"],
        [/全豪オープン/, "全豪オープン"],
        [/全仏オープン/, "全仏オープン"],
        [/ウィンブルドン/, "ウィンブルドン"],
        [/全米オープン/, "全米オープン"],
        [/大相撲/, "大相撲"],
        [/箱根駅伝/, "箱根駅伝"],
        [/甲子園|高校野球/, "高校野球"],
        [/NBA/, "NBA"],
        [/NFL/, "NFL"],
        [/MLB/, "MLB"],
        [/F1/, "F1"],
        [/ゴルフ/, "ゴルフ"],
        [/ラグビー/, "ラグビー"],
        [/バレーボール/, "バレーボール"],
        [/卓球/, "卓球"],
        [/水泳/, "水泳"],
        [/陸上/, "陸上"],
        [/スキー/, "スキー"],
        [/フィギュアスケート|フィギュア/, "フィギュアスケート"],
    ];

    for (const [pattern, name] of leaguePatterns) {
        if (pattern.test(title)) {
            league = name;
            break;
        }
    }

    // Try to extract teams from "team1 vs team2" or "team1×team2" patterns
    const vsPatterns = [
        /[「（(]?([^「」（）()×vs]+?)\s*[×xXvV][sS]?\.?\s*([^」）)×vs]+?)[」）)]?$/,
        /\s([^\s「」]+?)\s*[×xX]\s*([^\s「」]+)/,
        /\s([^\s]+?)\s+(?:対|vs?)\.?\s+([^\s]+)/,
    ];

    for (const pat of vsPatterns) {
        const m = title.match(pat);
        if (m) {
            team1 = m[1]!.trim();
            team2 = m[2]!.trim();
            break;
        }
    }

    // Extract event name (text between league and teams)
    if (!team1 && !team2) {
        // No teams found — treat remaining title as event name
        let ev = title;
        if (league) ev = ev.replace(league, "").trim();
        // Clean common prefixes
        ev = ev.replace(/^[「『【〈《]|[」』】〉》]$/g, "").trim();
        ev = ev.replace(/^サッカー|^テニス|^野球|^ゴルフ|^ラグビー/g, "").trim();
        if (ev) sportEvent = ev;
    }

    // Try to extract location from description
    if (description) {
        const locMatch = description.match(/[（(]([^）)]*(?:スタジアム|球場|ドーム|アリーナ|体育館|競技場|会場|コート|リンク)[^）)]*)[）)]/);
        if (locMatch) {
            location = locMatch[1]!.trim();
        }
    }

    if (!league && !team1 && !team2 && !sportEvent) return null;

    return { league, team1, team2, location, sportEvent };
}

/**
 * Extract guest names from a G-Guide detail's cast list.
 * Guests have role containing "ゲスト" or similar JP guest markers.
 */
export function extractGuests(cast: GGuideCastMember[]): string | null {
    const guestRoles = ["ゲスト", "ゲストコメンテーター", "ゲスト解説", "スペシャルゲスト"];
    const guests = cast.filter(
        (c) => c.role && guestRoles.some((g) => c.role!.includes(g)),
    );
    if (guests.length === 0) return null;
    return guests.map((g) => g.name).join("、");
}

/**
 * Generate TV tags (hashtags) from program metadata.
 */
export function generateTags(
    title: string,
    _genre: string | null,
    channelName: string | null,
    genreClass: string | null,
): string[] {
    const tags: string[] = [];

    // Channel tag
    if (channelName) {
        // Clean channel name for hashtag (remove suffix numbers like "1・東京")
        const cleanCh = channelName.replace(/\d+[・·].*$/, "").trim();
        if (cleanCh) tags.push("#" + cleanCh);
    }

    // Genre tag
    const genreTagMap: Record<string, string> = {
        "gc-anime": "#アニメ",
        "gc-movie": "#映画",
        "gc-sports": "#スポーツ",
        "gc-music": "#音楽",
        "gc-drama": "#ドラマ",
        "gc-news": "#ニュース",
        "gc-variety": "#バラエティ",
        "gc-documentary": "#ドキュメンタリー",
        "gc-hobby": "#趣味",
        "gc-education": "#教育",
    };
    if (genreClass && genreTagMap[genreClass]) {
        tags.push(genreTagMap[genreClass]!);
    }

    // Title tag — use the main show title (strip episode info)
    let cleanTitle = title
        .replace(/\s*[#＃第]\d+[話回].*$/, "")   // strip episode numbers
        .replace(/\s*「[^」]+」$/, "")             // strip episode title in brackets
        .replace(/\s*\([^)]+\)$/, "")             // strip parenthetical
        .trim();
    if (cleanTitle && cleanTitle.length <= 20) {
        tags.push("#" + cleanTitle);
    }

    // Add TVii tag
    tags.push("#TVii");

    return tags;
}

/**
 * Find related programs: same genre, different listing, currently airing or upcoming.
 */
export async function findRelatedPrograms(
    sourceProgram: GGuideProgram,
    limit: number = 4,
    area: string = DEFAULT_AREA,
): Promise<GGuideProgram[]> {
    await refreshGrids(area);
    const nowUtc = Math.floor(Date.now() / 1000);
    const cache = getAreaCache(area);

    const related = cache.programs.filter((p) => {
        if (p.listingId === sourceProgram.listingId) return false;
        if (p.endUtc <= nowUtc) return false;

        // Skip programs with no genre class (avoids matching unrelated unclassified programs)
        if (!sourceProgram.genreClass) return false;

        // Same genre class
        if (p.genreClass !== sourceProgram.genreClass) return false;

        // Prefer different channel
        return true;
    });

    // Sort: same channel programs last, then by start time
    related.sort((a, b) => {
        const aSameCh = a.channelId === sourceProgram.channelId ? 1 : 0;
        const bSameCh = b.channelId === sourceProgram.channelId ? 1 : 0;
        if (aSameCh !== bSameCh) return aSameCh - bSameCh;

        // Currently airing first
        const aLive = a.startUtc <= nowUtc && a.endUtc > nowUtc ? 0 : 1;
        const bLive = b.startUtc <= nowUtc && b.endUtc > nowUtc ? 0 : 1;
        if (aLive !== bLive) return aLive - bLive;

        return a.startUtc - b.startUtc;
    });

    return related.slice(0, limit);
}

/**
 * Scrape a talent/actor page from bangumi.org.
 * Returns the talent's name, image, and upcoming program appearances.
 */
export async function getTalentDetail(talentId: string): Promise<GGuideTalentDetail | null> {
    // Validate talentId to prevent path traversal
    if (!/^[\w-]+$/.test(talentId)) return null;

    const cacheKey = `gguide:talent:${talentId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch {
            await redis.del(cacheKey);
        }
    }

    try {
        const url = `${GGUIDE_BASE}/talents/${talentId}`;
        const html = await gFetch(url);
        const $ = cheerio.load(html);

        // Name: <h1 class="talent_name"> or <h1> in the header area
        let name = $("h1.talent_name").text().trim()
            || $("h1").first().text().trim()
            || "Unknown";
        // Strip page-title suffix that bangumi.org appends
        name = name.replace(/\s*の出演番組$/, "").trim();

        // Profile image
        let image: string | null = $("img.talent_image").attr("src")
            || $("img.parts_program_image").first().attr("src")
            || null;
        if (image && image.includes("noimage")) image = null;

        // Upcoming programs listed on the talent page
        const programs: GGuideTalentDetail["programs"] = [];

        // Talent pages typically list programs in <ul class="talent_program_list"> or similar structures
        $("ul.talent_program_list li, section.program-list article, div.program-item, ul.resultList li").each((_, el) => {
            const $el = $(el);
            const pTitle = $el.find("h3, .title, a.title").first().text().trim()
                || $el.find("a").first().text().trim();
            if (!pTitle) return;

            const channelName = $el.find(".channel, .station").text().trim() || null;
            const scheduleText = $el.find(".schedule, .time, .date").text().trim().replace(/\s+/g, " ") || null;

            // Try to extract eventId from links
            let eventId: string | null = null;
            $el.find("a[href*='tv_events/']").each((_, a) => {
                const href = $(a).attr("href") ?? "";
                const m = href.match(/tv_events\/([^?]+)/);
                if (m) eventId = m[1]!;
            });

            const genre = $el.find(".genre").text().trim() || null;
            let pImage = $el.find("img").attr("src") || null;
            if (pImage && pImage.includes("noimage")) pImage = null;

            programs.push({ title: pTitle, channelName, scheduleText, eventId, genre, image: pImage });
        });

        const detail: GGuideTalentDetail = { name, image, programs };

        // Cache for 6 hours
        await redis.set(cacheKey, JSON.stringify(detail), "EX", 6 * 60 * 60);

        return detail;
    } catch (err: any) {
        logger.error("G-Guide talent scrape failed for %s: %s", talentId, err.message);
        return null;
    }
}

// ── Multi-language search: kana → romaji transliteration ─────
const KANA_ROMAJI: Record<string, string> = {
    "ア": "a", "イ": "i", "ウ": "u", "エ": "e", "オ": "o",
    "カ": "ka", "キ": "ki", "ク": "ku", "ケ": "ke", "コ": "ko",
    "サ": "sa", "シ": "shi", "ス": "su", "セ": "se", "ソ": "so",
    "タ": "ta", "チ": "chi", "ツ": "tsu", "テ": "te", "ト": "to",
    "ナ": "na", "ニ": "ni", "ヌ": "nu", "ネ": "ne", "ノ": "no",
    "ハ": "ha", "ヒ": "hi", "フ": "fu", "ヘ": "he", "ホ": "ho",
    "マ": "ma", "ミ": "mi", "ム": "mu", "メ": "me", "モ": "mo",
    "ヤ": "ya", "ユ": "yu", "ヨ": "yo",
    "ラ": "ra", "リ": "ri", "ル": "ru", "レ": "re", "ロ": "ro",
    "ワ": "wa", "ヲ": "wo", "ン": "n",
    "ガ": "ga", "ギ": "gi", "グ": "gu", "ゲ": "ge", "ゴ": "go",
    "ザ": "za", "ジ": "ji", "ズ": "zu", "ゼ": "ze", "ゾ": "zo",
    "ダ": "da", "ヂ": "di", "ヅ": "du", "デ": "de", "ド": "do",
    "バ": "ba", "ビ": "bi", "ブ": "bu", "ベ": "be", "ボ": "bo",
    "パ": "pa", "ピ": "pi", "プ": "pu", "ペ": "pe", "ポ": "po",
    "キャ": "kya", "キュ": "kyu", "キョ": "kyo",
    "シャ": "sha", "シュ": "shu", "ショ": "sho",
    "チャ": "cha", "チュ": "chu", "チョ": "cho",
    "ニャ": "nya", "ニュ": "nyu", "ニョ": "nyo",
    "ヒャ": "hya", "ヒュ": "hyu", "ヒョ": "hyo",
    "ミャ": "mya", "ミュ": "myu", "ミョ": "myo",
    "リャ": "rya", "リュ": "ryu", "リョ": "ryo",
    "ギャ": "gya", "ギュ": "gyu", "ギョ": "gyo",
    "ジャ": "ja", "ジュ": "ju", "ジョ": "jo",
    "ビャ": "bya", "ビュ": "byu", "ビョ": "byo",
    "ピャ": "pya", "ピュ": "pyu", "ピョ": "pyo",
    // Extended kana for loanwords
    "ファ": "fa", "フィ": "fi", "フェ": "fe", "フォ": "fo",
    "ティ": "ti", "ディ": "di", "トゥ": "tu", "ドゥ": "du",
    "ウィ": "wi", "ウェ": "we", "ウォ": "wo",
    "シェ": "she", "ジェ": "je", "チェ": "che",
    "ツァ": "tsa", "デュ": "dyu", "テュ": "tyu",
    "ヴァ": "va", "ヴィ": "vi", "ヴ": "vu", "ヴェ": "ve", "ヴォ": "vo",
    "ッ": "",  // double consonant marker handled below
    "ー": "-",
    "ァ": "a", "ィ": "i", "ゥ": "u", "ェ": "e", "ォ": "o",
};

/** Convert katakana in a string to romaji. Hiragana is first shifted to katakana range. */
function toRomaji(text: string): string {
    // Convert hiragana (U+3041-U+3096) to katakana (U+30A1-U+30F6)
    let kata = "";
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code >= 0x3041 && code <= 0x3096) {
            kata += String.fromCharCode(code + 0x60);
        } else {
            kata += text[i];
        }
    }

    let result = "";
    let i = 0;
    while (i < kata.length) {
        // Try two-char combos first (e.g. キャ)
        if (i + 1 < kata.length) {
            const pair = kata[i]! + kata[i + 1]!;
            if (KANA_ROMAJI[pair]) {
                result += KANA_ROMAJI[pair];
                i += 2;
                continue;
            }
        }
        // Sokuon (ッ): doubles next consonant
        if (kata[i] === "ッ" && i + 1 < kata.length) {
            const next = KANA_ROMAJI[kata[i + 1]!];
            if (next && next.length > 0) {
                result += next[0]; // double the consonant
            }
            i++;
            continue;
        }
        const single = KANA_ROMAJI[kata[i]!];
        if (single !== undefined) {
            result += single;
        } else {
            result += kata[i]; // keep as-is (kanji, latin, etc.)
        }
        i++;
    }
    return result;
}

/**
 * Search programs by keyword (title or description match).
 * Supports multi-language: queries in romaji/latin will also match
 * against romanized versions of Japanese titles.
 */
export async function searchPrograms(
    query: string,
    limit: number = 20,
    offset: number = 0,
    area: string = DEFAULT_AREA,
): Promise<{ total: number; results: GGuideProgram[] }> {
    await refreshGrids(area);
    const nowUtc = Math.floor(Date.now() / 1000);
    const q = query.toLowerCase();
    const cache = getAreaCache(area);

    // Detect if query is primarily ASCII (romaji/english search)
    const isLatinQuery = /^[\x20-\x7F]+$/.test(q);

    const matched = cache.programs.filter((p) => {
        if (p.endUtc <= nowUtc) return false;
        if (p.title.toLowerCase().includes(q)) return true;
        if (p.description && p.description.toLowerCase().includes(q)) return true;
        // For Latin queries, also try matching against romanized title
        if (isLatinQuery) {
            const romTitle = toRomaji(p.title).toLowerCase();
            if (romTitle.includes(q)) return true;
        }
        return false;
    });

    // Sort: currently airing first, then by start time
    matched.sort((a, b) => {
        const aLive = a.startUtc <= nowUtc && a.endUtc > nowUtc ? 0 : 1;
        const bLive = b.startUtc <= nowUtc && b.endUtc > nowUtc ? 0 : 1;
        if (aLive !== bLive) return aLive - bLive;
        return a.startUtc - b.startUtc;
    });

    return { total: matched.length, results: matched.slice(offset, offset + limit) };
}

/**
 * Force a grid refresh on next call.
 */
export function invalidateCache(): void {
    areaCaches.clear();
    dateOffsetSeconds = null;   // recalculate on next scrape
}
