import { logger } from "./logger.ts";
import * as jpLineup from "./jpLineup.ts";

export interface StreamSource {
    url: string;
    label?: string;
    priority: number; // Higher is better
    health: "online" | "degraded" | "offline";
    lastChecked?: number;
    gainOffset?: number;
}

export interface RegistryChannel {
    channelId: string;
    number: string;
    name: string;
    logo: string | null;
    group: string | null;
    broad: "dt" | "bs" | "cs";
    quality: "HD" | "SD" | "4K";
    streams: StreamSource[];
    regionRestrictions?: string[];
}

class IPTVRegistry {
    private channels: Map<string, RegistryChannel> = new Map();
    private loaded = false;

    constructor() {
        // Initialize with default mappings
        this.initialize();
    }

    private initialize() {
        if (this.loaded) return;

        // Default stream mappings (previously in frontend)
        const defaultStreams: Record<string, StreamSource[]> = {
            'gguide-dt-1': [
                { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', priority: 10, health: 'online' },
                { url: 'https://diceyk9aa9644.cloudfront.net/out/v1/717f898993064f46823c30f013f92b74/index.m3u8', priority: 5, health: 'online' }
            ],
            'gguide-dt-2': [
                { url: 'https://diceyk9aa9644.cloudfront.net/out/v1/717f898993064f46823c30f013f92b74/index.m3u8', priority: 10, health: 'online', gainOffset: -2 },
                { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', priority: 5, health: 'online' }
            ],
            'gguide-dt-4': [
                { url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', priority: 10, health: 'online', gainOffset: 1 }
            ],
            'gguide-dt-5': [
                { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-dt-6': [
                { url: 'https://diceyk9aa9644.cloudfront.net/out/v1/717f898993064f46823c30f013f92b74/index.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-dt-7': [
                { url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-dt-8': [
                { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-dt-9': [
                { url: 'https://diceyk9aa9644.cloudfront.net/out/v1/717f898993064f46823c30f013f92b74/index.m3u8', priority: 10, health: 'online' }
            ],
            // BS Channels
            'gguide-bs-101': [
                { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-bs-141': [
                { url: 'https://diceyk9aa9644.cloudfront.net/out/v1/717f898993064f46823c30f013f92b74/index.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-bs-151': [
                { url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-bs-161': [
                { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-bs-171': [
                { url: 'https://diceyk9aa9644.cloudfront.net/out/v1/717f898993064f46823c30f013f92b74/index.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-bs-181': [
                { url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-bs-191': [
                { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-bs-211': [
                { url: 'https://diceyk9aa9644.cloudfront.net/out/v1/717f898993064f46823c30f013f92b74/index.m3u8', priority: 10, health: 'online' }
            ],
            'gguide-bs-222': [
                { url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', priority: 10, health: 'online' }
            ]
        };

        const lineup = jpLineup.getLineup();
        for (const [id, entry] of lineup.entries()) {
            this.channels.set(id, {
                ...entry,
                broad: id.includes("-bs-") ? "bs" : id.includes("-cs-") ? "cs" : "dt",
                quality: "HD",
                streams: defaultStreams[id] || [
                    { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', priority: 1, health: 'online' }
                ]
            });
        }

        this.loaded = true;
        logger.success("IPTVRegistry: Loaded %d channels with stream mappings", this.channels.size);
        
        // Start lightweight health check
        this.startHealthCheck();
    }

    private startHealthCheck() {
        setInterval(() => {
            this.performHealthCheck();
        }, 60000 * 5); // Every 5 minutes
    }

    private async performHealthCheck() {
        logger.info("IPTVRegistry: Performing lightweight health check...");
        for (const channel of this.channels.values()) {
            for (const stream of channel.streams) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    const resp = await fetch(stream.url, { method: 'HEAD', signal: controller.signal });
                    clearTimeout(timeoutId);
                    
                    if (resp.ok) {
                        stream.health = 'online';
                    } else {
                        stream.health = 'degraded';
                    }
                } catch (e) {
                    stream.health = 'offline';
                }
                stream.lastChecked = Date.now();
            }
        }
    }

    public getChannels(area?: string): RegistryChannel[] {
        const all = Array.from(this.channels.values());
        if (!area) return all;

        // Filter by region if restrictions exist
        return all.filter(ch => {
            if (!ch.regionRestrictions) return true;
            return ch.regionRestrictions.includes(area);
        });
    }

    public getStreams(channelId: string, area?: string): StreamSource[] {
        const channel = this.channels.get(channelId);
        if (!channel) return [];

        // Check region restrictions
        if (channel.regionRestrictions && area && !channel.regionRestrictions.includes(area)) {
            return [];
        }

        // Return streams sorted by priority, excluding offline if possible
        return channel.streams
            .filter(s => s.health !== 'offline')
            .sort((a, b) => b.priority - a.priority);
    }

    public getHealthStatus() {
        const stats = {
            totalChannels: this.channels.size,
            onlineStreams: 0,
            degradedStreams: 0,
            offlineStreams: 0
        };

        for (const ch of this.channels.values()) {
            for (const s of ch.streams) {
                if (s.health === 'online') stats.onlineStreams++;
                else if (s.health === 'degraded') stats.degradedStreams++;
                else stats.offlineStreams++;
            }
        }

        return stats;
    }
}

export const registry = new IPTVRegistry();
