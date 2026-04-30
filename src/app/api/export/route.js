import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import { ok, fail } from "@/lib/api";
import { activeQuery } from "@/lib/bin";
import { deriveUserKey, decryptTransaction } from "@/lib/crypto";
import { getFontPreset, getFontSizePreset } from "@/lib/appearance";
import { formatDateOnly, formatDateTimeLabel, nextDateOnly, parseDateOnly } from "@/lib/datetime";
import { supportsPremiumExports } from "@/lib/subscription";

export const runtime = "nodejs";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function toCsvCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toSpreadsheetCell(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resolvePdfFonts(pdfDoc, user) {
  const preset = getFontPreset(user.fontPreset);
  if (preset.pdfFamily === "times") {
    return {
      font: await pdfDoc.embedFont(StandardFonts.TimesRoman),
      bold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    };
  }
  if (preset.pdfFamily === "courier") {
    return {
      font: await pdfDoc.embedFont(StandardFonts.Courier),
      bold: await pdfDoc.embedFont(StandardFonts.CourierBold),
    };
  }
  return {
    font: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const startDateStr = searchParams.get("start");
    const endDateStr = searchParams.get("end");

    // Build query with date range
    const query = { userId: user._id, ...activeQuery() };
    if (startDateStr || endDateStr) {
      query.date = {};
      if (startDateStr) query.date.$gte = parseDateOnly(startDateStr);
      if (endDateStr) {
        query.date.$lt = nextDateOnly(endDateStr);
      }
    }

    const tx = await Transaction.find(query).populate("personId", "name").sort({ date: -1 }).lean();
    const userKey = await deriveUserKey(user._id.toString(), user.email);

    // Decrypt all transactions
    const decryptedTx = await Promise.all(
      tx.map(async (t) => {
        const plain = t.toObject ? t.toObject() : { ...t };
        if (plain.encryptedAmount) {
          try {
            const decrypted = await decryptTransaction(plain, userKey);
            plain.amount = decrypted.amount;
            if (decrypted.notes !== undefined) plain.notes = decrypted.notes;
          } catch (err) {
            console.error(`Failed to decrypt transaction ${plain._id}:`, err.message);
          }
        }
        return plain;
      })
    );

    if (format === "pdf") {
      if (!supportsPremiumExports(user)) {
        return fail("Premium subscription required for PDF export", 403);
      }
      return await generatePDF(user, decryptedTx, startDateStr, endDateStr);
    }

    // CSV export
    const type = searchParams.get("type");
    if (type === "csv") {
      const rows = ["person,amount,type,currency,date,notes"];
      for (const t of decryptedTx) {
        const personName = toCsvCell(t.personId?.name || "Unknown");
        const notes = toCsvCell(t.notes);
        rows.push(
          [
            `"${personName.replace(/"/g, '""')}"`,
            t.amount || "",
            t.type,
            t.currency,
            formatDateOnly(t.date),
            `"${notes.replace(/"/g, '""')}"`,
          ].join(",")
        );
      }
      return new Response(rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=transactions.csv",
        },
      });
    }

    if (type === "excel") {
      if (!supportsPremiumExports(user)) {
        return fail("Premium subscription required for Excel export", 403);
      }

      const rows = decryptedTx
        .map(
          (item) => `
            <Row>
              <Cell><Data ss:Type="String">${toSpreadsheetCell(item.personId?.name || "Unknown")}</Data></Cell>
              <Cell><Data ss:Type="Number">${Number(item.amount || 0)}</Data></Cell>
              <Cell><Data ss:Type="String">${toSpreadsheetCell(item.type || "")}</Data></Cell>
              <Cell><Data ss:Type="String">${toSpreadsheetCell(item.currency || "USD")}</Data></Cell>
              <Cell><Data ss:Type="String">${toSpreadsheetCell(formatDateOnly(item.date))}</Data></Cell>
              <Cell><Data ss:Type="String">${toSpreadsheetCell(item.notes || "")}</Data></Cell>
            </Row>`
        )
        .join("");

      const workbook = `<?xml version="1.0"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Styles>
          <Style ss:ID="header">
            <Font ss:Bold="1" ss:Color="#111111"/>
            <Interior ss:Color="#FDE68A" ss:Pattern="Solid"/>
          </Style>
        </Styles>
        <Worksheet ss:Name="Transactions">
          <Table>
            <Row>
              <Cell ss:StyleID="header"><Data ss:Type="String">Person</Data></Cell>
              <Cell ss:StyleID="header"><Data ss:Type="String">Amount</Data></Cell>
              <Cell ss:StyleID="header"><Data ss:Type="String">Type</Data></Cell>
              <Cell ss:StyleID="header"><Data ss:Type="String">Currency</Data></Cell>
              <Cell ss:StyleID="header"><Data ss:Type="String">Date</Data></Cell>
              <Cell ss:StyleID="header"><Data ss:Type="String">Notes</Data></Cell>
            </Row>
            ${rows}
          </Table>
        </Worksheet>
      </Workbook>`;

      return new Response(workbook, {
        headers: {
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": "attachment; filename=transactions-premium.xls",
        },
      });
    }

    return ok({ transactions: decryptedTx });
  } catch (error) {
    console.error("Export error:", error);
    return fail(error.message, 500);
  }
}

