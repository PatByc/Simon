import { createHash } from "node:crypto";

import { documentationTopicSchema } from "@simon/contracts";

import type { DocumentationIngestionResult, RawDocumentationTopic } from "./documentation-ingestion.js";
import type { StoredDocumentationTopic } from "./documentation-store.js";

function digest(...values: readonly string[]): string {
  return createHash("sha256").update(values.join("\0")).digest("hex");
}

function decodeEntities(value: string): string {
  const named: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}

export function normalizeDocumentationHtml(html: string): string {
  return decodeEntities(html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|main|aside|li|tr|h[1-6]|table|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function uniqueAliases(topic: RawDocumentationTopic): string[] {
  const values = [topic.metadata.toctitle, topic.metadata.helppackagetitle, topic.metadata.helppackagetitlewithclient]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .filter((value) => value.toLocaleLowerCase("en-US") !== topic.title.toLocaleLowerCase("en-US"));
  return [...new Map(values.map((value) => [value.toLocaleLowerCase("en-US"), value])).values()].sort((a, b) => a.localeCompare(b));
}

function scopeAttributes(topic: RawDocumentationTopic): Readonly<Record<string, unknown>> {
  const scope = topic.metadata.helpscope ?? null;
  const cpuFamilies = scope ? [...new Set([...scope.matchAll(/S7-(1200|1500)(?:T)?/gi)].map((match) => `S7-${match[1]}`))].sort() : [];
  const packageName = topic.metadata.package ?? "";
  const language = /scl/i.test(packageName) ? "SCL" : null;
  return {
    helpId: topic.metadata.id ?? null,
    component: topic.metadata.helpcomponent ?? null,
    documentationScope: topic.metadata.documentationscope ?? null,
    cpuFamilies,
    language,
    package: packageName,
  };
}

export function normalizeDocumentationIngestion(result: DocumentationIngestionResult): {
  readonly source: DocumentationIngestionResult["source"];
  readonly topics: readonly StoredDocumentationTopic[];
} {
  const topics = result.topics.map((raw) => {
    const content = normalizeDocumentationHtml(raw.html);
    const contentDigest = digest(content);
    const topic = documentationTopicSchema.parse({
      topicId: digest(result.source.sourceId, raw.stableKey, contentDigest),
      sourceId: result.source.sourceId,
      stableKey: raw.stableKey,
      title: raw.title.trim().replace(/\s+/g, " "),
      aliases: uniqueAliases(raw),
      product: result.source.product,
      version: result.source.version,
      update: result.source.update,
      locale: result.source.locale,
      contentDigest,
      contentLength: Buffer.byteLength(content, "utf8"),
      excerpt: content.slice(0, 2_000),
      explicitScope: raw.metadata.helpscope?.trim() || null,
      attributes: scopeAttributes(raw),
    });
    return { topic, content };
  }).sort((a, b) => a.topic.stableKey.localeCompare(b.topic.stableKey));
  return { source: result.source, topics };
}
