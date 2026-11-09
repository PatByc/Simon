import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UsageService } from "./usage-service.js";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

describe("UsageService", () => {
  it("returns only sanitized quota windows", async () => {
    const directory = mkdtempSync(join(tmpdir(), "simon-usage-"));
    directories.push(directory);
    const authPath = join(directory, "auth.json");
    writeFileSync(authPath, JSON.stringify({ "openai-codex": { access: "secret-token", accountId: "account-1" } }));
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      email: "must-not-leak@example.com",
      plan_type: "team",
      rate_limit: {
        primary_window: { used_percent: 24, reset_after_seconds: 100, reset_at: 1794145312 },
        secondary_window: { used_percent: 4, reset_after_seconds: 200, reset_at: 1794732112 },
      },
    }), { status: 200 }));

    const result = await new UsageService(authPath, fetcher).getStatus();
    expect(result).toMatchObject({
      available: true,
      planType: "team",
      primary: { label: "5h", usedPercent: 24 },
      secondary: { label: "7d", usedPercent: 4 },
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ "ChatGPT-Account-Id": "account-1" }),
    }));
  });
});
