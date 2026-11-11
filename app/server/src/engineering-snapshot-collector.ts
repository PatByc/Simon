import type { EngineeringCoverage } from "@simon/contracts";

import type { EngineeringMcpGateway } from "./engineering-mcp-client.js";
import type {
  EngineeringSnapshotCollector,
  SnapshotCollection,
  SnapshotCollectionRequest,
  SnapshotDocumentDraft,
  SnapshotReferenceDraft,
  SnapshotTagTableDraft,
} from "./engineering-snapshot.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function objectValue(record: Record<string, unknown>, name: string): unknown {
  return Object.entries(record).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function records(value: unknown): Record<string, unknown>[] {
  const record = asRecord(value);
  if (!record) return [];
  for (const candidate of Object.values(record)) {
    if (Array.isArray(candidate)) return candidate.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
  }
  return [];
}

function stringValue(record: Record<string, unknown>, name: string): string | null {
  const value = objectValue(record, name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(record: Record<string, unknown>, name: string): number | null {
  const value = objectValue(record, name);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parentPath(engineeringPath: string): string | null {
  const index = engineeringPath.lastIndexOf("/");
  return index > 0 ? engineeringPath.slice(0, index) : null;
}

function itemCount(documents: readonly SnapshotDocumentDraft[], tables: readonly SnapshotTagTableDraft[], references: readonly SnapshotReferenceDraft[]): number {
  return documents.length + tables.length + tables.reduce((count, table) => count + table.tags.length, 0) + references.length;
}

export class EngineeringMcpSnapshotCollector implements EngineeringSnapshotCollector {
  constructor(private readonly gateway: EngineeringMcpGateway) {}

  async collect(request: SnapshotCollectionRequest): Promise<SnapshotCollection> {
    const documents: SnapshotDocumentDraft[] = [...(request.resumeFrom?.documents ?? [])];
    const tagTables: SnapshotTagTableDraft[] = [...(request.resumeFrom?.tagTables ?? [])];
    const references: SnapshotReferenceDraft[] = [...(request.resumeFrom?.references ?? [])];
    const coverage: EngineeringCoverage[] = [];
    const seenDocuments = new Set(documents.map((document) => `${document.kind}\0${document.engineeringPath}`));
    const seenTables = new Set(tagTables.map((table) => table.engineeringPath));
    const seenReferences = new Set(references.map((reference) => `${reference.symbol}\0${reference.sourcePath}\0${reference.targetPath ?? ""}`));

    const tree = await this.gateway.getProjectTree();
    const softwarePaths = [...tree.matchAll(/PlcSoftware:\s*([^\r\n[]+)/g)]
      .flatMap((match) => match[1]?.trim() ? [match[1].trim()] : []);
    if (softwarePaths.length === 0) throw new Error("No PLC software containers were discovered for snapshot collection.");

    for (const softwarePath of softwarePaths) {
      if (request.signal.aborted) throw request.signal.reason ?? new Error("Snapshot collection interrupted.");
      if (itemCount(documents, tagTables, references) >= request.limits.maxObjects) break;
      await this.#collectTags(softwarePath, request, tagTables, seenTables, coverage);
      await this.#collectBlocks(softwarePath, request, documents, seenDocuments, coverage);
      await this.#collectTypes(softwarePath, request, documents, seenDocuments, coverage);
      await this.#collectReferences(softwarePath, request, references, seenReferences, coverage);
    }

    return { documents, tagTables, references, coverage };
  }

  async #collectTags(
    softwarePath: string,
    request: SnapshotCollectionRequest,
    tables: SnapshotTagTableDraft[],
    seen: Set<string>,
    coverage: EngineeringCoverage[],
  ): Promise<void> {
    try {
      const tableResult = await this.gateway.callSnapshotTool("simon_tia_list_tag_tables", {
        softwarePath,
        limit: Math.min(500, request.limits.maxResultsPerQuery),
      });
      const tagResult = await this.gateway.callSnapshotTool("simon_tia_list_tags", {
        softwarePath,
        tablePath: "",
        regexName: "",
        limit: Math.min(1000, request.limits.maxObjects),
      }, 120_000);
      const tagsByTable = new Map<string, SnapshotTagTableDraft["tags"][number][]>();
      for (const tag of records(tagResult)) {
        const tablePath = stringValue(tag, "tablePath");
        const name = stringValue(tag, "name");
        if (!tablePath || !name) continue;
        const values = tagsByTable.get(tablePath) ?? [];
        values.push({
          name,
          dataType: stringValue(tag, "dataType"),
          logicalAddress: stringValue(tag, "logicalAddress"),
          comment: stringValue(tag, "comment"),
          sourceOperation: "tia.tag.list",
          coverage: "complete",
        });
        tagsByTable.set(tablePath, values);
      }
      for (const table of records(tableResult)) {
        const engineeringPath = stringValue(table, "path");
        const name = stringValue(table, "name");
        if (!engineeringPath || !name || seen.has(engineeringPath)) continue;
        const expectedCount = numberValue(table, "tagCount") ?? 0;
        const tags = tagsByTable.get(engineeringPath) ?? [];
        tables.push({
          name,
          engineeringPath,
          tags,
          sourceOperation: "tia.tagTable.list",
          coverage: tags.length === expectedCount ? "complete" : "partial",
        });
        seen.add(engineeringPath);
      }
      const total = numberValue(tagResult, "totalCount") ?? [...tagsByTable.values()].reduce((count, tags) => count + tags.length, 0);
      coverage.push({
        capability: "tia.tag.enumeration",
        state: objectValue(tagResult, "truncated") === true ? "partial" : "complete",
        observedCount: total,
        note: objectValue(tagResult, "truncated") === true ? "PLC tags were truncated by the configured snapshot limit." : "PLC tags were enumerated directly through Openness.",
      });
    } catch {
      coverage.push({ capability: "tia.tag.enumeration", state: "failed", observedCount: 0, note: "PLC tag enumeration failed for one software container." });
    }
  }

  async #collectBlocks(
    softwarePath: string,
    request: SnapshotCollectionRequest,
    documents: SnapshotDocumentDraft[],
    seen: Set<string>,
    coverage: EngineeringCoverage[],
  ): Promise<void> {
    try {
      const result = await this.gateway.callSnapshotTool("simon_tia_find_blocks", { softwarePath, regexName: "" }, 120_000);
      const blocks = records(result).slice(0, request.limits.maxResultsPerQuery);
      let partial = false;
      for (const block of blocks) {
        if (request.signal.aborted || itemCount(documents, [], []) >= request.limits.maxObjects) break;
        const engineeringPath = stringValue(block, "path");
        const name = stringValue(block, "name");
        if (!engineeringPath || !name || seen.has(`block\0${engineeringPath}`)) continue;
        let content = JSON.stringify({ name, engineeringPath });
        let artifactId: string | null = null;
        let itemCoverage: SnapshotDocumentDraft["coverage"] = "partial";
        try {
          const extracted = await this.gateway.extractSource({ kind: "block-xml", softwarePath, engineeringPath });
          const artifact = extracted.artifacts.find((item) => item.format === "xml") ?? extracted.artifacts[0];
          if (artifact) {
            content = new TextDecoder().decode(await this.gateway.readArtifact(artifact.artifactId));
            artifactId = artifact.artifactId;
            itemCoverage = "complete";
          }
        } catch {
          partial = true;
          // Metadata remains useful and is explicitly partial when controlled source extraction is unavailable.
        }
        documents.push({
          kind: "block",
          name,
          engineeringPath,
          parentPath: parentPath(engineeringPath),
          language: stringValue(block, "programmingLanguage"),
          content,
          artifactId,
          attributes: {
            typeName: stringValue(block, "typeName"),
            memoryLayout: stringValue(block, "memoryLayout"),
            isConsistent: objectValue(block, "isConsistent"),
            isKnowHowProtected: objectValue(block, "isKnowHowProtected"),
          },
          sourceOperation: artifactId ? "tia.block.export" : "tia.block.search",
          coverage: itemCoverage,
        });
        seen.add(`block\0${engineeringPath}`);
      }
      coverage.push({
        capability: "tia.block.collection",
        state: partial ? "partial" : "complete",
        observedCount: blocks.length,
        note: blocks.length === request.limits.maxResultsPerQuery ? "Block collection reached the per-query limit." : "PLC block metadata and controlled source exports were collected.",
      });
    } catch {
      coverage.push({ capability: "tia.block.collection", state: "failed", observedCount: 0, note: "PLC block collection failed or exceeded its operation timeout for one software container." });
    }
  }

  async #collectTypes(
    softwarePath: string,
    request: SnapshotCollectionRequest,
    documents: SnapshotDocumentDraft[],
    seen: Set<string>,
    coverage: EngineeringCoverage[],
  ): Promise<void> {
    try {
      const result = await this.gateway.callSnapshotTool("simon_tia_find_plc_types", { softwarePath, regexName: "" }, 120_000);
      const types = records(result).slice(0, request.limits.maxResultsPerQuery);
      for (const type of types) {
        const engineeringPath = stringValue(type, "path");
        const name = stringValue(type, "name");
        if (!engineeringPath || !name || seen.has(`type\0${engineeringPath}`)) continue;
        let content = JSON.stringify({ name, engineeringPath });
        let artifactId: string | null = null;
        let itemCoverage: SnapshotDocumentDraft["coverage"] = "partial";
        try {
          const extracted = await this.gateway.extractSource({ kind: "type-xml", softwarePath, engineeringPath });
          const artifact = extracted.artifacts.find((item) => item.format === "xml") ?? extracted.artifacts[0];
          if (artifact) {
            content = new TextDecoder().decode(await this.gateway.readArtifact(artifact.artifactId));
            artifactId = artifact.artifactId;
            itemCoverage = "complete";
          }
        } catch {
          // Preserve bounded metadata with partial coverage.
        }
        documents.push({
          kind: "type",
          name,
          engineeringPath,
          parentPath: parentPath(engineeringPath),
          language: null,
          content,
          artifactId,
          attributes: {
            typeName: stringValue(type, "typeName"),
            isConsistent: objectValue(type, "isConsistent"),
            isKnowHowProtected: objectValue(type, "isKnowHowProtected"),
          },
          sourceOperation: artifactId ? "tia.type.export" : "tia.type.search",
          coverage: itemCoverage,
        });
        seen.add(`type\0${engineeringPath}`);
      }
      coverage.push({ capability: "tia.type.collection", state: "complete", observedCount: types.length, note: "PLC type metadata and bounded controlled exports were collected." });
    } catch {
      coverage.push({ capability: "tia.type.collection", state: "failed", observedCount: 0, note: "PLC type collection failed for one software container." });
    }
  }

  async #collectReferences(
    softwarePath: string,
    request: SnapshotCollectionRequest,
    references: SnapshotReferenceDraft[],
    seen: Set<string>,
    coverage: EngineeringCoverage[],
  ): Promise<void> {
    try {
      const result = await this.gateway.callSnapshotTool("simon_tia_find_tag_usages", {
        softwarePath,
        tagPattern: ".",
        forceRefresh: request.forceRefresh,
      }, 180_000);
      const items = records(result).slice(0, request.limits.maxResultsPerQuery);
      for (const item of items) {
        const symbol = stringValue(item, "symbol");
        const block = stringValue(item, "block");
        if (!symbol || !block) continue;
        const sourcePath = `${softwarePath}/Program blocks/${block}`;
        const rootName = stringValue(item, "rootName");
        const memberName = stringValue(item, "memberName");
        const targetPath = rootName ? `${rootName}${memberName ? `.${memberName}` : ""}` : null;
        const key = `${symbol}\0${sourcePath}\0${targetPath ?? ""}`;
        if (seen.has(key)) continue;
        references.push({
          symbol,
          sourcePath,
          targetPath,
          context: [stringValue(item, "networkTitle"), stringValue(item, "accessScope")].filter(Boolean).join(" · "),
          sourceOperation: "tia.analysis.tagUsages",
          coverage: "partial",
        });
        seen.add(key);
      }
      coverage.push({
        capability: "tia.reference.collection",
        state: objectValue(result, "items") && items.length === request.limits.maxResultsPerQuery ? "partial" : "complete",
        observedCount: items.length,
        note: "Symbol references are bounded and source group paths may be partial.",
      });
    } catch {
      coverage.push({ capability: "tia.reference.collection", state: "failed", observedCount: 0, note: "Symbol reference collection failed for one software container." });
    }
  }
}
