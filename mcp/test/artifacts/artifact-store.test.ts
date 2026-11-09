import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ArtifactStore } from "../../src/artifacts/artifact-store.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("artifact store", () => {
  it("returns opaque IDs and digests without exposing paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "simon-mcp-"));
    roots.push(root);
    const store = new ArtifactStore(root);
    const record = await store.put(Buffer.from("<xml />"), "application/xml");
    expect(record.artifactId).not.toContain(root);
    expect(record.digest).toHaveLength(64);
    await expect(store.read(record.artifactId)).resolves.toEqual(Buffer.from("<xml />"));
  });

  it("enforces artifact size limits", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "simon-mcp-"));
    roots.push(root);
    await expect(new ArtifactStore(root, 2).put(Buffer.from("long"), "text/plain")).rejects.toThrow(/size limit/);
  });
});
