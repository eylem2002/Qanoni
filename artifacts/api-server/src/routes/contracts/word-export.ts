import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, Header, Footer, PageNumber,
} from "docx";

const FONT = { name: "Times New Roman", hint: "cs" } as const;

export interface WordDocumentOptions {
  contractText: string;
  contractTypeLabel: string;
  partyName: string;
  generatedDate: string;
}

export async function buildWordDocument(opts: WordDocumentOptions): Promise<Buffer> {
  const { contractText, contractTypeLabel, partyName, generatedDate } = opts;

  const lines = contractText.split("\n");

  const contentParagraphs = lines.map((line) => {
    const trimmed = line.trim();

    if (/^[━─=]{5,}$/.test(trimmed)) {
      return new Paragraph({
        border: { bottom: { color: "C9A94E", size: 6, style: BorderStyle.SINGLE } },
        spacing: { before: 80, after: 80 },
      });
    }

    const isHeading =
      /^(الجزء|البند|عقد |اتفاقية |المراجع القانونية|التوقيعات)/.test(trimmed);

    return new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: isHeading ? 160 : 60, after: 40 },
      children: [
        new TextRun({
          text: trimmed || " ",
          bold: isHeading,
          size: isHeading ? 24 : 22,
          font: FONT,
          rightToLeft: true,
          color: isHeading ? "1A1A1A" : "2C2C2C",
        }),
      ],
    });
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: { name: "Times New Roman", hint: "cs" }, size: 22, rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1200, right: 1000, bottom: 1200, left: 1000 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                border: { bottom: { color: "C9A94E", size: 8, style: BorderStyle.SINGLE } },
                spacing: { after: 120 },
                children: [
                  new TextRun({ text: `قانوني AI — ${contractTypeLabel}`, bold: true, size: 22, font: FONT, color: "C9A94E" }),
                  new TextRun({ text: `     |     تاريخ الإصدار: ${generatedDate}`, size: 18, font: FONT, color: "888888" }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                border: { top: { color: "CCCCCC", size: 4, style: BorderStyle.SINGLE } },
                spacing: { before: 100 },
                children: [
                  new TextRun({ text: "هذا العقد مُولَّد بمساعدة الذكاء الاصطناعي استناداً للقانون الأردني. يُنصح بمراجعة محامٍ مرخص قبل التوقيع. — قانوني AI    |    صفحة ", size: 16, font: FONT, color: "888888", rightToLeft: true }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONT, color: "888888" }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { before: 200, after: 200 },
            children: [new TextRun({ text: contractTypeLabel, bold: true, size: 40, font: FONT, color: "1A1A1A", rightToLeft: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 400 },
            children: [new TextRun({ text: partyName, size: 26, font: FONT, color: "555555", rightToLeft: true })],
          }),
          ...contentParagraphs,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/* ══════════════════════════════════════════════════════════
   REPORT DOCUMENT
══════════════════════════════════════════════════════════ */

export interface ReportDocumentOptions {
  findings: Array<{
    status: "green" | "yellow" | "red";
    clause: string;
    finding: string;
    suggestion: string;
  }>;
  filename: string;
  generatedDate: string;
}

export async function buildReportDocument(opts: ReportDocumentOptions): Promise<Buffer> {
  const { findings, filename, generatedDate } = opts;

  const STATUS_AR: Record<string, string> = { green: "آمن", yellow: "يحتاج مراجعة", red: "خطر قانوني" };
  const STATUS_COLOR: Record<string, string> = { green: "2D7D46", yellow: "B45309", red: "B91C1C" };

  const contentParagraphs = findings.map((f) => {
    const statusLabel = STATUS_AR[f.status] ?? f.status;
    const color = STATUS_COLOR[f.status] ?? "333333";
    return [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 200, after: 40 },
        children: [
          new TextRun({ text: `[${statusLabel}]  `, bold: true, size: 22, font: FONT, color, rightToLeft: true }),
          new TextRun({ text: f.clause, bold: true, size: 22, font: FONT, color: "1A1A1A", rightToLeft: true }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 30, after: 30 },
        children: [new TextRun({ text: f.finding, size: 20, font: FONT, color: "333333", rightToLeft: true })],
      }),
      ...(f.suggestion && f.suggestion !== "لا يلزم تغيير."
        ? [new Paragraph({
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { before: 20, after: 120 },
            children: [
              new TextRun({ text: "التوصية: ", bold: true, size: 18, font: FONT, color: "555555", rightToLeft: true }),
              new TextRun({ text: f.suggestion, size: 18, font: FONT, color: "555555", rightToLeft: true }),
            ],
          })]
        : []
      ),
    ];
  }).flat();

  const redCount = findings.filter((f) => f.status === "red").length;
  const yellowCount = findings.filter((f) => f.status === "yellow").length;
  const greenCount = findings.filter((f) => f.status === "green").length;

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1200, right: 1000, bottom: 1200, left: 1000 } } },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { bottom: { color: "C9A94E", size: 8, style: BorderStyle.SINGLE } },
            spacing: { after: 120 },
            children: [
              new TextRun({ text: "قانوني AI — تقرير مراجعة العقد", bold: true, size: 22, font: FONT, color: "C9A94E" }),
              new TextRun({ text: `     |     ${generatedDate}`, size: 18, font: FONT, color: "888888" }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { color: "CCCCCC", size: 4, style: BorderStyle.SINGLE } },
            spacing: { before: 100 },
            children: [
              new TextRun({ text: "هذا التقرير لأغراض إرشادية فقط — لا يُغني عن محامٍ مرخص — قانوني AI", size: 16, font: FONT, color: "888888", rightToLeft: true }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: "تقرير مراجعة العقد", bold: true, size: 40, font: FONT, color: "1A1A1A", rightToLeft: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: filename, size: 24, font: FONT, color: "555555", rightToLeft: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: `خطر: ${redCount}   |   مراجعة: ${yellowCount}   |   آمن: ${greenCount}`, size: 20, font: FONT, color: "444444", rightToLeft: true }),
          ],
        }),
        ...contentParagraphs,
      ],
    }],
  });

  return await Packer.toBuffer(doc);
}
