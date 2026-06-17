import type { RequestHandler } from "express";
import { AppError } from "../../core/errors";
import { extractText, analyzeContract } from "./logic/ReviewLogic";

export const reviewUpload: RequestHandler = async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "لم يتم رفع أي ملف" });
    return;
  }

  let contractText: string;
  try {
    contractText = await extractText(req.file.buffer, req.file.mimetype);
  } catch {
    res.status(422).json({
      error: "تعذر قراءة الملف. تأكد أنه PDF أو DOCX أو TXT سليم.",
    });
    return;
  }

  if (contractText.trim().length < 100) {
    res.status(422).json({
      error: "الملف المرفوع يبدو فارغاً أو لا يحتوي على نص قابل للقراءة",
    });
    return;
  }

  try {
    const findings = await analyzeContract(contractText, req.log);
    res.json({
      findings,
      charCount: contractText.length,
      filename: req.file.originalname,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Contract review failed");
    res.status(500).json({ error: "فشل في مراجعة العقد. يرجى المحاولة مرة أخرى." });
  }
};

export const reviewText: RequestHandler = async (req, res) => {
  const { contractText } = req.body as { contractText?: string };

  if (
    !contractText ||
    typeof contractText !== "string" ||
    contractText.trim().length < 100
  ) {
    res.status(400).json({ error: "النص مفقود أو قصير جداً" });
    return;
  }

  try {
    const findings = await analyzeContract(contractText, req.log);
    res.json({
      findings,
      charCount: contractText.length,
      filename: "عقد مولَّد",
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Contract review-text failed");
    res.status(500).json({ error: "فشل في مراجعة العقد." });
  }
};
