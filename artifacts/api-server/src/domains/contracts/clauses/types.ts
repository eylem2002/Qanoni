/* ══════════════════════════════════════════════════════════
   FULL-AI CONTRACT TEMPLATE TYPES

   Every clause is drafted by GPT-4o. The model receives the
   complete clause list as [[[SECTION:id]]] instructions and
   must return each section filled with legal Arabic text,
   grounded in the RAG-provided law articles.

   There is no "fixed" / "variable" split. All clauses are `kind: "ai"`.
   Required clauses that the model fails to draft get the review
   placeholder — they never silently vanish.
══════════════════════════════════════════════════════════ */

export interface AiClause<T> {
  kind: "ai";
  /** Stable identifier; used as the `[[[SECTION:id]]]` anchor in the prompt. */
  id: string;
  /** Heading line rendered in the assembled document. */
  heading: string;
  /** Drafting instruction sent to the model for this section. */
  instruction: (data: T) => string;
  /**
   * When true and the model omits the section, the engine inserts the review
   * placeholder instead of silently dropping the clause.
   */
  required?: boolean;
}

export type Clause<T> = AiClause<T>;

export interface ContractTemplate<T> {
  /** Internal contract type key, e.g. "employment". */
  type: string;
  /** Document title. */
  title: (data: T) => string;
  /** Parties / preamble block rendered before the clauses. */
  preamble: (data: T) => string;
  /** Ordered clauses — all AI-drafted. */
  clauses: AiClause<T>[];
  /** Signature block. */
  signatureBlock: (data: T) => string;
  /** Closing disclaimer. */
  disclaimer: string;
}

export function getAllClauses<T>(t: ContractTemplate<T>): AiClause<T>[] {
  return t.clauses;
}