async function generatePDF(user, transactions, startDateStr, endDateStr) {
  const pdfDoc = await PDFDocument.create();
  const { font, bold } = await resolvePdfFonts(pdfDoc, user);
  const scale = getFontSizePreset(user.fontSizePreset).scale;

  const width = 595;
  const height = 842;
  const margin = 40;
  const contentWidth = width - margin * 2;
  const rowHeight = 20;
  let currentPageNum = 0;
  let yPos = height - margin;

  const palette = {
    ink: rgb(0.07, 0.07, 0.08),
    muted: rgb(0.45, 0.45, 0.45),
    line: rgb(0.84, 0.84, 0.84),
    accent: rgb(0.96, 0.68, 0.12),
    accentSoft: rgb(1, 0.97, 0.86),
    surface: rgb(0.97, 0.97, 0.97),
    success: rgb(0.08, 0.48, 0.24),
    danger: rgb(0.66, 0.12, 0.12),
  };

  function addNewPage() {
    currentPageNum++;
    yPos = height - margin - 72;
    return pdfDoc.addPage([width, height]);
  }

  function drawHeader(page) {
    page.drawRectangle({ x: margin, y: height - margin - 62, width: contentWidth, height: 62, color: palette.ink });
    page.drawRectangle({ x: margin, y: height - margin - 62, width: contentWidth, height: 4, color: palette.accent });

    page.drawText("TRANSACTIONS REPORT", {
      x: margin + 10,
      y: height - margin - 24,
      font: bold,
      size: 16 * scale,
      color: rgb(1, 1, 1),
    });

    const dateText = startDateStr && endDateStr
      ? `${startDateStr} to ${endDateStr}`
      : "All Time";
    page.drawText(dateText, {
      x: margin + 10,
      y: height - margin - 42,
      font,
      size: 9 * scale,
      color: rgb(0.7, 0.7, 0.7),
    });

    page.drawRectangle({
      x: width - margin - 84,
      y: height - margin - 41,
      width: 74,
      height: 20,
      color: palette.accentSoft,
      borderColor: palette.accent,
      borderWidth: 0.8,
    });
    page.drawText("PREMIUM", {
      x: width - margin - 73,
      y: height - margin - 28,
      font: bold,
      size: 8 * scale,
      color: rgb(0.45, 0.31, 0.04),
    });

    page.drawText(`Page ${currentPageNum}`, {
      x: width - margin - 42,
      y: height - margin - 53,
      font,
      size: 8 * scale,
      color: rgb(0.72, 0.72, 0.72),
    });
  }

  function drawFooter(page) {
    page.drawLine({
      start: { x: margin, y: 30 },
      end: { x: width - margin, y: 30 },
      thickness: 0.5,
      color: palette.line,
    });

    page.drawText(`Generated on ${formatDateTimeLabel(new Date())}`, {
      x: margin,
      y: 10,
      font,
      size: 8 * scale,
      color: palette.muted,
    });

    page.drawText("MYOWEDUE PREMIUM EXPORT", {
      x: width - margin - 150,
      y: 10,
      font: bold,
      size: 8 * scale,
      color: rgb(0.33, 0.33, 0.33),
    });
  }

  function drawMetricCard(page, x, title, value, tone = "neutral") {
    const tones = {
      neutral: { bg: palette.surface, border: rgb(0.85, 0.85, 0.85), title: rgb(0.34, 0.34, 0.34), value: rgb(0.1, 0.1, 0.1) },
      green: { bg: rgb(0.91, 0.98, 0.93), border: rgb(0.44, 0.72, 0.51), title: rgb(0.06, 0.42, 0.19), value: rgb(0.06, 0.34, 0.16) },
      red: { bg: rgb(1, 0.92, 0.92), border: rgb(0.9, 0.42, 0.42), title: rgb(0.58, 0.12, 0.12), value: rgb(0.49, 0.1, 0.1) },
    };
    const style = tones[tone] || tones.neutral;
    const cardWidth = (contentWidth - 16) / 3;

    page.drawRectangle({ x, y: yPos - 52, width: cardWidth, height: 52, color: style.bg, borderColor: style.border, borderWidth: 0.8 });
    page.drawText(title, { x: x + 10, y: yPos - 18, font, size: 8 * scale, color: style.title });
    page.drawText(value, { x: x + 10, y: yPos - 38, font: bold, size: 12 * scale, color: style.value });
  }

  // First page
  let page = addNewPage();
  drawHeader(page);

  // Summary section
  let creditTotal = 0;
  let debitTotal = 0;
  transactions.forEach(t => {
    if (t.type === "credit") creditTotal += Number(t.amount || 0);
    if (t.type === "debit") debitTotal += Number(t.amount || 0);
  });
  const netAmount = debitTotal - creditTotal;
  const netLabel = netAmount >= 0 ? "You are net positive" : "You need to settle";
  const netColor = netAmount >= 0 ? palette.success : palette.danger;

  page.drawText(`Prepared for ${user.name || "User"} (${user.email || ""})`, {
    x: margin,
    y: yPos - 8,
    font,
    size: 9 * scale,
    color: rgb(0.32, 0.32, 0.32),
  });
  yPos -= 30;

  drawMetricCard(page, margin, "TOTAL TRANSACTIONS", String(transactions.length), "neutral");
  drawMetricCard(page, margin + ((contentWidth - 16) / 3) + 8, "AMOUNT GAVE", money(creditTotal), "red");
  drawMetricCard(page, margin + (((contentWidth - 16) / 3) + 8) * 2, "AMOUNT RECEIVED", money(debitTotal), "green");
  yPos -= 64;

  page.drawRectangle({
    x: margin,
    y: yPos - 36,
    width: contentWidth,
    height: 36,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: netColor,
    borderWidth: 0.8,
  });
  page.drawText(`NET BALANCE: ${netAmount >= 0 ? "+" : "-"}${money(Math.abs(netAmount))}`, {
    x: margin + 10,
    y: yPos - 14,
    font: bold,
    size: 10 * scale,
    color: netColor,
  });
  page.drawText(netLabel, {
    x: margin + 10,
    y: yPos - 27,
    font,
    size: 8 * scale,
    color: netColor,
  });

  yPos -= 46;

  page.drawRectangle({
    x: margin,
    y: yPos - rowHeight,
    width: contentWidth,
    height: rowHeight,
    color: palette.ink,
  });
  page.drawRectangle({ x: margin, y: yPos - rowHeight, width: 3, height: rowHeight, color: palette.accent });

  const col1 = margin + 10;
  const col2 = col1 + 150;
  const col3 = col2 + 80;
  const col4 = col3 + 80;
  const col5 = col4 + 80;

  page.drawText("Person", { x: col1, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
  page.drawText("Type", { x: col2, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
  page.drawText("Amount", { x: col3, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
  page.drawText("Currency", { x: col4, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
  page.drawText("Date", { x: col5, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });

  yPos -= rowHeight + 5;

  // Transactions rows
  for (let idx = 0; idx < transactions.length; idx++) {
    const tx = transactions[idx];
    if (yPos < margin + 50) {
      drawFooter(page);
      page = addNewPage();
      drawHeader(page);
      yPos -= 28;
      page.drawRectangle({ x: margin, y: yPos - rowHeight, width: contentWidth, height: rowHeight, color: palette.ink });
      page.drawRectangle({ x: margin, y: yPos - rowHeight, width: 3, height: rowHeight, color: palette.accent });
      page.drawText("Person", { x: col1, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
      page.drawText("Type", { x: col2, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
      page.drawText("Amount", { x: col3, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
      page.drawText("Currency", { x: col4, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
      page.drawText("Date", { x: col5, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
      yPos -= rowHeight + 5;
    }

    const bgColor = (idx % 2 === 0) ? rgb(0.98, 0.98, 0.98) : rgb(1, 1, 1);
    page.drawRectangle({
      x: margin,
      y: yPos - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: bgColor,
    });

    const textColor = tx.type === "credit" ? palette.danger : palette.success;

    page.drawText((tx.personId?.name || "Unknown").substring(0, 20), { x: col1, y: yPos - 15, font, size: 9 * scale });
    page.drawText(tx.type.toUpperCase(), { x: col2, y: yPos - 15, font: bold, size: 9 * scale, color: textColor });
    page.drawText(money(tx.amount), { x: col3, y: yPos - 15, font, size: 9 * scale });
    page.drawText(tx.currency || "USD", { x: col4, y: yPos - 15, font, size: 9 * scale });
    page.drawText(formatDateOnly(tx.date), { x: col5, y: yPos - 15, font, size: 9 * scale });

    yPos -= rowHeight;
  }

  drawFooter(page);

  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=transactions-${formatDateOnly(new Date())}.pdf`,
    },
  });
}
