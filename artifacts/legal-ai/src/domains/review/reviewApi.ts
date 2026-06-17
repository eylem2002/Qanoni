import type { Finding } from "./types";

export interface ReviewResponse {
  findings?: Finding[];
  charCount?: number;
  filename?: string;
  error?: string;
}

/** Reviews already-generated contract text (handed off via sessionStorage). */
export async function reviewText(body: { contractText: string; label: string }): Promise<ReviewResponse> {
  const res = await fetch("/api/contracts/review-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Reviews an uploaded contract file. Returns the parsed body plus the HTTP ok flag. */
export async function reviewFile(file: File): Promise<{ ok: boolean; data: ReviewResponse }> {
  const formData = new FormData();
  formData.append("contract", file);
  const res = await fetch("/api/contracts/review", { method: "POST", body: formData });
  const data: ReviewResponse = await res.json();
  return { ok: res.ok, data };
}

/** Exports a review report to a Word (.docx) blob. Throws on failure. */
export async function exportReport(body: { findings: Finding[]; filename: string }): Promise<Blob> {
  const res = await fetch("/api/contracts/export-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("export-report failed");
  return res.blob();
}
