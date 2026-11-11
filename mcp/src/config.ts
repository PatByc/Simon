import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface SimonMcpConfig {
  readonly connector: "tia-v20" | "simulated";
  readonly tiaV20Executable: string;
  readonly tiaMajorVersion: 20;
  readonly toolTimeoutMs: number;
  readonly artifactRoot: string;
}

export function getMcpPackageRoot(): string {
  const parent = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  return path.basename(parent).toLowerCase() === "dist" ? path.dirname(parent) : parent;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SimonMcpConfig {
  const connector = env.SIMON_ENGINEERING_CONNECTOR === "tia-v20" ? "tia-v20" : "simulated";
  const packageRoot = getMcpPackageRoot();
  const executable = path.join(
    packageRoot,
    "worker",
    "tia",
    "v20",
    "server",
    "bin",
    "Release",
    "net48",
    "TiaV20UnifiedMcpServer.exe",
  );
  if (connector === "tia-v20" && !existsSync(executable)) {
    throw new Error("The incorporated TIA V20 worker has not been built. Run the @simon/mcp worker:build script.");
  }
  const timeout = Number(env.SIMON_TIA_V20_TOOL_TIMEOUT_MS ?? 30_000);
  if (!Number.isSafeInteger(timeout) || timeout < 1_000 || timeout > 300_000) {
    throw new Error("SIMON_TIA_V20_TOOL_TIMEOUT_MS must be between 1000 and 300000.");
  }
  const configuredArtifactRoot = env.SIMON_TIA_V20_ARTIFACT_ROOT?.trim();
  return {
    connector,
    tiaV20Executable: executable,
    tiaMajorVersion: 20,
    toolTimeoutMs: timeout,
    artifactRoot: path.resolve(configuredArtifactRoot || "data/mcp-artifacts"),
  };
}
