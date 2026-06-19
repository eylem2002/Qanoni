import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const lawNotificationsTable = pgTable("law_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractType: text("contract_type").notNull(),
  previousVersionIds: jsonb("previous_version_ids").notNull().$type<string[]>(),
  newVersionIds: jsonb("new_version_ids").notNull().$type<string[]>(),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
});

export type LawNotification = typeof lawNotificationsTable.$inferSelect;
