/* ══════════════════════════════════════════════════════════
   REVIEW STORE

   Persistence for contract reviews, scoped to the owning user.
══════════════════════════════════════════════════════════ */

import { and, desc, eq } from "drizzle-orm";
import { db, reviewsTable, type Review } from "@workspace/db";

export async function persistReview(input: {
  userId: string;
  findings: unknown;
  filename?: string;
}): Promise<string> {
  const [row] = await db
    .insert(reviewsTable)
    .values({
      userId: input.userId,
      findings: input.findings,
      filename: input.filename ?? null,
    })
    .returning({ id: reviewsTable.id });
  return row.id;
}

export async function getReviewsForUser(userId: string): Promise<
  Array<{ id: string; filename: string | null; createdAt: Date }>
> {
  return db
    .select({
      id: reviewsTable.id,
      filename: reviewsTable.filename,
      createdAt: reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.userId, userId))
    .orderBy(desc(reviewsTable.createdAt));
}

export async function getReviewForUser(
  userId: string,
  id: string,
): Promise<Review | undefined> {
  const [row] = await db
    .select()
    .from(reviewsTable)
    .where(and(eq(reviewsTable.id, id), eq(reviewsTable.userId, userId)));
  return row;
}
