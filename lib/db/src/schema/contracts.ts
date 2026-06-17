import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const contractsTable = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  contractType: text("contract_type").notNull(),
  generatedText: text("generated_text").notNull(),
  inputData: jsonb("input_data"),
  lawArticlesUsed: jsonb("law_articles_used"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Contract = typeof contractsTable.$inferSelect;
export type InsertContract = typeof contractsTable.$inferInsert;
