import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export interface ChildProcessSpec {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env: Readonly<Record<string, string>>;
}

export function spawnRestrictedProcess(spec: ChildProcessSpec): ChildProcessWithoutNullStreams {
  if (!spec.executable || !spec.executable.includes("\\") && !spec.executable.includes("/")) {
    throw new Error("Connector executable must be an explicit path.");
  }
  return spawn(spec.executable, [...spec.args], {
    cwd: spec.cwd,
    env: { ...spec.env },
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
