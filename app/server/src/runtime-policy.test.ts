import { describe, expect, it } from "vitest";
import {
  assertRuntimePolicy,
  getRuntimePolicy,
  RUNTIME_POLICY,
  SYNTHETIC_KNOWLEDGE_TOOL_NAME,
  TIA_READONLY_TOOL_NAMES,
} from "./runtime-policy.js";

describe("restricted Pi runtime policy", () => {
  it("allows only the synthetic read-only knowledge tool", () => {
    expect(RUNTIME_POLICY.allowedTools).toEqual([SYNTHETIC_KNOWLEDGE_TOOL_NAME]);
    expect(RUNTIME_POLICY.externalAccess).toBe(false);
    expect(RUNTIME_POLICY.mutations).toBe(false);
    expect(() => assertRuntimePolicy()).not.toThrow();
  });

  it("does not expose built-in, MCP, browser, or raw TIA tool names", () => {
    const names = RUNTIME_POLICY.allowedTools.map((name) => name.toLowerCase());
    for (const forbidden of ["bash", "read", "write", "edit", "browser", "mcp", "tia"]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("enables only the classified read-only TIA catalog when explicitly configured", () => {
    const policy = getRuntimePolicy({ SIMON_ENGINEERING_MODE: "tia-readonly" });
    expect(policy.allowedTools).toEqual(TIA_READONLY_TOOL_NAMES);
    expect(policy.externalAccess).toBe(true);
    expect(policy.mutations).toBe(false);
    expect(policy.allowedTools).toEqual(expect.arrayContaining([
      "simon_engineering_snapshot_status",
      "simon_engineering_search",
      "simon_engineering_find_references",
    ]));
    expect(policy.allowedTools.some((name) => /attach|connect|disconnect|refresh|export|import|compile|save/i.test(name))).toBe(false);
    expect(() => assertRuntimePolicy(policy)).not.toThrow();
  });
});
