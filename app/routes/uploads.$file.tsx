import { readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { requireUserId } from "~/lib/auth.server";
import {
  getContentType,
  getUploadsDir,
} from "~/lib/uploads.server";
import type { Route } from "./+types/uploads.$file";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserId(request);
  const filename = params.file;
  // Prevent path traversal
  if (!filename || filename.includes("/") || filename.includes("..")) {
    throw new Response("Bad request", { status: 400 });
  }
  const diskPath = path.join(getUploadsDir(), filename);
  if (!existsSync(diskPath)) {
    throw new Response("Not found", { status: 404 });
  }
  const bytes = await readFile(diskPath);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": getContentType(filename),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
