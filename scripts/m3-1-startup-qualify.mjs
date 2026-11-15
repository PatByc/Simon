import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const workspace = mkdtempSync(join(tmpdir(), "simon-m3-1-startup-"));
const packageNames = ["ProgSCL2MenUS.zip", "ProgPLCBasicsenUS.zip", "ProgExtInstr2MenUS.zip"];
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function directoryBytes(directory) {
  let bytes = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    bytes += entry.isDirectory() ? directoryBytes(path) : statSync(path).size;
  }
  return bytes;
}

async function waitForJson(url, timeoutMs, accept = () => true) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) { const body = await response.json(); if (accept(body)) return { elapsedMs: Math.round(performance.now() - started), body }; }
    } catch { /* The listener is not ready yet. */ }
    await sleep(25);
  }
  throw new Error("Timed out waiting for the loopback application.");
}

async function waitForAssistant(url, timeoutMs) {
  const started = performance.now(); let maxResponseMs = 0;
  while (performance.now() - started < timeoutMs) {
    const requestStarted = performance.now();
    try {
      const response = await fetch(url); const responseMs = performance.now() - requestStarted; maxResponseMs = Math.max(maxResponseMs, responseMs);
      if (response.ok) { const body = await response.json(); if (body.reason !== "Assistant runtime is initializing.") return { body, maxResponseMs: Math.round(maxResponseMs) }; }
    } catch { /* Retry bounded loopback readiness. */ }
    await sleep(100);
  }
  throw new Error("Timed out waiting for assistant initialization.");
}

async function runScenario({ name, port, dataDirectory, runtime = "fake", helpRoot }) {
  mkdirSync(dataDirectory, { recursive: true });
  const child = spawn(process.execPath, ["app/server/dist/index.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      SIMON_RUNTIME: runtime,
      SIMON_ENGINEERING_MODE: "synthetic",
      SIMON_PORT: String(port),
      SIMON_DATA_DIR: dataDirectory,
      ...(helpRoot ? { SIMON_TIA_V20_HELP_ROOT: helpRoot } : {}),
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  const started = performance.now();
  try {
    const application = await waitForJson(`http://127.0.0.1:${port}/api/v1/status`, 90_000);
    const documentation = await waitForJson(`http://127.0.0.1:${port}/api/v1/documentation/status`, 90_000, (body) => !body.sources.some((source) => source.state === "indexing"));
    const documentationTerminalMs = Math.round(performance.now() - started);
    const assistant = runtime === "pi"
      ? await waitForAssistant(`http://127.0.0.1:${port}/api/v1/status`, 90_000)
      : { body: application.body, maxResponseMs: application.elapsedMs };
    const assistantReadyMs = runtime === "pi" ? Math.round(performance.now() - started) : application.elapsedMs;
    let searchMs = null;
    if (documentation.body.topicCount > 0) {
      const searchStarted = performance.now();
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/documentation/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "REF: Create a reference to a tag (S7-1500)", limit: 20, allowAdjacent: false,
          target: { product: "STEP 7", version: "V20", update: "Update 7", cpuFamily: "S7-1500", firmware: null, language: "SCL", locale: "en-US" },
        }),
      });
      await response.json();
      searchMs = Math.round((performance.now() - searchStarted) * 10) / 10;
    }
    return {
      name, runtime,
      applicationReadyMs: application.elapsedMs,
      documentationReadyMs: documentationTerminalMs,
      documentationAfterApplicationMs: documentationTerminalMs - application.elapsedMs,
      processReadyMs: Math.round(performance.now() - started),
      assistantAvailableAtFirstResponse: application.body.available,
      assistantReadyMs,
      assistantAvailable: assistant.body.available,
      maxStatusResponseMsDuringInitialization: assistant.maxResponseMs,
      topicCount: documentation.body.topicCount,
      currentSourceCount: documentation.body.currentSourceCount,
      blockedSourceCount: documentation.body.blockedSourceCount,
      partial: documentation.body.partial,
      searchMs,
      runtimeBytes: directoryBytes(dataDirectory),
    };
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
}

try {
  const realData = join(workspace, "real");
  const corruptHelp = join(workspace, "corrupt-help");
  mkdirSync(corruptHelp, { recursive: true });
  for (const name of packageNames) writeFileSync(join(corruptHelp, name), "invalid ZIP fixture");
  const scenarios = [
    await runScenario({ name: "clean-installed", port: 4391, dataDirectory: realData }),
    await runScenario({ name: "warm-unchanged", port: 4392, dataDirectory: realData }),
    await runScenario({ name: "pi-warm-unchanged", port: 4393, dataDirectory: realData, runtime: "pi" }),
    await runScenario({ name: "missing-root", port: 4394, dataDirectory: join(workspace, "missing"), helpRoot: join(workspace, "absent-help") }),
    await runScenario({ name: "failed-ingestion", port: 4395, dataDirectory: join(workspace, "failed"), helpRoot: corruptHelp }),
  ];
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, scenarios }, null, 2)}\n`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
