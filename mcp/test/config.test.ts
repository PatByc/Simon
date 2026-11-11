import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMcpPackageRoot, loadConfig } from "../src/config.js";

describe("MCP configuration", () => {
  it("uses the simulated connector by default", () => {
    expect(loadConfig({}).connector).toBe("simulated");
  });

  it("keeps artifacts in the controlled data directory when the environment value is blank", () => {
    expect(loadConfig({ SIMON_TIA_V20_ARTIFACT_ROOT: "  " }).artifactRoot)
      .toBe(path.resolve("data/mcp-artifacts"));
  });

  it("resolves the incorporated TIA worker inside Simon", () => {
    const config = loadConfig({ SIMON_ENGINEERING_CONNECTOR: "tia-v20" });
    expect(config.tiaV20Executable).toBe(path.join(
      getMcpPackageRoot(),
      "worker",
      "tia",
      "v20",
      "server",
      "bin",
      "Release",
      "net48",
      "TiaV20UnifiedMcpServer.exe",
    ));
  });
});
