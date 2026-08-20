/**
 * Seed the SQLite database from resume_data.yaml.
 *
 * Usage:
 *   npx tsx scripts/seed.ts [path/to/resume_data.yaml] [--user=<username>]
 *
 * All data is attached to the specified user (default: "default"). The user row
 * must already exist (created by a signup flow or the migration bootstrap).
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../app/db/schema";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import path from "node:path";

const args = process.argv.slice(2);
const userArg = args.find((a) => a.startsWith("--user="));
const username = userArg ? userArg.slice("--user=".length) : "default";
const positional = args.filter((a) => !a.startsWith("--"));

const yamlPath =
  positional[0] ||
  path.resolve(
    __dirname,
    "../../../python/resume-builder/data/resume_data.yaml",
  );

console.log(`Reading resume data from: ${yamlPath}`);
console.log(`Seeding for user: ${username}`);
const raw = readFileSync(yamlPath, "utf-8");
const data = parse(raw);

const dbPath = path.resolve("data/resume.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

const user = db
  .select()
  .from(schema.users)
  .where(eq(schema.users.username, username))
  .get();
if (!user) {
  console.error(
    `User '${username}' does not exist. Create it first via /signup or pass a valid --user.`,
  );
  process.exit(1);
}
const userId = user.id;

// Clear existing data for THIS user only (reverse FK order)
const deleteForUser = sqlite.transaction(() => {
  sqlite
    .prepare(
      `DELETE FROM resume_skills WHERE resume_id IN (SELECT id FROM resumes WHERE user_id = ?)`,
    )
    .run(userId);
  sqlite
    .prepare(
      `DELETE FROM resume_bullets WHERE resume_id IN (SELECT id FROM resumes WHERE user_id = ?)`,
    )
    .run(userId);
  sqlite
    .prepare(
      `DELETE FROM resume_projects WHERE resume_id IN (SELECT id FROM resumes WHERE user_id = ?)`,
    )
    .run(userId);
  sqlite
    .prepare(
      `DELETE FROM resume_jobs WHERE resume_id IN (SELECT id FROM resumes WHERE user_id = ?)`,
    )
    .run(userId);
  for (const t of [
    "resumes",
    "skills",
    "summaries",
    "bullets",
    "projects",
    "jobs",
    "education",
    "contact",
  ]) {
    sqlite.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
  }
});
deleteForUser();

// ── Contact ──
const c = data.contact;
db.insert(schema.contact)
  .values({
    userId,
    name: c.name,
    phone: c.phone || null,
    email: c.email,
    linkedin: c.linkedin || null,
    github: c.github || null,
  })
  .run();
console.log("Seeded contact");

// ── Education ──
const edu = data.education;
db.insert(schema.education)
  .values({
    userId,
    school: edu.school,
    degrees: edu.degrees,
  })
  .run();
console.log("Seeded education");

// ── Summaries ──
const summaryEntries = Object.entries(data.summary_templates || {});
for (const [name, text] of summaryEntries) {
  db.insert(schema.summaries)
    .values({
      userId,
      name,
      text: (text as string).trim(),
    })
    .run();
}
console.log(`Seeded ${summaryEntries.length} summaries`);

// ── Jobs + Bullets ──
let totalBullets = 0;
for (let ji = 0; ji < (data.jobs || []).length; ji++) {
  const job = data.jobs[ji];
  const inserted = db
    .insert(schema.jobs)
    .values({
      userId,
      title: job.title,
      company: job.company,
      dates: job.dates,
      location: job.location,
      sortOrder: ji,
    })
    .returning()
    .get();

  for (let bi = 0; bi < (job.bullets || []).length; bi++) {
    const bullet = job.bullets[bi];
    db.insert(schema.bullets)
      .values({
        userId,
        parentType: "job",
        parentId: inserted.id,
        text: bullet.text,
        tags: bullet.tags || [],
        priority: bullet.priority ?? 2,
        sortOrder: bi,
      })
      .run();
    totalBullets++;
  }
}
console.log(
  `Seeded ${data.jobs?.length || 0} jobs with ${totalBullets} bullets`,
);

// ── Projects + Bullets ──
let projectBullets = 0;
for (let pi = 0; pi < (data.projects || []).length; pi++) {
  const project = data.projects[pi];
  const inserted = db
    .insert(schema.projects)
    .values({
      userId,
      name: project.name,
      dates: project.dates,
      tech: project.tech,
      sortOrder: pi,
    })
    .returning()
    .get();

  for (let bi = 0; bi < (project.bullets || []).length; bi++) {
    const bullet = project.bullets[bi];
    db.insert(schema.bullets)
      .values({
        userId,
        parentType: "project",
        parentId: inserted.id,
        text: bullet.text,
        tags: bullet.tags || [],
        priority: bullet.priority ?? 2,
        sortOrder: bi,
      })
      .run();
    projectBullets++;
  }
}
console.log(
  `Seeded ${data.projects?.length || 0} projects with ${projectBullets} bullets`,
);

// ── Skills ──
const categoryDisplayNames: Record<string, string> = {
  languages: "Languages",
  frameworks: "Frameworks",
  data_auth: "Data/Auth",
  infrastructure: "Infrastructure",
};

let skillCount = 0;
const skillCategories = ["languages", "frameworks"] as const;
for (const category of skillCategories) {
  const variants = data.skills?.[category] || {};
  let sortOrder = 0;
  for (const [variantName, items] of Object.entries(variants)) {
    db.insert(schema.skills)
      .values({
        userId,
        category: categoryDisplayNames[category] || category,
        name: variantName,
        items: items as string[],
        sortOrder: sortOrder++,
      })
      .run();
    skillCount++;
  }
}

const singleCategories = ["data_auth", "infrastructure"] as const;
for (const category of singleCategories) {
  const items = data.skills?.[category];
  if (items) {
    db.insert(schema.skills)
      .values({
        userId,
        category: categoryDisplayNames[category] || category,
        name: "default",
        items: items as string[],
        sortOrder: 0,
      })
      .run();
    skillCount++;
  }
}
console.log(`Seeded ${skillCount} skill rows`);

console.log("\nDone! Database at:", dbPath);
