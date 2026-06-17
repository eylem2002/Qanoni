import type { ToastFn } from "@/app/providers/ToastProvider";
import type { FormCallbacks, StreamEvent } from "./types";

/**
 * Streams a contract generation request and consumes the NDJSON envelope
 * ({type:"chunk"|"done"|"error"}). This consumer is the contract with the
 * server stream and is intentionally preserved verbatim across refactors.
 */
export async function submitContract(
  url: string,
  payload: unknown,
  callbacks: FormCallbacks,
  successTitle: string,
  toast: ToastFn,
  partyName: string = "",
): Promise<void> {
  callbacks.onLoadingChange(true);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get("content-type") ?? "";
    const isNdjson = contentType.includes("ndjson");

    if (!isNdjson) {
      const data: { error?: string; missingClauses?: string[] } = await res.json().catch(() => ({}));
      const is422 = res.status === 422;
      toast({
        title: is422 ? "العقد غير مكتمل" : "حدث خطأ",
        description:
          is422 && data.missingClauses?.length
            ? `البنود المفقودة: ${data.missingClauses.join("، ")}`
            : data.error ?? "تعذر توليد العقد. الرجاء المحاولة مرة أخرى.",
        variant: "destructive",
      });
      return;
    }

    if (!res.body) {
      toast({ title: "خطأ في الاتصال", description: "لم يصل أي رد من الخادم.", variant: "destructive" });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamedText = "";
    let finalContract = "";
    let finalEvent: StreamEvent | null = null;

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let event: StreamEvent;
      try {
        event = JSON.parse(trimmed) as StreamEvent;
      } catch {
        return;
      }
      if (event.type === "chunk") {
        streamedText += event.text;
        callbacks.onResult(streamedText, partyName);
      } else {
        finalEvent = event;
        if (event.type === "done" && event.valid && event.contract) {
          finalContract = event.contract;
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);

    if (finalEvent === null) {
      toast({
        title: "انقطع الاتصال",
        description: "تم قطع الاتصال قبل اكتمال توليد العقد. الرجاء المحاولة مرة أخرى.",
        variant: "destructive",
      });
      callbacks.onResult("", partyName);
      return;
    }

    const finalEventTyped = finalEvent as StreamEvent;
    if (finalEventTyped.type === "error") {
      toast({ title: "حدث خطأ", description: finalEventTyped.error, variant: "destructive" });
      callbacks.onResult("", partyName);
      return;
    }

    if (finalEventTyped.type === "done" && !finalEventTyped.valid) {
      toast({
        title: "العقد غير مكتمل",
        description: finalEventTyped.missingClauses?.length
          ? `البنود المفقودة: ${finalEventTyped.missingClauses.join("، ")}`
          : finalEventTyped.error ?? "لم يكتمل توليد العقد.",
        variant: "destructive",
      });
      callbacks.onResult("", partyName);
      return;
    }

    callbacks.onResult(
      finalContract || streamedText,
      partyName,
      finalEventTyped.type === "done" ? finalEventTyped.validationWarnings ?? [] : [],
    );
    toast({ title: successTitle, description: "يمكنك الآن مراجعة العقد ونسخه أو تحميله." });
  } catch {
    toast({
      title: "خطأ في الاتصال",
      description: "تعذر الوصول إلى الخادم. تحقق من اتصالك بالإنترنت.",
      variant: "destructive",
    });
  } finally {
    callbacks.onLoadingChange(false);
  }
}

/** Exports the given contract text to a Word (.docx) blob. Throws on failure. */
export async function exportContractWord(body: {
  contractText: string;
  contractTypeLabel: string;
  partyName: string;
}): Promise<Blob> {
  const res = await fetch("/api/contracts/export-word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("export-word failed");
  return res.blob();
}
