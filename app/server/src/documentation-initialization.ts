import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import { documentationSourceSchema } from "@simon/contracts";

import { createRightsBlockedOnlineSource, InstalledHelpAdapter, type InstalledHelpLimits } from "./documentation-ingestion.js";
import { normalizeDocumentationIngestion } from "./documentation-normalization.js";
import { DocumentationStore } from "./documentation-store.js";

function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export function initializeDocumentationSources(store: DocumentationStore, config: {
  readonly installedRoot: string;
  readonly packageAllowlist: readonly string[];
  readonly limits?: InstalledHelpLimits;
  readonly product?: string;
  readonly version?: string;
  readonly update?: string;
  readonly locale?: string;
}): void {
  const product = config.product ?? "STEP 7";
  const version = config.version ?? "V20";
  const update = config.update ?? "Update 7";
  const locale = config.locale ?? "en-US";
  const online = createRightsBlockedOnlineSource({ title: "TIA Documentation Portal V20", product, version, update: null, locale, canonicalUrl: "https://docs.tia.siemens.cloud/r/en-us/v20/" });
  store.replaceSource(online, []);

  if (!existsSync(config.installedRoot)) {
    store.replaceSource(documentationSourceSchema.parse({ sourceId: digest(`missing\0${product}\0${version}\0${update}\0${locale}`), kind: "installed-help", authority: "official-documentation", title: `${product} installed help ${version} ${update}`, product, version, update, locale, canonicalUrl: null, rightsStatus: "local-only", state: "failed", extractionMethod: "installed-zip-html", contentDigest: null, indexedAt: null, statusNote: "The configured installed-help root is unavailable.", attributes: {} }), []);
    return;
  }

  try {
    const ingested = new InstalledHelpAdapter({ root: config.installedRoot, product, version, update, locale, packageAllowlist: config.packageAllowlist, ...(config.limits ? { limits: config.limits } : {}) }).ingest();
    const normalized = normalizeDocumentationIngestion(ingested);
    store.replaceSource(normalized.source, normalized.topics);
  } catch (error) {
    const note = error instanceof Error ? error.message : "Installed help ingestion failed.";
    store.replaceSource(documentationSourceSchema.parse({ sourceId: digest(`failed\0${product}\0${version}\0${update}\0${locale}`), kind: "installed-help", authority: "official-documentation", title: `${product} installed help ${version} ${update}`, product, version, update, locale, canonicalUrl: null, rightsStatus: "local-only", state: "failed", extractionMethod: "installed-zip-html", contentDigest: null, indexedAt: null, statusNote: `Installed help ingestion failed: ${note}`.slice(0, 500), attributes: {} }), []);
  }
}
