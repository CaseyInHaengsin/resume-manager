import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOADS_DIR = path.resolve("data/uploads");
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

export function getUploadsDir() {
  return UPLOADS_DIR;
}

export function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function sanitize(name: string): string {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

/**
 * Validate a File from FormData. Returns null if acceptable (empty files skip),
 * a string error message otherwise.
 */
export function validateImage(file: File): string | null {
  if (file.size === 0) return null; // empty upload is a no-op
  if (file.size > MAX_BYTES) return "Image must be 2MB or smaller";
  if (!ALLOWED.has(file.type))
    return "Image must be JPEG, PNG, GIF, WEBP, or SVG";
  return null;
}

/** Persist a validated File to the uploads dir. Returns the public URL path. */
export async function saveUpload(file: File, userId: number): Promise<string> {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const safe = sanitize(file.name || "upload");
  const filename = `u${userId}-${id}-${safe}`;
  const diskPath = path.join(UPLOADS_DIR, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, bytes);
  return `/uploads/${filename}`;
}
