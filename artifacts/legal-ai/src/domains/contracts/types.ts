export type FormCallbacks = {
  onResult: (contract: string, partyName: string, validationWarnings?: string[]) => void;
  onLoadingChange: (loading: boolean) => void;
};

export type StreamEvent =
  | { type: "chunk"; text: string }
  | {
      type: "done";
      valid: boolean;
      contract?: string;
      error?: string;
      missingClauses?: string[];
      validationWarnings?: string[];
    }
  | { type: "error"; error: string };
