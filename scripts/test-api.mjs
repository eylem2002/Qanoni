#!/usr/bin/env node
/**
 * End-to-end API test suite for قانوني AI
 * Run: node --env-file=.env scripts/test-api.mjs
 *
 * Tests every endpoint: auth, contracts (streaming), review, export, admin.
 * Cleans up the test user from the DB after all tests complete.
 */

import { execSync } from "node:child_process";

const BASE = process.env.API_URL ?? "http://localhost:5001/api";
const TEST_EMAIL = `test-${Date.now()}@qanooni-test.local`;
const TEST_PASSWORD = "TestPassword999!";

let sessionCookie = "";
let savedContractId = null;
let savedReviewId = null;
let generatedContractText = null;

const results = [];
let passed = 0, failed = 0, skipped = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(icon, label, detail = "") {
  const detail_str = detail ? `  →  ${detail}` : "";
  console.log(`  ${icon} ${label}${detail_str}`);
}

function pass(name, detail = "") { results.push({ name, status: "PASS" }); passed++; log("✓", name, detail); }
function fail(name, reason)      { results.push({ name, status: "FAIL", reason }); failed++; log("✗", name, reason); }
function skip(name, reason)      { results.push({ name, status: "SKIP", reason }); skipped++; log("⊘", name, reason); }

async function req(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (sessionCookie) headers["Cookie"] = sessionCookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/([^;]+)/);
    if (match) sessionCookie = match[1];
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("ndjson")) {
    return { status: res.status, ndjson: true, res };
  }

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function reqBinary(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (sessionCookie) headers["Cookie"] = sessionCookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, contentType: res.headers.get("content-type") ?? "", bytes: (await res.arrayBuffer()).byteLength };
}

async function consumeNdjsonStream(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try { events.push(JSON.parse(trimmed)); } catch { /* ignore malformed */ }
    }
  }
  if (buffer.trim()) {
    try { events.push(JSON.parse(buffer.trim())); } catch { /* ignore */ }
  }
  return events;
}

// ─── Test sections ──────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════");
console.log("  قانوني AI — API Test Suite");
console.log(`  Target: ${BASE}`);
console.log("══════════════════════════════════════════\n");

// ── 1. Health ────────────────────────────────────────────────────────────────
console.log("1. Health");
try {
  const { status, data } = await req("GET", "/healthz");
  if (status === 200 && data?.status === "ok") pass("GET /healthz", `status=${data.status}`);
  else fail("GET /healthz", `status=${status} body=${JSON.stringify(data)}`);
} catch (e) { fail("GET /healthz", e.message); }

// ── 2. Auth ──────────────────────────────────────────────────────────────────
console.log("\n2. Auth");
try {
  const { status, data } = await req("POST", "/auth/signup", { email: TEST_EMAIL, password: TEST_PASSWORD, firmName: "مكتب الاختبار" });
  if (status === 201 && data?.user?.email === TEST_EMAIL) pass("POST /auth/signup", `userId=${data.user.id}`);
  else fail("POST /auth/signup", `status=${status} body=${JSON.stringify(data)}`);
} catch (e) { fail("POST /auth/signup", e.message); }

try {
  sessionCookie = ""; // clear cookie to test login fresh
  const { status, data } = await req("POST", "/auth/login", { email: TEST_EMAIL, password: TEST_PASSWORD });
  if (status === 200 && data?.user?.email === TEST_EMAIL && sessionCookie) pass("POST /auth/login", `cookie set ✓`);
  else fail("POST /auth/login", `status=${status} cookie="${sessionCookie}" body=${JSON.stringify(data)}`);
} catch (e) { fail("POST /auth/login", e.message); }

try {
  const { status, data } = await req("GET", "/auth/me");
  if (status === 200 && data?.user?.email === TEST_EMAIL) pass("GET /auth/me (session valid)", `email=${data.user.email}`);
  else fail("GET /auth/me (session valid)", `status=${status}`);
} catch (e) { fail("GET /auth/me (session valid)", e.message); }

