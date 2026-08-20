import type { companies } from "~/db/schema";

/** Parse a company FormData into a DB-ready payload (excluding id/userId/timestamps). */
export function parseCompanyForm(
  form: FormData,
): Omit<
  typeof companies.$inferInsert,
  "id" | "userId" | "createdAt" | "updatedAt"
> & { name: string } {
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const jsonArr = (k: string): string[] => {
    const raw = form.get(k);
    if (typeof raw !== "string" || !raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  };

  const name = str("name");
  if (!name) throw new Response("Company name is required", { status: 400 });

  return {
    name,
    tagline: str("tagline") || null,
    logoUrl: str("logoUrl") || str("existingLogoUrl") || null,
    techStack: jsonArr("techStack"),
    values: str("values") || null,
    culture: str("culture") || null,
    industry: str("industry") || null,
    location: str("location") || null,
    size: str("size") || null,
    recentNews: jsonArr("recentNews"),
    notableProjects: str("notableProjects") || null,
    notes: str("notes") || null,
  };
}
