/* ══════════════════════════════════════════════════════════
   AUTH LOGIC

   Pure persistence + hashing helpers for accounts. Knows nothing
   about req/res — the controller handles HTTP and session wiring.
══════════════════════════════════════════════════════════ */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

const SALT_ROUNDS = 10;

export async function createUser(
  email: string,
  password: string,
  firmName?: string,
): Promise<User> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash, firmName: firmName ?? null })
    .returning();
  return user;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  return user;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id));
  return user;
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