try {
  const { status } = await req("POST", "/auth/signup", { email: TEST_EMAIL, password: TEST_PASSWORD });
  if (status === 409) pass("POST /auth/signup (duplicate → 409)");
  else fail("POST /auth/signup (duplicate → 409)", `got status=${status}`);
} catch (e) { fail("POST /auth/signup (duplicate → 409)", e.message); }

try {
  const { status, data } = await req("POST", "/auth/login", { email: TEST_EMAIL, password: "wrongpassword" });
  if (status === 401) pass("POST /auth/login (wrong password → 401)");
  else fail("POST /auth/login (wrong password → 401)", `got status=${status} body=${JSON.stringify(data)}`);
} catch (e) { fail("POST /auth/login (wrong password → 401)", e.message); }

// ── 3. Contract Generation (streaming) ───────────────────────────────────────
console.log("\n3. Contract Generation");

const employmentPayload = {
  employerName: "شركة الاختبار للتقنية",
  employerRegistrationNumber: "12345",
  employeeName: "أحمد محمد علي",
  employeeId: "9876543210",
  jobTitle: "مهندس برمجيات",
  department: "التقنية",
  monthlySalary: 800,
  startDate: "2026-07-01",
  employmentType: "غير محدد المدة",
  probationPeriodDays: 90,
  noticePeriod: "شهر واحد",
  annualLeaveDays: 14,
  hasBonus: true,
  hasOvertime: false,
  hasConfidentialityClause: true,
  workLocation: "حضوري",
  benefits: ["تأمين صحي", "بدل مواصلات"],
};

try {
  const { status, ndjson, res } = await req("POST", "/contracts/generate", employmentPayload);

  if (!ndjson) {
    // non-streaming response means an error (e.g. OpenAI key invalid)
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    if (status === 500 || status === 503) {
      skip("POST /contracts/generate (employment, streaming)", `OpenAI error (expected if key is placeholder): ${JSON.stringify(body)}`);
    } else {
      fail("POST /contracts/generate (employment, streaming)", `status=${status} not ndjson: ${JSON.stringify(body)}`);
    }
  } else {
    const events = await consumeNdjsonStream(res);
    const chunkEvents = events.filter(e => e.type === "chunk");
    const doneEvent = events.find(e => e.type === "done");
    const errorEvent = events.find(e => e.type === "error");

    if (errorEvent) {
      skip("POST /contracts/generate (employment, streaming)", `AI error (likely placeholder key): ${errorEvent.error}`);
    } else if (doneEvent && doneEvent.valid && doneEvent.contract) {
      generatedContractText = doneEvent.contract;
      pass("POST /contracts/generate (employment, streaming)",
        `chunks=${chunkEvents.length} contractLength=${doneEvent.contract.length} warnings=${doneEvent.validationWarnings?.length ?? 0}`);
    } else if (doneEvent && !doneEvent.valid) {
      fail("POST /contracts/generate (employment, streaming)", `done.valid=false missing=[${doneEvent.missingClauses?.join(", ")}]`);
    } else {
      fail("POST /contracts/generate (employment, streaming)", `unexpected events: ${JSON.stringify(events.slice(-2))}`);
    }
  }
} catch (e) { fail("POST /contracts/generate (employment, streaming)", e.message); }

// ── 4. Saved contracts ────────────────────────────────────────────────────────
console.log("\n4. Saved Contracts");
try {
  const { status, data } = await req("GET", "/contracts");
  if (status === 200 && Array.isArray(data?.contracts)) {
    savedContractId = data.contracts[0]?.id ?? null;
    pass("GET /contracts", `count=${data.contracts.length}`);
  } else fail("GET /contracts", `status=${status} body=${JSON.stringify(data)}`);
} catch (e) { fail("GET /contracts", e.message); }

if (savedContractId) {
  try {
    const { status, data } = await req("GET", `/contracts/${savedContractId}`);
    if (status === 200 && data?.contract?.id === savedContractId) pass("GET /contracts/:id", `type=${data.contract.contractType}`);
    else fail("GET /contracts/:id", `status=${status}`);
  } catch (e) { fail("GET /contracts/:id", e.message); }
} else {
  skip("GET /contracts/:id", "no saved contract (generation skipped or failed)");
}

