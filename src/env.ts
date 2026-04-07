export const env = {
  VINO_JP_GGUIDE_AREA: process.env.VINO_JP_GGUIDE_AREA || "23",
  VINO_JP_GGUIDE_REFRESH_MINUTES: Number(process.env.VINO_JP_GGUIDE_REFRESH_MINUTES || 30),
  VINO_JP_XMLTV_LINEUP_PATH: process.env.VINO_JP_XMLTV_LINEUP_PATH || "./data/japan.json",
  VINO_JP_XMLTV_ADULT_FILTER: process.env.VINO_JP_XMLTV_ADULT_FILTER !== "false",
};
