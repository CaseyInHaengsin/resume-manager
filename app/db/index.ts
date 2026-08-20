import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import path from "node:path";

const dbPath = path.resolve("data/resume.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Fresh-install safety: if a pre-auth database still has legacy rows but no users,
// create a `default`/`changeme` user and attach every orphan row to it so nothing
// is lost. Idempotent — no-op once `users` has any row.
try {
  const userCount = (
    sqlite.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }
  ).c;
  if (userCount === 0) {
    const hasLegacyData = [
      "contact",
      "education",
      "jobs",
      "projects",
      "bullets",
      "summaries",
      "skills",
      "resumes",
    ].some(
      (t) =>
        (
          sqlite.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as {
            c: number;
          }
        ).c > 0,
    );
    if (hasLegacyData) {
      const hash = bcrypt.hashSync("changeme", 10);
      const stmt = sqlite.prepare(
        "INSERT INTO users (username, password) VALUES (?, ?)",
      );
      const info = stmt.run("default", hash);
      const userId = Number(info.lastInsertRowid);
      for (const t of [
        "contact",
        "education",
        "jobs",
        "projects",
        "bullets",
        "summaries",
        "skills",
        "resumes",
      ]) {
        sqlite
          .prepare(`UPDATE ${t} SET user_id = ? WHERE user_id IS NULL`)
          .run(userId);
      }
      console.warn(
        "[auth] Default user 'default' created with password 'changeme'. CHANGE IT IMMEDIATELY via /signup or a password update.",
      );
    }
  }
} catch (e) {
  // users table may not exist yet on a truly fresh clone before migrations run.
  console.warn("[auth bootstrap] skipped:", (e as Error).message);
}

export const db = drizzle(sqlite, { schema });
