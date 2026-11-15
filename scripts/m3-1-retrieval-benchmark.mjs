import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [{ initializeDocumentationSources }, { DocumentationRetrievalService }, { DocumentationStore }, benchmark] = await Promise.all([
  import("../app/server/dist/documentation-initialization.js"),
  import("../app/server/dist/documentation-retrieval.js"),
  import("../app/server/dist/documentation-store.js"),
  import("../app/server/dist/testing/m3-1-retrieval-benchmark.js"),
]);

const directory = mkdtempSync(join(tmpdir(), "simon-m3-1-benchmark-"));
try {
  const store = new DocumentationStore(join(directory, "documentation.sqlite"));
  const installedRoot = process.env.SIMON_TIA_V20_HELP_ROOT?.trim() || resolve(process.env.ProgramFiles ?? "C:/Program Files", "Siemens/Automation/Portal V20/Help/en-US");
  initializeDocumentationSources(store, { installedRoot, packageAllowlist: ["ProgSCL2MenUS.zip", "ProgPLCBasicsenUS.zip", "ProgExtInstr2MenUS.zip"] });
  const installedStatus = new DocumentationRetrievalService(store).status();
  if (installedStatus.topicCount === 0) throw new Error("Installed benchmark source is unavailable.");
  const syntheticCases = benchmark.retrievalBenchmarkCases.filter((entry) => entry.corpus === "synthetic");
  const installedCases = benchmark.retrievalBenchmarkCases.filter((entry) => entry.corpus === "installed");
  const results = [
    ...benchmark.runRetrievalBenchmark(benchmark.createSyntheticBenchmarkRetrieval(), syntheticCases),
    ...benchmark.runRetrievalBenchmark(new DocumentationRetrievalService(store), installedCases),
  ];
  const caseById = new Map(benchmark.retrievalBenchmarkCases.map((entry) => [entry.id, entry]));
  const lexical = results.filter((result) => caseById.get(result.id)?.expected.matchKind === "lexical");
  const criticalFailures = results.filter((result) => !result.passed && caseById.get(result.id)?.expected.matchKind !== "lexical");
  const summary = {
    schemaVersion: 1,
    cases: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    syntheticPassed: results.filter((result) => result.corpus === "synthetic" && result.passed).length,
    installedPassed: results.filter((result) => result.corpus === "installed" && result.passed).length,
    lexicalTopKRate: lexical.length ? lexical.filter((result) => result.passed).length / lexical.length : 1,
    criticalFailures: criticalFailures.length,
    failures: results.filter((result) => !result.passed),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  store.close();
  if (summary.criticalFailures > 0 || summary.lexicalTopKRate < 0.85) process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
