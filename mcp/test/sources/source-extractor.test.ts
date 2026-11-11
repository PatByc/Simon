import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ArtifactStore } from "../../src/artifacts/artifact-store.js";
import type { ConnectorCapability, ConnectorIdentity, EngineeringConnector } from "../../src/connectors/connector.js";
import { createRequestContext } from "../../src/server/request-context.js";
import { SourceExtractor, sourceExtractionRequestSchema } from "../../src/sources/source-extractor.js";

class ExportingConnector implements EngineeringConnector {
  readonly identity: ConnectorIdentity = { kind: "test", version: "1", implementation: "source-export-test" };
  readonly invocations: Array<{ capability: string; input: Record<string, unknown> }> = [];

  listCapabilities(): readonly ConnectorCapability[] {
    return ["tia.block.export", "tia.type.export", "tia.document.export"].map((name) => ({ name, available: true }));
  }

  supports(capability: string): boolean {
    return this.listCapabilities().some((item) => item.name === capability);
  }

  async invoke<TInput, TOutput>(capability: string, input: TInput): Promise<TOutput> {
    const values = input as Record<string, unknown>;
    this.invocations.push({ capability, input: values });
    const exportPath = values.exportPath;
    if (typeof exportPath !== "string") throw new Error("Missing generated export path.");
    if (capability === "tia.document.export") {
      await writeFile(path.join(exportPath, "source.s7dcl"), "FUNCTION_BLOCK Demo");
      await writeFile(path.join(exportPath, "source.s7res"), new Uint8Array([1, 2, 3]));
    } else {
      await writeFile(path.join(exportPath, "source.xml"), "<Document />");
    }
    return {} as TOutput;
  }

  async close(): Promise<void> {}
}

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createHarness() {
  const root = await mkdtemp(path.join(os.tmpdir(), "simon-source-extractor-"));
  temporaryRoots.push(root);
  const connector = new ExportingConnector();
  const artifacts = new ArtifactStore(path.join(root, "artifacts"), 1024);
  const extractor = new SourceExtractor(connector, artifacts, { workRoot: path.join(root, "work"), maxTotalBytes: 1024 });
  return { root, connector, artifacts, extractor };
}

describe("SourceExtractor", () => {
  it("extracts block XML through an internal generated directory and returns only opaque artifact metadata", async () => {
    const { root, connector, artifacts, extractor } = await createHarness();
    const result = await extractor.extract({
      kind: "block-xml",
      softwarePath: "PLC_1",
      engineeringPath: "Program blocks/Area/Demo",
    }, createRequestContext());

    expect(connector.invocations).toHaveLength(1);
    expect(connector.invocations[0]).toMatchObject({
      capability: "tia.block.export",
      input: { softwarePath: "PLC_1", blockPath: "Area/Demo", preservePath: false },
    });
    expect(connector.invocations[0]?.input.exportPath).toEqual(expect.stringContaining(path.join(root, "work")));
    expect(result).toMatchObject({ kind: "block-xml", engineeringPath: "Program blocks/Area/Demo", totalBytes: 12 });
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toMatchObject({ format: "xml", mediaType: "application/xml", bytes: 12 });
    expect(Object.keys(result)).not.toContain("exportPath");
    expect(new TextDecoder().decode(await artifacts.read(result.artifacts[0]!.artifactId))).toBe("<Document />");
    expect(await readdir(path.join(root, "work"))).toEqual([]);
  });

  it("stores both V20 document outputs and normalizes type paths", async () => {
    const { connector, extractor } = await createHarness();
    const documents = await extractor.extract({
      kind: "block-documents",
      softwarePath: "PLC_1",
      engineeringPath: "Program blocks/Demo",
    }, createRequestContext());
    const type = await extractor.extract({
      kind: "type-xml",
      softwarePath: "PLC_1",
      engineeringPath: "PLC data types/Area/DemoType",
    }, createRequestContext());

    expect(documents.artifacts.map((item) => item.format)).toEqual(["s7dcl", "s7res"]);
    expect(connector.invocations[1]).toMatchObject({ capability: "tia.type.export", input: { typePath: "Area/DemoType" } });
    expect(type.artifacts[0]?.format).toBe("xml");
  });

  it("rejects caller-selected paths and enforces extraction byte limits", async () => {
    expect(() => sourceExtractionRequestSchema.parse({
      kind: "block-xml",
      softwarePath: "PLC_1",
      engineeringPath: "Demo",
      exportPath: "C:/caller-selected",
    })).toThrow();

    const root = await mkdtemp(path.join(os.tmpdir(), "simon-source-extractor-limit-"));
    temporaryRoots.push(root);
    const connector = new ExportingConnector();
    const extractor = new SourceExtractor(connector, new ArtifactStore(path.join(root, "artifacts"), 1024), {
      workRoot: path.join(root, "work"),
      maxTotalBytes: 2,
    });
    await expect(extractor.extract({ kind: "block-xml", softwarePath: "PLC_1", engineeringPath: "Demo" }, createRequestContext()))
      .rejects.toThrow(/total-byte limit/);
    expect(await readdir(path.join(root, "work"))).toEqual([]);
  });
});
