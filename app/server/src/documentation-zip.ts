import { inflateRawSync } from "node:zlib";

export interface ZipLimits {
  readonly maxEntries: number;
  readonly maxCompressedBytes: number;
  readonly maxUncompressedBytes: number;
  readonly maxEntryBytes: number;
  readonly maxCompressionRatio: number;
}

export interface ZipEntry {
  readonly name: string;
  readonly content: Buffer;
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

function safeName(name: string): boolean {
  return name.length > 0 && name.length <= 2_000 && !name.includes("\\")
    && !name.startsWith("/") && !/^[a-z]:/i.test(name)
    && !name.split("/").some((part) => part === ".." || part === "");
}

export function readBoundedZip(buffer: Buffer, limits: ZipLimits): readonly ZipEntry[] {
  if (buffer.length > limits.maxCompressedBytes) throw new Error("ZIP exceeds the compressed byte limit.");
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory record was not found.");
  const disk = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entryCount === 0xffff) throw new Error("Multi-disk and ZIP64 archives are not supported.");
  if (entryCount > limits.maxEntries) throw new Error("ZIP exceeds the entry-count limit.");
  if (centralOffset + centralSize > eocd) throw new Error("ZIP central directory is outside the archive bounds.");

  const entries: ZipEntry[] = [];
  let totalUncompressed = 0;
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL) throw new Error("Invalid ZIP central-directory entry.");
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > buffer.length) throw new Error("ZIP central-directory entry exceeds archive bounds.");
    const encoding: BufferEncoding = flags & 0x800 ? "utf8" : "latin1";
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString(encoding).replaceAll("\\", "/");
    offset = end;
    if (name.endsWith("/")) continue;
    if (!safeName(name)) throw new Error(`ZIP contains an unsafe entry name at index ${index}.`);
    if (flags & 0x1) throw new Error("Encrypted ZIP entries are not supported.");
    if (method !== 0 && method !== 8) throw new Error(`Unsupported ZIP compression method: ${method}.`);
    if (uncompressedSize > limits.maxEntryBytes) throw new Error("ZIP entry exceeds the per-entry byte limit.");
    if (compressedSize === 0 && uncompressedSize > 0) throw new Error("ZIP entry has an invalid compression size.");
    if (compressedSize > 0 && uncompressedSize / compressedSize > limits.maxCompressionRatio) throw new Error("ZIP entry exceeds the compression-ratio limit.");
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.maxUncompressedBytes) throw new Error("ZIP exceeds the uncompressed byte limit.");

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL) throw new Error("Invalid ZIP local-file header.");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw new Error("ZIP entry data exceeds archive bounds.");
    const compressed = buffer.subarray(dataStart, dataEnd);
    const content = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: limits.maxEntryBytes });
    if (content.length !== uncompressedSize) throw new Error("ZIP entry size does not match the central directory.");
    entries.push({ name, content });
  }
  return entries;
}
