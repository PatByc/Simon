export const toolExposures = ["model", "host-only", "internal", "blocked"] as const;
export type ToolExposure = (typeof toolExposures)[number];
