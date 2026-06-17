/* ══════════════════════════════════════════════════════════
   CONTRACTS STORE

   Persistence for generated contracts, scoped to the owning user.
══════════════════════════════════════════════════════════ */

import { and, desc, eq } from "drizzle-orm";
import { db, contractsTable, type Contract } from "@workspace/db";

export async function persistContract(input: {
  userId: string;
  contractType: string;
  generatedText: string;
  inputData: unknown;
  lawArticlesUsed: unknown;
}): Promise<void> {
  await db.insert(contractsTable).values({
    userId: input.userId,
    contractType: input.contractType,
    generatedText: input.generatedText,
    inputData: input.inputData,
    lawArticlesUsed: input.lawArticlesUsed,
  });
}

export async function getContractsForUser(userId: string): Promise<
  Array<{ id: string; contractType: string; createdAt: Date }>
> {
  return db
    .select({
      id: contractsTable.id,
      contractType: contractsTable.contractType,
      createdAt: contractsTable.createdAt,
    })
    .from(contractsTable)
    .where(eq(contractsTable.userId, userId))
    .orderBy(desc(contractsTable.createdAt));
}

export async function getContractForUser(
  userId: string,
  id: string,
): Promise<Contract | undefined> {
  const [row] = await db
    .select()
    .from(contractsTable)
    .where(and(eq(contractsTable.id, id), eq(contractsTable.userId, userId)));
  return row;
}
