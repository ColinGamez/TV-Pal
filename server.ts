import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as gguide from "./src/lib/gguide.ts";
import * as jpLineup from "./src/lib/jpLineup.ts";
import { registry } from "./src/lib/registry.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Routes
  app.get("/api/channels", async (req, res) => {
    try {
      const area = (req.query.area as string) || "23";
      const allChannels = await gguide.getChannels(area);
      const registryChannels = registry.getChannels(area);
      
      const filtered = registryChannels.map(entry => {
        const gChannel = allChannels.get(entry.channelId);
        return {
          ...entry,
          broad: gChannel?.broad || entry.broad || "dt",
          lineIndex: gChannel?.lineIndex || 0,
        };
      });
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  app.get("/api/streams", (req, res) => {
    const { channelId, area } = req.query;
    if (!channelId) return res.status(400).json({ error: "channelId is required" });
    
    const streams = registry.getStreams(channelId as string, area as string);
    res.json(streams);
  });

  app.get("/api/health", (_req, res) => {
    const status = registry.getHealthStatus();
    res.json({
      status: "ok",
      timestamp: Date.now(),
      registry: status
    });
  });

  app.get("/api/guide", async (req, res) => {
    const { start, end, area } = req.query;
    const startUtc = Number(start) || Math.floor(Date.now() / 1000);
    const endUtc = Number(end) || startUtc + 24 * 60 * 60;
    const gArea = (area as string) || "23";

    try {
      const lineup = jpLineup.getLineup();
      const guideData: Record<string, any[]> = {};
      
      for (const channelId of lineup.keys()) {
        guideData[channelId] = await gguide.getPrograms(channelId, startUtc, endUtc, gArea);
      }
      
      res.json(guideData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guide" });
    }
  });

  app.get("/api/now", async (req, res) => {
    const nowUtc = Math.floor(Date.now() / 1000);
    const area = (req.query.area as string) || "23";
    try {
      const lineup = jpLineup.getLineup();
      const nowData: Record<string, any> = {};
      
      for (const channelId of lineup.keys()) {
        const programs = await gguide.getPrograms(channelId, nowUtc - 3600, nowUtc + 7200, area);
        const current = programs.find(p => p.startUtc <= nowUtc && p.endUtc > nowUtc);
        const next = programs.find(p => p.startUtc > nowUtc);
        nowData[channelId] = { current, next };
      }
      
      res.json(nowData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch now/next" });
    }
  });

  app.get("/api/program/:listingId", async (req, res) => {
    try {
      const area = (req.query.area as string) || "23";
      const program = await gguide.findByListingId(req.params.listingId, area);
      if (!program) return res.status(404).json({ error: "Program not found" });
      
      const detail = await gguide.getProgramDetail(program, area);
      res.json({ ...program, detail });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch program detail" });
    }
  });

  app.get("/api/channel/:channelId", async (req, res) => {
    const nowUtc = Math.floor(Date.now() / 1000);
    const startUtc = nowUtc - (nowUtc % 86400); // Start of day
    const endUtc = startUtc + 86400;
    const area = (req.query.area as string) || "23";

    try {
      const programs = await gguide.getPrograms(req.params.channelId, startUtc, endUtc, area);
      res.json(programs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch channel schedule" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
