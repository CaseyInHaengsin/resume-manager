import { db } from "~/db";
import { companies, skills } from "~/db/schema";
import { eq } from "drizzle-orm";

export type TechNode = {
  id: string; // normalized (lowercased, trimmed)
  label: string; // original casing of first occurrence
  count: number; // total number of (company | skill) sources
  companies: { id: number; name: string }[];
  skills: { id: number; category: string; name: string }[];
};

export type TechLink = {
  source: string;
  target: string;
  strength: number;
};

export type TechStackData = {
  nodes: TechNode[];
  links: TechLink[];
};

/** Build the unified tech graph for a user by unioning companies.techStack and skills.items. */
export function buildTechStackGraph(userId: number): TechStackData {
  const userCompanies = db
    .select({
      id: companies.id,
      name: companies.name,
      techStack: companies.techStack,
    })
    .from(companies)
    .where(eq(companies.userId, userId))
    .all();

  const userSkills = db
    .select({
      id: skills.id,
      category: skills.category,
      name: skills.name,
      items: skills.items,
    })
    .from(skills)
    .where(eq(skills.userId, userId))
    .all();

  const techMap = new Map<
    string,
    {
      label: string;
      count: number;
      companies: { id: number; name: string }[];
      skills: { id: number; category: string; name: string }[];
    }
  >();
  const groups: string[][] = []; // each co-occurrence group of normalized techs

  const ingest = (
    rawTechs: string[] | null | undefined,
    source:
      | { kind: "company"; id: number; name: string }
      | {
          kind: "skill";
          id: number;
          category: string;
          name: string;
        },
  ) => {
    if (!rawTechs || rawTechs.length === 0) return;
    const seen = new Set<string>();
    const normTechs: string[] = [];
    for (const t of rawTechs) {
      const trimmed = t.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normTechs.push(key);
      let entry = techMap.get(key);
      if (!entry) {
        entry = { label: trimmed, count: 0, companies: [], skills: [] };
        techMap.set(key, entry);
      }
      entry.count += 1;
      if (source.kind === "company") {
        entry.companies.push({ id: source.id, name: source.name });
      } else {
        entry.skills.push({
          id: source.id,
          category: source.category,
          name: source.name,
        });
      }
    }
    if (normTechs.length > 1) groups.push(normTechs);
  };

  for (const c of userCompanies) {
    ingest(c.techStack as string[] | null, {
      kind: "company",
      id: c.id,
      name: c.name,
    });
  }
  for (const s of userSkills) {
    ingest(s.items as string[] | null, {
      kind: "skill",
      id: s.id,
      category: s.category,
      name: s.name,
    });
  }

  const nodes: TechNode[] = Array.from(techMap.entries()).map(([id, data]) => ({
    id,
    label: data.label,
    count: data.count,
    companies: data.companies,
    skills: data.skills,
  }));

  const linkMap = new Map<string, number>();
  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [a, b] = [group[i], group[j]].sort();
        const k = `${a}::${b}`;
        linkMap.set(k, (linkMap.get(k) ?? 0) + 1);
      }
    }
  }
  const links: TechLink[] = Array.from(linkMap.entries()).map(
    ([k, strength]) => {
      const [source, target] = k.split("::");
      return { source, target, strength };
    },
  );

  return { nodes, links };
}
