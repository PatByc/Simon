import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ArtifactRecord {
  readonly artifactId: string;
  readonly digest: string;
  readonly bytes: number;
  readonly createdAt: string;
  readonly mediaType: string;
}

export class ArtifactStore {
  constructor(readonly root: string, readonly maxBytes = 20_000_000) {}

  async put(content: Uint8Array, mediaType: string): Promise<ArtifactRecord> {
    if (content.byteLength > this.maxBytes) throw new Error("Artifact exceeds configured size limit.");
    await mkdir(this.root, { recursive: true });
    const artifactId = randomUUID();
    const digest = createHash("sha256").update(content).digest("hex");
    await writeFile(path.join(this.root, artifactId), content, { flag: "wx" });
    return { artifactId, digest, bytes: content.byteLength, createdAt: new Date().toISOString(), mediaType };
  }

  async read(artifactId: string): Promise<Uint8Array> {
    if (!/^[0-9a-f-]{36}$/i.test(artifactId)) throw new Error("Invalid artifact identifier.");
    return readFile(path.join(this.root, artifactId));
  }

  async remove(artifactId: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(artifactId)) throw new Error("Invalid artifact identifier.");
    await rm(path.join(this.root, artifactId), { force: true });
  }
}
