import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, Header, Footer, PageNumber,
} from "docx";

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
          font: "Arial",
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
          run: { font: "Arial", size: 22, rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1200, right: 1000, bottom: 1200, left: 1000 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                border: {
                  bottom: { color: "C9A94E", size: 8, style: BorderStyle.SINGLE },
                },
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: `قانوني AI — ${contractTypeLabel}`,
                    bold: true,
                    size: 22,
                    font: "Arial",
                    color: "C9A94E",
                  }),
                  new TextRun({
                    text: `     |     تاريخ الإصدار: ${generatedDate}`,
                    size: 18,
                    font: "Arial",
                    color: "888888",
                  }),
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
                border: {
                  top: { color: "CCCCCC", size: 4, style: BorderStyle.SINGLE },
                },
                spacing: { before: 100 },
                children: [
                  new TextRun({
                    text: "هذا العقد مُولَّد بمساعدة الذكاء الاصطناعي استناداً للقانون الأردني. يُنصح بمراجعة محامٍ مرخص قبل التوقيع. — قانوني AI    |    صفحة ",
                    size: 16,
                    font: "Arial",
                    color: "888888",
                    rightToLeft: true,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: "Arial",
                    color: "888888",
                  }),
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
            children: [
              new TextRun({
                text: contractTypeLabel,
                bold: true,
                size: 40,
                font: "Arial",
                color: "1A1A1A",
                rightToLeft: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: partyName,
                size: 26,
                font: "Arial",
                color: "555555",
                rightToLeft: true,
              }),
            ],
          }),
          ...contentParagraphs,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
