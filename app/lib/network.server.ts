import { and, count, eq, isNotNull } from "drizzle-orm";
import { db } from "~/db";
import { networkContacts } from "~/db/schema";

/** Map of companyId → number of network contacts there, for badges and chips. */
export function contactCountsByCompany(userId: number): Record<number, number> {
  const rows = db
    .select({ companyId: networkContacts.companyId, n: count() })
    .from(networkContacts)
    .where(
      and(
        eq(networkContacts.userId, userId),
        isNotNull(networkContacts.companyId),
      ),
    )
    .groupBy(networkContacts.companyId)
    .all();
  const out: Record<number, number> = {};
  for (const r of rows) if (r.companyId != null) out[r.companyId] = r.n;
  return out;
}
