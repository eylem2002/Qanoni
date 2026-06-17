import type { RequestHandler } from "express";
import { ForbiddenError } from "../../core/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/* Origin-based CSRF guard. Session cookies use SameSite=None (required so the
   cookie is sent inside Replit's cross-site preview iframe), which removes the
   browser's built-in CSRF protection. We compensate by verifying the Origin
   (or Referer) of every state-changing request against the app's own origins.

   A browser always attaches Origin to cross-site POSTs, so a forged request
   from an attacker page is rejected. Non-browser clients (curl, server-to-server,
   native apps) send no Origin/Referer and carry no ambient cookies, so they are
   not a CSRF vector and are allowed through. */
function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) origins.add(`https://${dev}`);
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    for (const d of domains.split(",")) {
      const t = d.trim();
      if (t) origins.add(`https://${t}`);
    }
  }
  return origins;
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
    // No browser-supplied origin context → not a CSRF vector.
    next();
    return;
  }

  if (allowedOrigins().has(candidate)) {
    next();
    return;
  }

  next(new ForbiddenError("طلب غير مصرّح به من مصدر خارجي"));
};
