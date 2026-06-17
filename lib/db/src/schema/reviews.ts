import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { contractsTable } from "./contracts";

export const reviewsTable = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  sourceContractId: uuid("source_contract_id").references(
    () => contractsTable.id,
    { onDelete: "set null" },
  ),
  findings: jsonb("findings").notNull(),
  filename: text("filename"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
export type InsertReview = typeof reviewsTable.$inferInsert;
