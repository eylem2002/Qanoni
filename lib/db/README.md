# db — Database Package

Shared library providing the PostgreSQL schema and Drizzle ORM instance used by the API server.

---

## What's Inside

```
src/
├── index.ts        Exports the Drizzle db instance (connected via DATABASE_URL)
└── schema/
    └── index.ts    Table definitions, insert schemas, and TypeScript types
```

---

## Current Schema

The database schema is currently empty (tables not yet created). The schema file is scaffolded and ready for table definitions when persistent storage is needed.

The application currently generates contracts statelessly — no contracts or user sessions are stored in the database.

---

## How to Add a Table

1. Create a file in `src/schema/`, e.g. `src/schema/contracts.ts`:

```ts
import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({
  id: true,
});
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
```

2. Re-export it from `src/schema/index.ts`:

```ts
export * from "./contracts";
```

3. Push the schema to the database:

```bash
pnpm --filter @workspace/db run push
```

---

## Connection

The Drizzle instance is configured in `src/index.ts` using the `DATABASE_URL` environment variable (PostgreSQL connection string provided by your environment).

---

## Commands

```bash
# Push schema changes to the dev database
pnpm --filter @workspace/db run push

# Typecheck the package
pnpm --filter @workspace/db run typecheck
```