// ── 5. Word Export ────────────────────────────────────────────────────────────
console.log("\n5. Word Export");
const exportText = generatedContractText ?? [
  "عقد عمل",
  "",
  "حُرِّر هذا العقد بين شركة الاختبار للتقنية (صاحب العمل) وأحمد محمد علي (العامل).",
  "المسمى الوظيفي: مهندس برمجيات. الراتب الشهري: ثمانمائة دينار أردني فقط لا غير.",
  "مدة العقد غير محددة وتبدأ اعتباراً من تاريخ 2026-07-01.",
  "",
  "التوقيعات",
  "الطرف الأول: ___  التاريخ: ___",
  "الطرف الثاني: ___  التاريخ: ___",
].join("\n");

try {
  const { status, contentType, bytes } = await reqBinary("POST", "/contracts/export-word", {
    contractText: exportText,
    contractTypeLabel: "عقد عمل",
    partyName: "أحمد محمد علي",
  });
  if (status === 200 && contentType.includes("wordprocessingml") && bytes > 1000) {
    pass("POST /contracts/export-word", `size=${bytes} bytes contentType=${contentType.split(";")[0]}`);
  } else fail("POST /contracts/export-word", `status=${status} contentType=${contentType} bytes=${bytes}`);
} catch (e) { fail("POST /contracts/export-word", e.message); }

// ── 6. Contract Review ────────────────────────────────────────────────────────
console.log("\n6. Contract Review");

const sampleArabicContract = `
عقد عمل

حُرِّر هذا العقد بين شركة النور للتجارة (صاحب العمل) وسليم خالد (العامل) برقم هوية 123456789.
يعمل العامل بوظيفة محاسب براتب شهري 500 دينار أردني فقط.
مدة العقد غير محددة وتبدأ من تاريخ 2026-01-01.
يحق لصاحب العمل إنهاء العقد في أي وقت دون إشعار ودون أي تعويض.
لا يحق للعامل الحصول على إجازة سنوية خلال السنة الأولى.
يتنازل العامل عن جميع حقوقه القانونية المترتبة على قانون العمل.
يسري هذا العقد بعد توقيع الطرفين.
التوقيعات
الطرف الأول: ___  التاريخ: ___
الطرف الثاني: ___  التاريخ: ___
`.trim();

try {
  const { status, data } = await req("POST", "/contracts/review-text", { contractText: sampleArabicContract });
  if (status === 200 && Array.isArray(data?.findings) && data.findings.length > 0) {
    savedReviewId = data.reviewId;
    const red = data.findings.filter(f => f.status === "red").length;
    const yellow = data.findings.filter(f => f.status === "yellow").length;
    const green = data.findings.filter(f => f.status === "green").length;
    pass("POST /contracts/review-text", `findings=${data.findings.length} red=${red} yellow=${yellow} green=${green}`);
  } else if (status === 500) {
    skip("POST /contracts/review-text", `OpenAI error (expected if key is placeholder): ${JSON.stringify(data)}`);
  } else {
    fail("POST /contracts/review-text", `status=${status} body=${JSON.stringify(data).slice(0, 200)}`);
  }
} catch (e) { fail("POST /contracts/review-text", e.message); }

// ── 7. Saved Reviews ──────────────────────────────────────────────────────────
console.log("\n7. Saved Reviews");
try {
  const { status, data } = await req("GET", "/reviews");
  if (status === 200 && Array.isArray(data?.reviews)) {
    pass("GET /reviews", `count=${data.reviews.length}`);
  } else fail("GET /reviews", `status=${status}`);
} catch (e) { fail("GET /reviews", e.message); }

if (savedReviewId) {
  try {
    const { status, data } = await req("GET", `/reviews/${savedReviewId}`);
    if (status === 200 && data?.review?.id === savedReviewId) pass("GET /reviews/:id", `findings=${data.review.findings?.length}`);
    else fail("GET /reviews/:id", `status=${status}`);
  } catch (e) { fail("GET /reviews/:id", e.message); }
} else {
  skip("GET /reviews/:id", "no saved review (review skipped or failed)");
}

