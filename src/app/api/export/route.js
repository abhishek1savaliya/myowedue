import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import { ok, fail } from "@/lib/api";
import { activeQuery } from "@/lib/bin";
import { deriveUserKey, decryptTransaction } from "@/lib/crypto";

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
      if (startDateStr) query.date.$gte = new Date(startDateStr);
      if (endDateStr) {
        const endDate = new Date(endDateStr);
        endDate.setDate(endDate.getDate() + 1);
        query.date.$lt = endDate;
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
            new Date(t.date).toISOString(),
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

    return ok({ transactions: decryptedTx });
  } catch (error) {
    console.error("Export error:", error);
    return fail(error.message, 500);
  }
}

async function generatePDF(user, transactions, startDateStr, endDateStr) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const width = 595;
  const height = 842;
  const margin = 40;
  const contentWidth = width - margin * 2;
  const rowHeight = 20;
  let currentPageNum = 0;
  let yPos = height - margin;

  function addNewPage() {
    currentPageNum++;
    yPos = height - margin - 50; // Leave space for header
    return pdfDoc.addPage([width, height]);
  }

  function drawHeader(page) {
    // Background
    page.drawRectangle({ x: margin, y: height - margin - 50, width: contentWidth, height: 50, color: rgb(0.07, 0.07, 0.08) });

    // Title
    page.drawText("TRANSACTIONS REPORT", {
      x: margin + 10,
      y: height - margin - 30,
      font: bold,
      size: 18,
      color: rgb(1, 1, 1),
    });

    // Date range
    const dateText = startDateStr && endDateStr
      ? `${startDateStr} to ${endDateStr}`
      : "All Time";
    page.drawText(dateText, {
      x: margin + 10,
      y: height - margin - 45,
      font,
      size: 10,
      color: rgb(0.7, 0.7, 0.7),
    });

    // Page number at top right
    page.drawText(`Page ${currentPageNum}`, {
      x: width - margin - 50,
      y: height - margin - 30,
      font,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  function drawFooter(page) {
    page.drawLine({
      start: { x: margin, y: 30 },
      end: { x: width - margin, y: 30 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText(`Generated on ${new Date().toLocaleString()}`, {
      x: margin,
      y: 10,
      font,
      size: 8,
      color: rgb(0.6, 0.6, 0.6),
    });

    page.drawText(`${user.name || "User"}`, {
      x: width - margin - 100,
      y: 10,
      font,
      size: 8,
      color: rgb(0.6, 0.6, 0.6),
    });
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

  yPos -= 40;
  page.drawText("Summary", { x: margin, y: yPos, font: bold, size: 14 });
  yPos -= 25;

  page.drawRectangle({
    x: margin,
    y: yPos - 50,
    width: contentWidth,
    height: 60,
    color: rgb(0.95, 0.95, 0.95),
  });

  page.drawText(`Total Transactions: ${transactions.length}`, { x: margin + 10, y: yPos - 10, font: bold, size: 11 });
  page.drawText(`Amount Gave: ${money(creditTotal)}`, { x: margin + 10, y: yPos - 30, font, size: 11, color: rgb(0.8, 0.1, 0.1) });
  page.drawText(`Amount Received: ${money(debitTotal)}`, { x: margin + 10, y: yPos - 50, font, size: 11, color: rgb(0.1, 0.8, 0.1) });

  yPos -= 80;

  // Transactions table header
  page.drawRectangle({
    x: margin,
    y: yPos - rowHeight,
    width: contentWidth,
    height: rowHeight,
    color: rgb(0.1, 0.1, 0.1),
  });

  const col1 = margin + 10;
  const col2 = col1 + 150;
  const col3 = col2 + 80;
  const col4 = col3 + 80;
  const col5 = col4 + 80;

  page.drawText("Person", { x: col1, y: yPos - 15, font: bold, size: 10, color: rgb(1, 1, 1) });
  page.drawText("Type", { x: col2, y: yPos - 15, font: bold, size: 10, color: rgb(1, 1, 1) });
  page.drawText("Amount", { x: col3, y: yPos - 15, font: bold, size: 10, color: rgb(1, 1, 1) });
  page.drawText("Currency", { x: col4, y: yPos - 15, font: bold, size: 10, color: rgb(1, 1, 1) });
  page.drawText("Date", { x: col5, y: yPos - 15, font: bold, size: 10, color: rgb(1, 1, 1) });

  yPos -= rowHeight + 5;

  // Transactions rows
  for (const tx of transactions) {
    if (yPos < margin + 50) {
      drawFooter(page);
      page = addNewPage();
      drawHeader(page);
      yPos -= 40;
    }

    const bgColor = (transactions.indexOf(tx) % 2 === 0) ? rgb(0.97, 0.97, 0.97) : rgb(1, 1, 1);
    page.drawRectangle({
      x: margin,
      y: yPos - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: bgColor,
    });

    const textColor = tx.type === "credit" ? rgb(0.8, 0.1, 0.1) : rgb(0.1, 0.8, 0.1);

    page.drawText((tx.personId?.name || "Unknown").substring(0, 20), { x: col1, y: yPos - 15, font, size: 9 });
    page.drawText(tx.type.toUpperCase(), { x: col2, y: yPos - 15, font, size: 9, color: textColor });
    page.drawText(money(tx.amount), { x: col3, y: yPos - 15, font, size: 9 });
    page.drawText(tx.currency || "USD", { x: col4, y: yPos - 15, font, size: 9 });
    page.drawText(new Date(tx.date).toLocaleDateString(), { x: col5, y: yPos - 15, font, size: 9 });

    yPos -= rowHeight;
  }

  drawFooter(page);

  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=transactions-${new Date().toISOString().slice(0, 10)}.pdf`,
    },
  });
}
