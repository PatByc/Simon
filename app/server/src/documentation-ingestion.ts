import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

import { documentationSourceSchema, type DocumentationSource } from "@simon/contracts";

import { readBoundedZip, type ZipLimits } from "./documentation-zip.js";

export interface RawDocumentationTopic {
  readonly stableKey: string;
  readonly title: string;
  readonly html: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface DocumentationIngestionResult {
  readonly source: DocumentationSource;
  readonly topics: readonly RawDocumentationTopic[];
  readonly partial: boolean;
}

export interface InstalledHelpLimits extends ZipLimits {
  readonly maxPackages: number;
  readonly maxTopics: number;
  readonly maxTotalCompressedBytes: number;
  readonly maxDurationMs: number;
}

export const DEFAULT_INSTALLED_HELP_LIMITS: InstalledHelpLimits = Object.freeze({
  maxPackages: 8,
  maxEntries: 5_000,
  maxTopics: 3_000,
  maxCompressedBytes: 16_000_000,
  maxTotalCompressedBytes: 32_000_000,
  maxUncompressedBytes: 120_000_000,
  maxEntryBytes: 2_000_000,
  maxCompressionRatio: 100,
  maxDurationMs: 60_000,
});

function digest(...values: readonly (string | Buffer)[]): string {
  const hash = createHash("sha256");
  for (const value of values) hash.update(value).update("\0");
  return hash.digest("hex");
}

function decodeEntities(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function parseHtmlMetadata(html: string): { title: string; metadata: Readonly<Record<string, string>> } {
  const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "");
  const metadata: Record<string, string> = {};
  for (const match of html.matchAll(/<meta\b([^>]+)>/gi)) {
    const attributes: Record<string, string> = {};
    for (const attribute of (match[1] ?? "").matchAll(/([\w.:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
      const key = attribute[1];
      const value = attribute[3];
      if (key !== undefined && value !== undefined) attributes[key.toLowerCase()] = decodeEntities(value);
    }
    const name = attributes.name?.toLowerCase();
    if (name?.startsWith("siemens.tiahelp.") && attributes.content !== undefined) metadata[name.slice("siemens.tiahelp.".length)] = attributes.content;
  }
  return { title: title || metadata.toctitle || metadata.helppackagetitle || "Untitled help topic", metadata };
}

export class InstalledHelpAdapter {
  private readonly root: string;
  constructor(private readonly config: {
    readonly root: string;
    readonly product: string;
    readonly version: string;
    readonly update: string;
    readonly locale: string;
    readonly packageAllowlist: readonly string[];
    readonly limits?: InstalledHelpLimits;
  }) {
    this.root = realpathSync(config.root);
    if (config.packageAllowlist.length === 0) throw new Error("Installed help package allowlist cannot be empty.");
    if (config.packageAllowlist.some((name) => basename(name) !== name || !name.toLowerCase().endsWith(".zip"))) {
      throw new Error("Installed help package allowlist must contain ZIP basenames only.");
    }
  }

  ingest(): DocumentationIngestionResult {
    const limits = this.config.limits ?? DEFAULT_INSTALLED_HELP_LIMITS;
    if (this.config.packageAllowlist.length > limits.maxPackages) throw new Error("Installed help package allowlist exceeds the package limit.");
    const started = Date.now();
    const topics: RawDocumentationTopic[] = [];
    const archiveBuffers: Buffer[] = [];
    let totalCompressed = 0;
    let partial = false;

    for (const packageName of [...this.config.packageAllowlist].sort()) {
      if (Date.now() - started > limits.maxDurationMs) throw new Error("Installed help ingestion exceeded the duration limit.");
      const packagePath = realpathSync(join(this.root, packageName));
      const location = relative(this.root, packagePath);
      if (location.startsWith(`..${sep}`) || location === "..") throw new Error("Installed help package escaped the configured root.");
      const archive = readFileSync(packagePath);
      totalCompressed += archive.length;
      if (totalCompressed > limits.maxTotalCompressedBytes) throw new Error("Installed help packages exceed the total compressed byte limit.");
      archiveBuffers.push(archive);
      for (const entry of readBoundedZip(archive, limits)) {
        if (!/\.html?$/i.test(entry.name)) continue;
        if (topics.length >= limits.maxTopics) { partial = true; break; }
        const html = entry.content.toString("utf8");
        const parsed = parseHtmlMetadata(html);
        topics.push({
          stableKey: `${packageName}/${entry.name}`,
          title: parsed.title,
          html,
          metadata: { ...parsed.metadata, package: packageName, entry: entry.name },
        });
      }
      if (partial) break;
    }

    const contentDigest = digest(...archiveBuffers);
    const sourceId = digest("installed-help", this.config.product, this.config.version, this.config.update, this.config.locale, contentDigest);
    const now = new Date().toISOString();
    const source = documentationSourceSchema.parse({
      sourceId,
      kind: "installed-help",
      authority: "official-documentation",
      title: `${this.config.product} installed help ${this.config.version} ${this.config.update}`,
      product: this.config.product,
      version: this.config.version,
      update: this.config.update,
      locale: this.config.locale,
      canonicalUrl: null,
      rightsStatus: "local-only",
      state: partial ? "partial" : "ready",
      extractionMethod: "installed-zip-html",
      contentDigest,
      indexedAt: now,
      statusNote: partial ? "Installed help was indexed to the configured topic limit." : "Installed help is indexed locally; redistribution and external-provider use are blocked.",
      attributes: { packageCount: archiveBuffers.length, topicCount: topics.length, packageNames: [...this.config.packageAllowlist].sort() },
    });
    return { source, topics, partial };
  }
}

export function createRightsBlockedOnlineSource(input: {
  readonly title: string;
  readonly product: string;
  readonly version: string | null;
  readonly update: string | null;
  readonly locale: string;
  readonly canonicalUrl: string;
}): DocumentationSource {
  return documentationSourceSchema.parse({
    sourceId: digest("official-online", input.canonicalUrl, input.product, input.version ?? "", input.update ?? "", input.locale),
    kind: "official-online",
    authority: "official-documentation",
    title: input.title,
    product: input.product,
    version: input.version,
    update: input.update,
    locale: input.locale,
    canonicalUrl: input.canonicalUrl,
    rightsStatus: "blocked",
    state: "blocked",
    extractionMethod: "not-ingested-rights-blocked",
    contentDigest: null,
    indexedAt: null,
    statusNote: "Automated online ingestion is disabled until separately verified rights are recorded.",
    attributes: {},
  });
}
