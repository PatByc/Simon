import { parentPort, workerData } from "node:worker_threads";

import { initializeDocumentationSources } from "./documentation-initialization.js";
import { DocumentationStore } from "./documentation-store.js";

interface InitializationWorkerData {
  readonly databasePath: string;
  readonly installedRoot: string;
  readonly packageAllowlist: readonly string[];
  readonly product?: string;
  readonly version?: string;
  readonly update?: string;
  readonly locale?: string;
}

const data = workerData as InitializationWorkerData;
const store = new DocumentationStore(data.databasePath);
try {
  initializeDocumentationSources(store, {
    installedRoot: data.installedRoot,
    packageAllowlist: data.packageAllowlist,
    ...(data.product ? { product: data.product } : {}),
    ...(data.version ? { version: data.version } : {}),
    ...(data.update ? { update: data.update } : {}),
    ...(data.locale ? { locale: data.locale } : {}),
  });
  parentPort?.postMessage({ status: "completed" });
} finally {
  store.close();
}
