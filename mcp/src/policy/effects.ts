export const toolEffects = [
  "status-read",
  "project-read",
  "artifact-producing-read",
  "preview",
  "project-mutation",
  "compile",
  "save",
  "online-operation",
  "process-control",
] as const;
export type ToolEffect = (typeof toolEffects)[number];

export function isReadEffect(effect: ToolEffect): boolean {
  return effect === "status-read" || effect === "project-read" || effect === "artifact-producing-read";
}
