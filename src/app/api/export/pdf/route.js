import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import { activeQuery } from "@/lib/bin";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function short(text, max = 42) {
  const str = String(text || "");
  return str.length > max ? `${str.slice(0, max - 1)}...` : str;
}

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();
  const tx = await Transaction.find({ userId: user._id, ...activeQuery() }).populate("personId", "name").sort({ date: -1 });

  const totalCredit = tx
    .filter((item) => item.type === "credit")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalDebit = tx
    .filter((item) => item.type === "debit")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingCount = tx.filter((item) => item.status === "pending").length;
  const remainingAmount = Math.abs(totalCredit - totalDebit);
  const userNeedsToPay = totalDebit > totalCredit;
  const remainingLabel = userNeedsToPay
    ? "You need to pay"
    : "Person needs to pay you";

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const width = 595;
  const height = 842;
  const margin = 40;
  const contentWidth = width - margin * 2;
  const rowHeight = 22;

  let page = pdfDoc.addPage([width, height]);
  let y = height - margin;

  const drawHeader = () => {
    page.drawRectangle({ x: margin, y: y - 76, width: contentWidth, height: 76, color: rgb(0.07, 0.07, 0.08) });
    page.drawRectangle({ x: margin, y: y - 76, width: 8, height: 76, color: rgb(0.96, 0.68, 0.12) });

    page.drawText("MYOWEDUE", {
      x: margin + 14,
      y: y - 22,
      size: 16,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText("Premium Financial Report", {
      x: margin + 14,
      y: y - 40,
      size: 11,
      font,
      color: rgb(0.95, 0.95, 0.95),
    });
    page.drawText("Personal credit and debit intelligence", {
      x: margin + 14,
      y: y - 56,
      size: 9,
      font,
      color: rgb(0.8, 0.8, 0.8),
    });

    y -= 96;
  };

  const drawCard = (x, title, value, tone = "neutral") => {
    const palette = {
      neutral: { bg: rgb(0.97, 0.97, 0.97), border: rgb(0.85, 0.85, 0.85), title: rgb(0.36, 0.36, 0.36), value: rgb(0.1, 0.1, 0.1) },
      yellow: { bg: rgb(1, 0.97, 0.86), border: rgb(0.93, 0.79, 0.33), title: rgb(0.52, 0.4, 0.07), value: rgb(0.46, 0.31, 0.04) },
      red: { bg: rgb(1, 0.9, 0.9), border: rgb(0.91, 0.4, 0.4), title: rgb(0.63, 0.1, 0.1), value: rgb(0.5, 0.08, 0.08) },
      green: { bg: rgb(0.9, 0.98, 0.93), border: rgb(0.38, 0.73, 0.49), title: rgb(0.07, 0.45, 0.2), value: rgb(0.06, 0.37, 0.15) },
    };
    const style = palette[tone] || palette.neutral;

    page.drawRectangle({ x, y: y - 56, width: 166, height: 56, color: style.bg, borderWidth: 0.7, borderColor: style.border });
    page.drawText(title, {
      x: x + 10,
      y: y - 20,
      size: 8,
      font,
      color: style.title,
    });
    page.drawText(value, {
      x: x + 10,
      y: y - 42,
      size: 13,
      font: bold,
      color: style.value,
    });
  };

  const drawRemainingBanner = () => {
    const bg = userNeedsToPay ? rgb(1, 0.97, 0.86) : rgb(1, 0.9, 0.9);
    const border = userNeedsToPay ? rgb(0.93, 0.79, 0.33) : rgb(0.91, 0.4, 0.4);
    const titleColor = userNeedsToPay ? rgb(0.52, 0.4, 0.07) : rgb(0.63, 0.1, 0.1);
    const valueColor = userNeedsToPay ? rgb(0.46, 0.31, 0.04) : rgb(0.5, 0.08, 0.08);

    page.drawRectangle({
      x: margin,
      y: y - 58,
      width: contentWidth,
      height: 58,
      color: bg,
      borderWidth: 1,
      borderColor: border,
    });

    page.drawText("TOTAL REMAINING AMOUNT", {
      x: margin + 12,
      y: y - 21,
      size: 9,
      font: bold,
      color: titleColor,
    });

    page.drawText(`${remainingLabel}: ${money(remainingAmount)}`, {
      x: margin + 12,
      y: y - 42,
      size: 14,
      font: bold,
      color: valueColor,
    });

    y -= 68;
  };

  const drawTableHeader = () => {
    page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: rgb(0.08, 0.08, 0.08) });
    page.drawText("Person", { x: margin + 8, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Type", { x: margin + 210, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Amount", { x: margin + 265, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Status", { x: margin + 355, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Date", { x: margin + 430, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
    y -= rowHeight;
  };

  const ensureSpace = (space = rowHeight) => {
    if (y - space < margin + 28) {
      page = pdfDoc.addPage([width, height]);
      y = height - margin;
      drawTableHeader();
    }
  };

  drawHeader();
  page.drawText(`Prepared for ${user.name} (${user.email})`, {
    x: margin,
    y,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText(`Generated ${new Date().toLocaleString()}`, {
    x: margin + 290,
    y,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 18;

  drawCard(margin, "TOTAL CREDIT", money(totalCredit), "green");
  drawCard(margin + 177, "TOTAL DEBIT", money(totalDebit), "neutral");
  drawCard(margin + 354, "PENDING ENTRIES", String(pendingCount), "neutral");
  y -= 70;

  drawRemainingBanner();

  drawTableHeader();

  tx.forEach((item, idx) => {
    ensureSpace();
    if (idx % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: rgb(0.98, 0.98, 0.98) });
    }

    page.drawText(short(item.personId?.name || "Unknown", 26), { x: margin + 8, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(item.type.toUpperCase(), { x: margin + 210, y: y - 15, size: 8.5, font: bold, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`${money(item.amount)} ${item.currency}`, { x: margin + 265, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(item.status.toUpperCase(), { x: margin + 355, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(new Date(item.date).toLocaleDateString(), { x: margin + 430, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
    y -= rowHeight;
  });

  page.drawText("Generated by MYOWEDUE", {
    x: margin,
    y: 18,
    size: 8,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });

  const pdfBuffer = Buffer.from(await pdfDoc.save());

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=dues-report.pdf",
    },
  });
}
