import app from "./app";
import { logger } from "./core/logger";
import { seedCacheFromDb } from "./services/law/LawService";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  seedCacheFromDb().catch((e) =>
    logger.warn({ err: e }, "Failed to seed law version cache from DB — stale checks will be cold until first RAG fetch"),
  );
});
