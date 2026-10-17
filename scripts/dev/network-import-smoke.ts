/**
 * Smoke-test for app/lib/network-import.server.ts. Runs against a migrated
 * copy of data/resume.db in a temp dir, so the real database is untouched.
 *
 * Usage: pnpm tsx scripts/dev/network-import-smoke.ts <path/to/network.csv>
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../../app/db/schema";
import { companies, networkContacts, users } from "../../app/db/schema";
import {
  importNetwork,
  normalizeName,
  parseNetworkCsv,
} from "../../app/lib/network-import.server";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("usage: network-import-smoke.ts <csv>");
  process.exit(1);
}

// Parser edge cases
{
  const { rows, skipped } = parseNetworkCsv(
    '﻿Name,Company,Headline (if no company listed)\r\n' +
      'A,"Acme, Inc.",\r\n' +
      'B,,"Says ""hi"", twice"\r\n' +
      ',Orphan,\r\n' +
      '\r\n',
  );
  assert.deepEqual(rows, [
    { name: "A", company: "Acme, Inc.", headline: "" },
    { name: "B", company: "", headline: 'Says "hi", twice' },
  ]);
  assert.equal(skipped, 1);
  assert.throws(() => parseNetworkCsv("Foo,Bar\n1,2"), /Name/);
  console.log("ok  parser edge cases");
}

const parsed = parseNetworkCsv(fs.readFileSync(csvPath, "utf8"));
const rows = parsed.rows;
const withCompany = rows.filter((r) => r.company);
const distinct = new Set(withCompany.map((r) => normalizeName(r.company)));
console.log(
  `ok  parsed ${rows.length} rows (${withCompany.length} with company, ${distinct.size} distinct companies, ${parsed.skipped} skipped)`,
);
for (const name of [
  "Easy To Use Products, LLC",
  "Example Partners, P.C.",
]) {
  assert.ok(
    rows.some((r) => r.company === name),
    `quoted company "${name}" not parsed intact`,
  );
}
console.log("ok  quoted companies intact");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "network-smoke-"));
const dbFile = path.join(tmp, "resume.db");
await new Database(path.resolve("data/resume.db")).backup(dbFile);
const sqlite = new Database(dbFile);
sqlite.pragma("foreign_keys = ON");
const tdb = drizzle(sqlite, { schema });
migrate(tdb, { migrationsFolder: "./drizzle" });

try {
  let user = tdb.select().from(users).get();
  if (!user) {
    user = tdb
      .insert(users)
      .values({ username: "smoke", password: "x" })
      .returning()
      .get();
  }
  const userId = user.id;

  const before = new Set(
    tdb
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.userId, userId))
      .all()
      .map((c) => normalizeName(c.name)),
  );
  const expectedNew = [...distinct].filter((k) => !before.has(k)).length;

  const first = importNetwork(userId, rows, tdb);
  console.log("    first import:", first);
  assert.equal(first.companiesCreated, expectedNew);
  assert.equal(first.contactsCreated, new Set(rows.map((r) => normalizeName(r.name))).size);

  const second = importNetwork(userId, rows, tdb);
  console.log("    second import:", second);
  assert.deepEqual(second, {
    contactsCreated: 0,
    contactsUpdated: 0,
    companiesCreated: 0,
  });
  console.log("ok  re-import is a no-op");

  // A hand-assigned company survives re-import when the CSV row has none.
  const unaffiliated = rows.find((r) => !r.company)!;
  const someCompany = tdb
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.userId, userId))
    .get()!;
  tdb.update(networkContacts)
    .set({ companyId: someCompany.id })
    .where(
      and(
        eq(networkContacts.userId, userId),
        eq(networkContacts.name, unaffiliated.name),
      ),
    )
    .run();
  importNetwork(userId, rows, tdb);
  const kept = tdb
    .select({ companyId: networkContacts.companyId })
    .from(networkContacts)
    .where(
      and(
        eq(networkContacts.userId, userId),
        eq(networkContacts.name, unaffiliated.name),
      ),
    )
    .get()!;
  assert.equal(kept.companyId, someCompany.id);
  console.log("ok  hand-assigned company kept on re-import");

  // Case-insensitive company match: "ADOBE" must reuse "Adobe".
  const r = importNetwork(
    userId,
    [{ name: "Smoke Person", company: "  ADOBE ", headline: "" }],
    tdb,
  );
  assert.equal(r.companiesCreated, 0);
  console.log("ok  company match ignores case and whitespace");
} finally {
  sqlite.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log("all checks passed");
