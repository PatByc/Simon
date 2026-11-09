export const operatingModes = ["synthetic", "tia-readonly", "tia-proposal", "tia-write"] as const;
export type OperatingMode = (typeof operatingModes)[number];
