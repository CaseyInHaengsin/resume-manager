import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as appDb } from "~/db";
import * as schema from "~/db/schema";
import { companies, networkContacts } from "~/db/schema";

export class NetworkImportError extends Error {}

export type NetworkRow = { name: string; company: string; headline: string };

export type NetworkImportResult = {
  contactsCreated: number;
  contactsUpdated: number;
  companiesCreated: number;
  skipped: number;
};

/** Case- and whitespace-insensitive key used to match companies and contacts. */
export function normalizeName(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

// RFC 4180: quoted fields may contain commas, newlines, and "" escapes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Parses a network CSV with a header row containing `Name` and `Company`
 * columns, plus an optional column whose header starts with `Headline`.
 * Rows without a name are dropped and counted in `skipped`.
 */
export function parseNetworkCsv(text: string): {
  rows: NetworkRow[];
  skipped: number;
} {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new NetworkImportError("File is empty");

  const cols = header.map((h) => h.trim().toLowerCase());
  const nameIdx = cols.indexOf("name");
  const companyIdx = cols.indexOf("company");
  const headlineIdx = cols.findIndex((c) => c.startsWith("headline"));
  if (nameIdx < 0 || companyIdx < 0)
    throw new NetworkImportError(
      "CSV must have 'Name' and 'Company' header columns",
    );

  const rows: NetworkRow[] = [];
  let skipped = 0;
  for (const r of body) {
    if (r.every((c) => c.trim() === "")) continue; // blank line
    const name = (r[nameIdx] ?? "").trim();
    if (!name) {
      skipped++;
      continue;
    }
    rows.push({
      name,
      company: (r[companyIdx] ?? "").trim(),
      headline: headlineIdx >= 0 ? (r[headlineIdx] ?? "").trim() : "",
    });
  }
  return { rows, skipped };
}

/**
 * Additive merge: creates missing companies, inserts new contacts, and updates
 * existing contacts (matched by name) only where the CSV has a value, so a
 * company assigned by hand survives a re-import. Never deletes.
 */
export function importNetwork(
  userId: number,
  rows: NetworkRow[],
  database: BetterSQLite3Database<typeof schema> = appDb,
): Omit<NetworkImportResult, "skipped"> {
  const now = new Date().toISOString();

  return database.transaction((tx) => {
    const companyIds = new Map<string, number>();
    for (const c of tx
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.userId, userId))
      .all()) {
      const key = normalizeName(c.name);
      if (!companyIds.has(key)) companyIds.set(key, c.id);
    }

    const existing = new Map<
      string,
      { id: number; companyId: number | null; headline: string | null }
    >();
    for (const c of tx
      .select({
        id: networkContacts.id,
        name: networkContacts.name,
        companyId: networkContacts.companyId,
        headline: networkContacts.headline,
      })
      .from(networkContacts)
      .where(eq(networkContacts.userId, userId))
      .all()) {
      existing.set(normalizeName(c.name), c);
    }

    let companiesCreated = 0;
    let contactsCreated = 0;
    let contactsUpdated = 0;

    for (const row of rows) {
      let companyId: number | null = null;
      if (row.company) {
        const key = normalizeName(row.company);
        companyId = companyIds.get(key) ?? null;
        if (companyId == null) {
          companyId = tx
            .insert(companies)
            .values({
              userId,
              name: row.company.replace(/\s+/g, " "),
              createdAt: now,
              updatedAt: now,
            })
            .returning({ id: companies.id })
            .get().id;
          companyIds.set(key, companyId);
          companiesCreated++;
        }
      }
      const headline = row.headline || null;

      const key = normalizeName(row.name);
      const prior = existing.get(key);
      if (!prior) {
        const created = tx
          .insert(networkContacts)
          .values({
            userId,
            companyId,
            name: row.name,
            headline,
            source: "linkedin_csv",
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: networkContacts.id })
          .get();
        existing.set(key, { id: created.id, companyId, headline });
        contactsCreated++;
        continue;
      }

      const patch: { companyId?: number; headline?: string } = {};
      if (companyId != null && companyId !== prior.companyId)
        patch.companyId = companyId;
      if (headline && headline !== prior.headline) patch.headline = headline;
      if (Object.keys(patch).length === 0) continue;

      tx.update(networkContacts)
        .set({ ...patch, updatedAt: now })
        .where(eq(networkContacts.id, prior.id))
        .run();
      Object.assign(prior, patch);
      contactsUpdated++;
    }

    return { contactsCreated, contactsUpdated, companiesCreated };
  });
}