// ── 8. Report Export ──────────────────────────────────────────────────────────
console.log("\n8. Report Export");
const sampleFindings = [
  { status: "red", severity: "illegal", clause: "إنهاء العقد", finding: "يتيح للمستأجر الفسخ دون إشعار", suggestion: "يجب إضافة مهلة إشعار لا تقل عن شهر" },
  { status: "green", severity: "safe", clause: "الراتب", finding: "الراتب أعلى من الحد الأدنى", suggestion: "لا يلزم تغيير." },
];
try {
  const { status, contentType, bytes } = await reqBinary("POST", "/contracts/export-report", {
    findings: sampleFindings,
    filename: "عقد-اختبار",
  });
  if (status === 200 && contentType.includes("wordprocessingml") && bytes > 500) {
    pass("POST /contracts/export-report", `size=${bytes} bytes`);
  } else fail("POST /contracts/export-report", `status=${status} contentType=${contentType} bytes=${bytes}`);
} catch (e) { fail("POST /contracts/export-report", e.message); }

// ── 9. Admin endpoints ────────────────────────────────────────────────────────
console.log("\n9. Admin — Law Changes");
try {
  const { status, data } = await req("GET", "/admin/law-changes");
  if (status === 200 && Array.isArray(data?.changes)) {
    pass("GET /admin/law-changes", `unacknowledged=${data.changes.length} cachedTypes=${Object.keys(data.cacheStats ?? {}).join(", ") || "none"}`);
  } else fail("GET /admin/law-changes", `status=${status} body=${JSON.stringify(data)}`);
} catch (e) { fail("GET /admin/law-changes", e.message); }

try {
  const { status, data } = await req("POST", "/admin/law-changes/acknowledged", {});
  if (status === 200 && data?.acknowledged === true) pass("POST /admin/law-changes/acknowledged (clear all)", `cache cleared ✓`);
  else fail("POST /admin/law-changes/acknowledged", `status=${status} body=${JSON.stringify(data)}`);
} catch (e) { fail("POST /admin/law-changes/acknowledged", e.message); }

// Admin: unauthenticated access should be blocked
try {
  const savedCookie = sessionCookie;
  sessionCookie = "";
  const { status } = await req("GET", "/admin/law-changes");
  sessionCookie = savedCookie;
  if (status === 401) pass("GET /admin/law-changes (no auth → 401)");
  else fail("GET /admin/law-changes (no auth → 401)", `got status=${status}`);
} catch (e) { fail("GET /admin/law-changes (no auth → 401)", e.message); }

// ── 10. Logout + session invalidation ─────────────────────────────────────────
console.log("\n10. Logout & Session");
try {
  const { status } = await req("POST", "/auth/logout");
  if (status === 204) pass("POST /auth/logout");
  else fail("POST /auth/logout", `status=${status}`);
} catch (e) { fail("POST /auth/logout", e.message); }

try {
  const { status } = await req("GET", "/auth/me");
  if (status === 401) pass("GET /auth/me (after logout → 401)");
  else fail("GET /auth/me (after logout → 401)", `got status=${status}`);
} catch (e) { fail("GET /auth/me (after logout → 401)", e.message); }

// ── 11. Cleanup: remove test user from DB ─────────────────────────────────────
console.log("\n11. Cleanup");
try {
  const out = execSync(
    `psql "${process.env.DATABASE_URL}" -c "DELETE FROM users WHERE email='${TEST_EMAIL}' RETURNING id" -t`,
    { encoding: "utf-8" }
  ).trim();
  if (out.length > 0) pass("Delete test user from DB", `email=${TEST_EMAIL}`);
  else fail("Delete test user from DB", "user not found in DB");
} catch (e) { fail("Delete test user from DB", e.message); }

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════");
console.log("  Results");
console.log("══════════════════════════════════════════");
console.log(`  Total:   ${results.length}`);
console.log(`  Passed:  ${passed}`);
console.log(`  Failed:  ${failed}`);
console.log(`  Skipped: ${skipped}  (expected when OpenAI key is placeholder)`);

if (failed > 0) {
  console.log("\n  Failed tests:");
  for (const r of results.filter(r => r.status === "FAIL")) {
    console.log(`    ✗ ${r.name}`);
    console.log(`      ${r.reason}`);
  }
}

console.log("");
process.exit(failed > 0 ? 1 : 0);
