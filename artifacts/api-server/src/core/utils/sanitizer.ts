/* ══════════════════════════════════════════════════════════
   PAYLOAD SANITIZER

   Strips prompt-injection patterns from user-provided strings before
   they reach the model. Length limits are enforced by the Zod schemas
   (`.max()`) before this runs.
══════════════════════════════════════════════════════════ */

const INJECTION_PATTERNS = [
  /ignore (all |previous |above |prior )?instructions?/gi,
  /disregard (all |previous |above |prior )?instructions?/gi,
  /forget (all |previous |above |prior )?instructions?/gi,
  /you are now/gi,
  /act as (a |an )?/gi,
  /system prompt/gi,
  /\[INST\]/gi,
  /<\|system\|>/gi,
  /###\s*(instruction|system|prompt)/gi,
];

export function sanitizeInput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  let sanitized = value.trim();
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[محتوى غير مسموح]");
  }
  return sanitized;
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === "string" ? sanitizeInput(v) : v;
  }
  return out as T;
}
