import type { RequestHandler } from "express";
import { streamFullContract as streamHybridContract } from "./clauses";
import { prepareGeneration } from "./logic/ContractsLogic";
import {
  persistContract,
  getContractsForUser,
  getContractForUser,
} from "./logic/ContractsStore";
import { getLastKnownVersionIds } from "../../services/law/ragCache";
import { NotFoundError } from "../../core/errors";
import {
  buildWordDocument,
  buildReportDocument,
} from "../../services/wordExport/WordExportService";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function arabicDate(): string {
  return new Date().toLocaleDateString("ar-JO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Streams a hybrid contract of the given type as NDJSON. Persists the
    assembled contract for the authenticated user once it validates. */
export function generate(type: string): RequestHandler {
  return async (req, res) => {
    const plan = await prepareGeneration(
      type,
      req.body as Record<string, unknown>,
      req.log,
    );
    const userId = req.session.userId;
    await streamHybridContract(req, res, {
      ...plan,
      onComplete: async ({ valid, contract }) => {
        if (!valid || !contract || !userId) return;
        await persistContract({
          userId,
          contractType: type,
          generatedText: contract,
          inputData: plan.data,
          lawArticlesUsed: plan.lawArticlesUsed,
        });
      },
    });
  };
}

/** Lists the authenticated user's saved contracts (metadata only). */
export const listContracts: RequestHandler = async (req, res) => {
  const userId = req.session.userId!;
  const contracts = await getContractsForUser(userId);
  res.json({ contracts });
};

/** Retrieves one saved contract owned by the authenticated user.
    Includes a `stale` flag when the law versions used at generation time
    differ from the last known versions in the cache. */
export const getContract: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId!;
  const contract = await getContractForUser(userId, req.params.id as string);
  if (!contract) {
    next(new NotFoundError("العقد غير موجود"));
    return;
  }

  const lawUsed = contract.lawArticlesUsed as { lawVersionIds?: string[] } | null;
  const savedIds = [...(lawUsed?.lawVersionIds ?? [])].sort();
  const currentIds = [...getLastKnownVersionIds(contract.contractType)].sort();
  const stale =
    currentIds.length > 0 && savedIds.join(",") !== currentIds.join(",");

  res.json({
    contract,
    stale,
    changedLaws: stale ? currentIds.filter((v) => !savedIds.includes(v)) : [],
  });
};

export const exportReport: RequestHandler = async (req, res) => {
  const { findings, filename } = req.body as {
    findings?: unknown[];
    filename?: string;
  };

  if (!findings || !Array.isArray(findings) || findings.length === 0) {
    res.status(400).json({ error: "لا توجد نتائج للتصدير" });
    return;
  }

  try {
    const buffer = await buildReportDocument({
      findings: findings as Parameters<
        typeof buildReportDocument
      >[0]["findings"],
      filename: filename ?? "عقد",
      generatedDate: arabicDate(),
    });
    const safeFilename = encodeURIComponent(`تقرير-مراجعة-${filename ?? "عقد"}.docx`);
    res.setHeader("Content-Type", DOCX_MIME);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${safeFilename}`,
    );
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Report export failed");
    res.status(500).json({ error: "فشل تصدير التقرير" });
  }
};

export const exportWord: RequestHandler = async (req, res) => {
  const { contractText, contractTypeLabel, partyName } = req.body as {
    contractText?: string;
    contractTypeLabel?: string;
    partyName?: string;
  };

  if (
    !contractText ||
    typeof contractText !== "string" ||
    contractText.length < 100
  ) {
    res.status(400).json({ error: "نص العقد مفقود أو قصير جداً" });
    return;
  }

  try {
    const buffer = await buildWordDocument({
      contractText,
      contractTypeLabel: contractTypeLabel ?? "عقد",
      partyName: partyName ?? "",
      generatedDate: arabicDate(),
    });
    const filename = encodeURIComponent(
      `${contractTypeLabel ?? "عقد"}-${partyName ?? "وثيقة"}.docx`,
    );
    res.setHeader("Content-Type", DOCX_MIME);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${filename}`,
    );
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Word export failed");
    res.status(500).json({ error: "فشل تصدير الوثيقة" });
  }
};
