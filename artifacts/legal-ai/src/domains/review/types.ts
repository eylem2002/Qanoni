export interface Finding {
  status: "green" | "yellow" | "red";
  severity: "safe" | "unusual" | "illegal";
  clause: string;
  finding: string;
  suggestion: string;
}

export interface ReviewResult {
  findings: Finding[];
  charCount: number;
  filename: string;
}
