import { defineConfig } from "drizzle-kit";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// drizzle-kit's built-in dotenv loader only looks in process.cwd() which is
// lib/db/ when the script is invoked from the monorepo. Load the root .env
// manually so the DATABASE_URL is available without requiring the caller to
// export env vars before running push/generate/migrate.
if (!process.env.DATABASE_URL) {
  // process.cwd() is lib/db/ when drizzle-kit runs the script; ../../ is the monorepo root.
  const rootEnv = resolve(process.cwd(), "../../.env");
  if (existsSync(rootEnv)) {
    for (const line of readFileSync(rootEnv, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = value;
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to the root .env file.");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
