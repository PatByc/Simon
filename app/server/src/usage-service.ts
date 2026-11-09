import { readFileSync } from "node:fs";
import type { UsageStatus, UsageWindow } from "@simon/contracts";

interface CodexWindow {
  used_percent?: number;
  reset_after_seconds?: number;
  reset_at?: number;
}

interface CodexUsageResponse {
  plan_type?: string;
  rate_limit?: {
    primary_window?: CodexWindow;
    secondary_window?: CodexWindow;
  };
}

function mapWindow(label: "5h" | "7d", window: CodexWindow | undefined): UsageWindow | undefined {
  if (!window || typeof window.used_percent !== "number" || typeof window.reset_at !== "number") return undefined;
  return {
    label,
    usedPercent: Math.max(0, Math.min(100, window.used_percent)),
    resetAt: new Date(window.reset_at * 1000).toISOString(),
    resetAfterSeconds: Math.max(0, Math.round(window.reset_after_seconds ?? 0)),
  };
}

export class UsageService {
  constructor(
    private readonly authPath?: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async getStatus(): Promise<UsageStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.authPath) return { available: false, reason: "Usage is unavailable for this runtime", checkedAt };
    try {
      const authStore = JSON.parse(readFileSync(this.authPath, "utf8")) as Record<string, unknown>;
      const credential = authStore["openai-codex"] as { access?: unknown; accountId?: unknown } | undefined;
      if (typeof credential?.access !== "string" || typeof credential.accountId !== "string") {
        return { available: false, reason: "OpenAI Codex credentials are unavailable", checkedAt };
      }
      const response = await this.fetcher("https://chatgpt.com/backend-api/wham/usage", {
        headers: {
          Authorization: `Bearer ${credential.access}`,
          "ChatGPT-Account-Id": credential.accountId,
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return { available: false, reason: `Usage service returned ${response.status}`, checkedAt };
      const data = await response.json() as CodexUsageResponse;
      const primary = mapWindow("5h", data.rate_limit?.primary_window);
      const secondary = mapWindow("7d", data.rate_limit?.secondary_window);
      if (!primary || !secondary) return { available: false, reason: "Usage windows were not returned", checkedAt };
      return {
        available: true,
        ...(data.plan_type ? { planType: data.plan_type } : {}),
        primary,
        secondary,
        checkedAt,
      };
    } catch (error) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : "Unable to load usage",
        checkedAt,
      };
    }
  }
}
