import type { RequestHandler } from "express";
import { ForbiddenError } from "../../core/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/* Origin-based CSRF guard. In production (Replit) session cookies use
   SameSite=None (cross-site iframe requirement), removing the browser's
   built-in CSRF protection — so we check Origin/Referer explicitly.

   In local development SameSite=Lax is used (see initApi.ts), which gives
   built-in browser CSRF protection, but we still allow localhost here so the
   Vite dev-server proxy can reach the API without being blocked.

   Non-browser clients (curl, server-to-server, native apps) send no
   Origin/Referer and carry no ambient cookies, so they are not a CSRF vector
   and pass through unconditionally. */
function allowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // Replit deployment domains
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) origins.add(`https://${dev}`);
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    for (const d of domains.split(",")) {
      const t = d.trim();
      if (t) origins.add(`https://${t}`);
    }
  }

  // Custom allowed origin (e.g. a self-hosted domain)
  const custom = process.env.ALLOWED_ORIGIN;
  if (custom) origins.add(custom);

  return origins;
}

function isLocalhost(origin: string): boolean {
  return (
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1")
  );
}

export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");
  const referer = req.get("referer");

  let candidate: string | null = null;
  if (origin) {
    candidate = origin;
  } else if (referer) {
    try {
      candidate = new URL(referer).origin;
    } catch {
      candidate = null;
    }
  }

  if (candidate === null) {
    // No browser-supplied origin → not a CSRF vector.
    next();
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";

  // Allow localhost in any non-production environment.
  if (!isProduction && isLocalhost(candidate)) {
    next();
    return;
  }

  if (allowedOrigins().has(candidate)) {
    next();
    return;
  }

  next(new ForbiddenError("طلب غير مصرّح به من مصدر خارجي"));
};
