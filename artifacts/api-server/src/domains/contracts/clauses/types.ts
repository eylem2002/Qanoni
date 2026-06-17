/* ══════════════════════════════════════════════════════════
   HYBRID CONTRACT TEMPLATE TYPES

   The hybrid drafting model splits every contract into two buckets:

   - FIXED (mandatory / statutory) clauses: lawyer-reviewed verbatim
     Arabic text. The LLM NEVER rewrites these — it only sees them as
     already-present. `render(data)` is deterministic: same input always
     produces byte-identical output. This is what builds lawyer trust.

   - VARIABLE (negotiated) clauses: the genuinely deal-specific parts that
     the LLM actually drafts, grounded in the RAG'd law text and the
     STRICT_RULES. `instruction(data)` tells the model exactly what to write
     for that section.

   The engine renders the fixed clauses verbatim, asks the model to draft
   only the variable sections, assembles the whole document in clause order,
   then runs the deterministic verification layer on the assembled result.
══════════════════════════════════════════════════════════ */

export interface FixedClause<T> {
  kind: "fixed";
  /** Stable identifier (also used as the section anchor). */
  id: string;
  /** Heading line, e.g. "البند الرابع: فترة التجربة (المادة 35)". */
  heading: string;
  /**
   * Deterministic, lawyer-reviewed clause body. Only inserts party-specific
   * data into pre-approved statutory text — never free generation.
   */
  render: (data: T) => string;
}

export interface VariableClause<T> {
  kind: "variable";
  /** Stable identifier; used as the `[[[SECTION:id]]]` anchor in the prompt. */
  id: string;
  /** Heading line for the assembled document. */
  heading: string;
  /** What the LLM must draft for this section, derived from the structured data. */
  instruction: (data: T) => string;
  /**
   * Whether this section must be present. When true and the model omits it,
   * the engine inserts a lawyer-review placeholder instead.
   */
  required?: boolean;
}

export type Clause<T> = FixedClause<T> | VariableClause<T>;

export interface ContractTemplate<T> {
  /** Internal contract type key, e.g. "employment". */
  type: string;
  /** Document title, e.g. "عقد عمل". */
  title: (data: T) => string;
  /** Fixed preamble / parties block rendered right after the title. */
  preamble: (data: T) => string;
  /** Ordered clauses (fixed and variable interleaved in legal order). */
  clauses: Clause<T>[];
  /** Fixed signature block. */
  signatureBlock: (data: T) => string;
  /** Fixed closing disclaimer. */
  disclaimer: string;
}

export function getVariableClauses<T>(t: ContractTemplate<T>): VariableClause<T>[] {
  return t.clauses.filter((c): c is VariableClause<T> => c.kind === "variable");
}
