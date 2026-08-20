import { requireUserId } from "~/lib/auth.server";
import { getCurrentUser } from "~/lib/auth.server";
import { buildExportPayload } from "~/lib/data-export.server";
import type { Route } from "./+types/api.export";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const user = await getCurrentUser(request);
  const username = user?.username ?? `user-${userId}`;
  const url = new URL(request.url);
  const blankTemplate = url.searchParams.get("blankTemplate") === "1";

  const payload = await buildExportPayload(userId, username, { blankTemplate });
  const body = JSON.stringify(payload, null, 2);

  const date = new Date().toISOString().slice(0, 10);
  const safeName = username.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const filename = blankTemplate
    ? `resume-builder-${safeName}-blank-template-${date}.json`
    : `resume-builder-${safeName}-${date}.json`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
