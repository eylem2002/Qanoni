import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

/* Session store table for connect-pg-simple. The column shape (sid/sess/expire)
   is dictated by that library; we define it here so it is created via Drizzle
   migrations in every environment instead of relying on the library's bundled
   table.sql (which esbuild does not emit into the server bundle). */
export const sessionTable = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);
