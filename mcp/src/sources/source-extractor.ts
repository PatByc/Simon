import { mkdtemp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { ArtifactStore, type ArtifactRecord } from "../artifacts/artifact-store.js";
import type { EngineeringConnector } from "../connectors/connector.js";
import type { McpRequestContext } from "../server/request-context.js";

export const sourceExtractionKindSchema = z.enum(["block-xml", "block-documents", "type-xml"]);
export type SourceExtractionKind = z.infer<typeof sourceExtractionKindSchema>;

export const sourceExtractionRequestSchema = z.object({
  kind: sourceExtractionKindSchema,
  softwarePath: z.string().min(1).max(2048),
  engineeringPath: z.string().min(1).max(2048),
}).strict();
export type SourceExtractionRequest = z.infer<typeof sourceExtractionRequestSchema>;

export interface ExtractedSourceArtifact extends ArtifactRecord {
  readonly format: "xml" | "s7dcl" | "s7res" | "unknown";
}

export interface SourceExtractionResult {
  readonly kind: SourceExtractionKind;
  readonly engineeringPath: string;
  readonly artifacts: readonly ExtractedSourceArtifact[];
  readonly totalBytes: number;
}

export interface SourceExtractorOptions {
  readonly workRoot: string;
  readonly maxFiles?: number;
  readonly maxTotalBytes?: number;
}

interface ExtractionOperation {
  readonly capability: "tia.block.export" | "tia.type.export" | "tia.document.export";
  readonly objectPathKey: "blockPath" | "typePath";
}

const operations: Readonly<Record<SourceExtractionKind, ExtractionOperation>> = {
  "block-xml": { capability: "tia.block.export", objectPathKey: "blockPath" },
  "block-documents": { capability: "tia.document.export", objectPathKey: "blockPath" },
  "type-xml": { capability: "tia.type.export", objectPathKey: "typePath" },
};

function normalizeWorkerPath(kind: SourceExtractionKind, engineeringPath: string): string {
  if (kind === "type-xml") return engineeringPath.replace(/^PLC data types\//i, "");
  return engineeringPath.replace(/^Program blocks\//i, "");
}

function artifactFormat(filePath: string): ExtractedSourceArtifact["format"] {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".xml") return "xml";
  if (extension === ".s7dcl") return "s7dcl";
  if (extension === ".s7res") return "s7res";
  return "unknown";
}

function mediaType(format: ExtractedSourceArtifact["format"]): string {
  if (format === "xml") return "application/xml";
  if (format === "s7dcl") return "text/plain; charset=utf-8";
  if (format === "s7res") return "application/octet-stream";
  return "application/octet-stream";
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const itemPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(itemPath);
      else if (entry.isFile()) files.push(itemPath);
    }
  };
  await visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

export class SourceExtractor {
  readonly #maxFiles: number;
  readonly #maxTotalBytes: number;

  constructor(
    readonly connector: EngineeringConnector,
    readonly artifactStore: ArtifactStore,
    readonly options: SourceExtractorOptions,
  ) {
    this.#maxFiles = options.maxFiles ?? 4;
    this.#maxTotalBytes = options.maxTotalBytes ?? 20_000_000;
    if (!Number.isSafeInteger(this.#maxFiles) || this.#maxFiles < 1) throw new Error("Source extraction maxFiles must be a positive integer.");
    if (!Number.isSafeInteger(this.#maxTotalBytes) || this.#maxTotalBytes < 1) throw new Error("Source extraction maxTotalBytes must be a positive integer.");
  }

  async extract(requestValue: SourceExtractionRequest, context: McpRequestContext): Promise<SourceExtractionResult> {
    const request = sourceExtractionRequestSchema.parse(requestValue);
    if (context.signal.aborted) throw new Error("Source extraction cancelled.");
    const operation = operations[request.kind];
    if (!this.connector.supports(operation.capability)) {
      throw new Error(`Source extraction capability '${operation.capability}' is unavailable.`);
    }

    await mkdir(this.options.workRoot, { recursive: true });
    const workDirectory = await mkdtemp(path.join(this.options.workRoot, "extract-"));
    try {
      await this.connector.invoke(operation.capability, {
        softwarePath: request.softwarePath,
        [operation.objectPathKey]: normalizeWorkerPath(request.kind, request.engineeringPath),
        exportPath: workDirectory,
        preservePath: false,
      }, context);
      if (context.signal.aborted) throw new Error("Source extraction cancelled.");

      const files = await listFiles(workDirectory);
      if (files.length === 0) throw new Error("TIA source extraction produced no files.");
      if (files.length > this.#maxFiles) throw new Error("TIA source extraction exceeded the file-count limit.");

      let totalBytes = 0;
      const contents: Array<{ readonly content: Uint8Array; readonly format: ExtractedSourceArtifact["format"] }> = [];
      for (const filePath of files) {
        const info = await stat(filePath);
        totalBytes += info.size;
        if (totalBytes > this.#maxTotalBytes) throw new Error("TIA source extraction exceeded the total-byte limit.");
        contents.push({ content: await readFile(filePath), format: artifactFormat(filePath) });
      }

      const artifacts: ExtractedSourceArtifact[] = [];
      try {
        for (const item of contents) {
          const stored = await this.artifactStore.put(item.content, mediaType(item.format));
          artifacts.push({ ...stored, format: item.format });
        }
      } catch (error) {
        await Promise.all(artifacts.map((artifact) => this.artifactStore.remove(artifact.artifactId)));
        throw error;
      }

      return { kind: request.kind, engineeringPath: request.engineeringPath, artifacts, totalBytes };
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  }
}
