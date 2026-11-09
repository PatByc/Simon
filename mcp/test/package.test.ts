import { describe, expect, it } from "vitest";

import { SIMON_MCP_PACKAGE } from "../src/index.js";

describe("Simon MCP package", () => {
  it("exposes its package identity", () => {
    expect(SIMON_MCP_PACKAGE).toBe("@simon/mcp");
  });
});
