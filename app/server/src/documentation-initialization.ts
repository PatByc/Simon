import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import { documentationSourceSchema, type DocumentationSource, type DocumentationSourceState } from "@simon/contracts";

import { createRightsBlockedOnlineSource, InstalledHelpAdapter, type InstalledHelpLimits } from "./documentation-ingestion.js";
import { normalizeDocumentationIngestion } from "./documentation-normalization.js";
import { DocumentationStore } from "./documentation-store.js";

function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }

function safeFailureNote(error: unknown): string {
  const message = error instanceof Error ? error.message : "Installed help ingestion failed.";
  if (/[a-z]:[\\/]|\\\\|(?:^|\s)\/[\w.-]/i.test(message)) return "Installed help refresh failed while accessing or validating the configured source.";
  return message.slice(0, 300);
}

function matchingInstalledSources(store: DocumentationStore, target: { product: string; version: string; update: string; locale: string }): readonly DocumentationSource[] {
  return store.listSources().filter((source) => source.kind === "installed-help" && source.product === target.product
    && source.version === target.version && source.update === target.update && source.locale === target.locale);
}

function lastKnownGood(store: DocumentationStore, target: { product: string; version: string; update: string; locale: string }): DocumentationSource | null {
  return matchingInstalledSources(store, target)
    .filter((source) => source.contentDigest && store.listTopics(source.sourceId).length > 0)
    .sort((left, right) => (right.indexedAt ?? "").localeCompare(left.indexedAt ?? ""))[0] ?? null;
}

function removeSupersededInstalledSources(store: DocumentationStore, target: { product: string; version: string; update: string; locale: string }, keepSourceId: string): void {
  for (const source of matchingInstalledSources(store, target)) if (source.sourceId !== keepSourceId) store.removeSource(source.sourceId);
}

function retainLastKnownGood(store: DocumentationStore, source: DocumentationSource, note: string, attemptedAt: string): void {
  const successfulState = source.state === "partial" ? "partial" : source.attributes.lastSuccessfulState === "partial" ? "partial" : "ready";
  store.updateSource(documentationSourceSchema.parse({
    ...source,
    state: "stale",
    statusNote: `Installed help refresh failed; the last known-good local index is retained. ${note}`.slice(0, 500),
    attributes: { ...source.attributes, lastSuccessfulState: successfulState, lastRefreshAttemptAt: attemptedAt, lastRefreshError: note },
  }));
  removeSupersededInstalledSources(store, { product: source.product, version: source.version ?? "", update: source.update ?? "", locale: source.locale }, source.sourceId);
}

export function prepareDocumentationSources(store: DocumentationStore, config: {
  readonly product?: string;
  readonly version?: string;
  readonly update?: string;
  readonly locale?: string;
}): void {
  const product = config.product ?? "STEP 7";
  const version = config.version ?? "V20";
  const update = config.update ?? "Update 7";
  const locale = config.locale ?? "en-US";
  store.replaceSource(createRightsBlockedOnlineSource({ title: "TIA Documentation Portal V20", product, version, update: null, locale, canonicalUrl: "https://docs.tia.siemens.cloud/r/en-us/v20/" }), []);
  if (lastKnownGood(store, { product, version, update, locale })) return;
  for (const source of matchingInstalledSources(store, { product, version, update, locale })) store.removeSource(source.sourceId);
  store.replaceSource(documentationSourceSchema.parse({
    sourceId: digest(`indexing\0${product}\0${version}\0${update}\0${locale}`), kind: "installed-help", authority: "official-documentation",
    title: `${product} installed help ${version} ${update}`, product, version, update, locale, canonicalUrl: null,
    rightsStatus: "local-only", state: "indexing", extractionMethod: "installed-zip-html", contentDigest: null, indexedAt: null,
    statusNote: "Installed help initialization is running in the local host process.", attributes: {},
  }), []);
}

export function initializeDocumentationSources(store: DocumentationStore, config: {
  readonly installedRoot: string;
  readonly packageAllowlist: readonly string[];
  readonly limits?: InstalledHelpLimits;
  readonly product?: string;
  readonly version?: string;
  readonly update?: string;
  readonly locale?: string;
}, now = new Date().toISOString()): void {
  const product = config.product ?? "STEP 7";
  const version = config.version ?? "V20";
  const update = config.update ?? "Update 7";
  const locale = config.locale ?? "en-US";
  const target = { product, version, update, locale };
  const online = createRightsBlockedOnlineSource({ title: "TIA Documentation Portal V20", product, version, update: null, locale, canonicalUrl: "https://docs.tia.siemens.cloud/r/en-us/v20/" });
  store.replaceSource(online, []);
  const previous = lastKnownGood(store, target);

  if (!existsSync(config.installedRoot)) {
    if (previous) { retainLastKnownGood(store, previous, "The configured installed-help root is unavailable.", now); return; }
    const failed = documentationSourceSchema.parse({ sourceId: digest(`missing\0${product}\0${version}\0${update}\0${locale}`), kind: "installed-help", authority: "official-documentation", title: `${product} installed help ${version} ${update}`, product, version, update, locale, canonicalUrl: null, rightsStatus: "local-only", state: "failed", extractionMethod: "installed-zip-html", contentDigest: null, indexedAt: null, statusNote: "The configured installed-help root is unavailable.", attributes: { lastRefreshAttemptAt: now } });
    store.replaceSource(failed, []);
    removeSupersededInstalledSources(store, target, failed.sourceId);
    return;
  }

  try {
    const adapter = new InstalledHelpAdapter({ root: config.installedRoot, product, version, update, locale, packageAllowlist: config.packageAllowlist, ...(config.limits ? { limits: config.limits } : {}) });
    const fingerprint = adapter.fingerprint();
    if (previous?.contentDigest === fingerprint) {
      const restoredState = (previous.attributes.lastSuccessfulState === "partial" ? "partial" : previous.state === "partial" ? "partial" : "ready") satisfies DocumentationSourceState;
      const { lastRefreshAttemptAt: _attempt, lastRefreshError: _error, lastSuccessfulState: _state, ...attributes } = previous.attributes;
      store.updateSource(documentationSourceSchema.parse({ ...previous, state: restoredState, statusNote: restoredState === "partial" ? "Installed help remains indexed to the configured topic limit." : "Installed help index is unchanged and ready locally; redistribution and external-provider use are blocked.", attributes }));
      removeSupersededInstalledSources(store, target, previous.sourceId);
      return;
    }
    const normalized = normalizeDocumentationIngestion(adapter.ingest());
    store.replaceSource(normalized.source, normalized.topics);
    removeSupersededInstalledSources(store, target, normalized.source.sourceId);
  } catch (error) {
    const note = safeFailureNote(error);
    if (previous) { retainLastKnownGood(store, previous, note, now); return; }
    const failed = documentationSourceSchema.parse({ sourceId: digest(`failed\0${product}\0${version}\0${update}\0${locale}`), kind: "installed-help", authority: "official-documentation", title: `${product} installed help ${version} ${update}`, product, version, update, locale, canonicalUrl: null, rightsStatus: "local-only", state: "failed", extractionMethod: "installed-zip-html", contentDigest: null, indexedAt: null, statusNote: `Installed help ingestion failed: ${note}`.slice(0, 500), attributes: { lastRefreshAttemptAt: now } });
    store.replaceSource(failed, []);
    removeSupersededInstalledSources(store, target, failed.sourceId);
  }
}
