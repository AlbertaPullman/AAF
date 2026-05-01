import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";

const RESOURCE_ICON_DIR = path.join(env.uploadsDir, "resource-icons");
const RESOURCE_ICON_PUBLIC_PREFIX = "/uploads/resource-icons/";
const MAX_ICON_BYTES = 3 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type ResourceIconUploadResult = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
};

export type ResourcePackAsset = {
  kind: "resourceIcon";
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  dataBase64: string;
};

function parseImageData(input: { dataUrl?: unknown; dataBase64?: unknown; mimeType?: unknown }) {
  const dataUrl = typeof input.dataUrl === "string" ? input.dataUrl.trim() : "";
  if (dataUrl) {
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/=\r\n]+)$/i);
    if (!match) throw new Error("unsupported icon data url");
    const mimeType = match[1].toLowerCase();
    return { mimeType, buffer: Buffer.from(match[2].replace(/\s/g, ""), "base64") };
  }

  const mimeType = typeof input.mimeType === "string" ? input.mimeType.toLowerCase() : "";
  const dataBase64 = typeof input.dataBase64 === "string" ? input.dataBase64.replace(/\s/g, "") : "";
  if (!MIME_TO_EXT[mimeType] || !dataBase64) throw new Error("invalid icon payload");
  return { mimeType, buffer: Buffer.from(dataBase64, "base64") };
}

function assertImagePayload(mimeType: string, buffer: Buffer) {
  if (!MIME_TO_EXT[mimeType]) throw new Error("unsupported icon mime type");
  if (buffer.length <= 0) throw new Error("empty icon file");
  if (buffer.length > MAX_ICON_BYTES) throw new Error("icon file is too large");
}

async function writeIconBuffer(mimeType: string, buffer: Buffer): Promise<ResourceIconUploadResult> {
  assertImagePayload(mimeType, buffer);
  await fs.mkdir(RESOURCE_ICON_DIR, { recursive: true });
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const fileName = `${sha256.slice(0, 32)}${MIME_TO_EXT[mimeType]}`;
  const filePath = path.join(RESOURCE_ICON_DIR, fileName);
  try {
    await fs.writeFile(filePath, buffer, { flag: "wx" });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw error;
  }
  return {
    url: `${RESOURCE_ICON_PUBLIC_PREFIX}${fileName}`,
    fileName,
    mimeType,
    size: buffer.length,
    sha256,
  };
}

export async function saveResourceIconUpload(input: { dataUrl?: unknown; dataBase64?: unknown; mimeType?: unknown }) {
  const parsed = parseImageData(input);
  return writeIconBuffer(parsed.mimeType, parsed.buffer);
}

export function normalizeResourceIconUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const markerIndex = raw.indexOf(RESOURCE_ICON_PUBLIC_PREFIX);
  if (markerIndex < 0) return null;
  const afterPrefix = raw.slice(markerIndex + RESOURCE_ICON_PUBLIC_PREFIX.length).split(/[?#]/)[0] ?? "";
  const fileName = path.basename(decodeURIComponent(afterPrefix));
  if (!fileName || fileName === "." || fileName === "..") return null;
  return `${RESOURCE_ICON_PUBLIC_PREFIX}${fileName}`;
}

function mimeTypeFromFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  const found = Object.entries(MIME_TO_EXT).find(([, candidateExt]) => candidateExt === ext);
  return found?.[0] ?? "application/octet-stream";
}

export async function readResourceIconPackAsset(iconUrl: unknown): Promise<ResourcePackAsset | null> {
  const normalizedUrl = normalizeResourceIconUrl(iconUrl);
  if (!normalizedUrl) return null;
  const fileName = path.basename(normalizedUrl);
  const filePath = path.join(RESOURCE_ICON_DIR, fileName);
  const buffer = await fs.readFile(filePath).catch(() => null);
  if (!buffer) return null;
  return {
    kind: "resourceIcon",
    url: normalizedUrl,
    fileName,
    mimeType: mimeTypeFromFileName(fileName),
    size: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    dataBase64: buffer.toString("base64"),
  };
}

export async function saveResourceIconPackAsset(asset: Record<string, unknown>): Promise<ResourceIconUploadResult | null> {
  if (asset.kind !== "resourceIcon") return null;
  const parsed = parseImageData({ dataBase64: asset.dataBase64, mimeType: asset.mimeType });
  return writeIconBuffer(parsed.mimeType, parsed.buffer);
}