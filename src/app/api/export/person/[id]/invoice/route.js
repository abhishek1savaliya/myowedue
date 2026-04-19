import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { fail } from "@/lib/api";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";
import { activeQuery } from "@/lib/bin";
import { normalizeCurrency, convertFromUSD } from "@/lib/currency";
import { getUsdRatesForUsage } from "@/lib/exchangeRates";
import { deriveUserKey, decryptTransaction } from "@/lib/crypto";

export const runtime = "nodejs";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function short(text, max = 34) {
  const str = String(text || "");
  return str.length > max ? `${str.slice(0, max - 1)}...` : str;
}

function firstName(fullName, fallback = "User") {
  const cleaned = String(fullName || "").trim();
  if (!cleaned) return fallback;
  return cleaned.split(/\s+/)[0] || fallback;
}

const ALLOWED_CURRENCIES = new Set(["USD", "AUD", "INR", "EUR", "GBP"]);

function getScope(searchParams) {
  const scope = (searchParams.get("scope") || "all").toLowerCase();
  if (["pending", "credit", "debit", "all"].includes(scope)) return scope;
  return "all";
}

function resolveCurrency(rawCurrency) {
  const normalized = String(rawCurrency || "AUD").toUpperCase();
  return ALLOWED_CURRENCIES.has(normalized) ? normalized : "AUD";
}

function getRate(currency, rates) {
  return Number(rates?.[currency] || 1);
}

function convertCurrencyAmount(amount, fromCurrency, toCurrency, usdRates) {
  const numericAmount = Number(amount || 0);
  if (fromCurrency === toCurrency) return numericAmount;
  const amountInUsd = normalizeCurrency(numericAmount, fromCurrency || "USD", usdRates);
  return convertFromUSD(amountInUsd, toCurrency, usdRates);
}

function getConversionRate(fromCurrency, toCurrency, usdRates) {
  if (fromCurrency === toCurrency) return null;
  const fromRate = getRate(fromCurrency, usdRates);
  const toRate = getRate(toCurrency, usdRates);
  if (!fromRate || !toRate) return null;
  return toRate / fromRate;
}

export async function GET(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const scope = getScope(searchParams);
    const targetCurrency = resolveCurrency(searchParams.get("currency"));
    const startDateStr = searchParams.get("start"); // YYYY-MM-DD
    const endDateStr = searchParams.get("end"); // YYYY-MM-DD
    const usdRates = await getUsdRatesForUsage();
    const conversionTimestamp = new Date().toLocaleString();

    await connectDB();

    const person = await Person.findOne({ _id: id, userId: user._id, ...activeQuery() }).lean();
    if (!person) return fail("Person not found", 404);

    const query = { userId: user._id, personId: person._id, ...activeQuery() };
    
    // Add date range filter if provided
    if (startDateStr || endDateStr) {
      query.date = {};
      if (startDateStr) {
        query.date.$gte = new Date(startDateStr);
      }
      if (endDateStr) {
        // Add 1 day to endDate to include the entire end date
        const endDate = new Date(endDateStr);
        endDate.setDate(endDate.getDate() + 1);
        query.date.$lt = endDate;
      }
    }
    
    if (scope === "pending") {
      query.status = "pending";
    }
    if (scope === "credit") {
      query.status = "pending";
      query.type = "credit";
    }
    if (scope === "debit") {
      query.status = "pending";
      query.type = "debit";
    }

    // For allTransactions, also apply date range
    const allTransactionsQuery = { userId: user._id, personId: person._id, ...activeQuery() };
    if (startDateStr || endDateStr) {
      allTransactionsQuery.date = {};
      if (startDateStr) {
        allTransactionsQuery.date.$gte = new Date(startDateStr);
      }
      if (endDateStr) {
        const endDate = new Date(endDateStr);
        endDate.setDate(endDate.getDate() + 1);
        allTransactionsQuery.date.$lt = endDate;
      }
    }

    const [transactions, allTransactions] = await Promise.all([
      Transaction.find(query).sort({ date: -1 }).lean(),
      Transaction.find(allTransactionsQuery).lean(),
    ]);

    // Derive encryption key for decryption
    const userKey = await deriveUserKey(user._id.toString(), user.email);

    // Decrypt transactions
    const decryptedTransactions = await Promise.all(
      transactions.map(async (tx) => {
        try {
          if (tx.encryptedAmount) {
            const decrypted = await decryptTransaction(tx, userKey);
            return { ...tx, amount: decrypted.amount, notes: decrypted.notes };
          }
          return tx;
        } catch (err) {
          console.error(`Failed to decrypt transaction ${tx._id}:`, err.message);
          return tx;
        }
      })
    );

    const decryptedAllTransactions = await Promise.all(
      allTransactions.map(async (tx) => {
        try {
          if (tx.encryptedAmount) {
            const decrypted = await decryptTransaction(tx, userKey);
            return { ...tx, amount: decrypted.amount, notes: decrypted.notes };
          }
          return tx;
        } catch (err) {
          console.error(`Failed to decrypt transaction ${tx._id}:`, err.message);
          return tx;
        }
      })
    );

    const convertedTransactions = decryptedTransactions.map((tx) => {
      const originalAmount = Number(tx.amount || 0);
      const convertedAmount = convertCurrencyAmount(originalAmount, tx.currency || "USD", targetCurrency, usdRates);
      const conversionRate = getConversionRate(tx.currency || "USD", targetCurrency, usdRates);
      return { ...tx, originalAmount, convertedAmount, conversionRate };
    });

    const convertedAllTransactions = decryptedAllTransactions.map((tx) => {
      const originalAmount = Number(tx.amount || 0);
      const convertedAmount = convertCurrencyAmount(originalAmount, tx.currency || "USD", targetCurrency, usdRates);
      return { ...tx, originalAmount, convertedAmount };
    });

    const signedScopeTotal = convertedTransactions.reduce(
      (sum, tx) => sum + (tx.type === "credit" ? -tx.convertedAmount : tx.convertedAmount),
      0
    );
    const creditTotal = convertedAllTransactions
      .filter((tx) => tx.type === "credit")
      .reduce((sum, tx) => sum + tx.convertedAmount, 0);
    const debitTotal = convertedAllTransactions
      .filter((tx) => tx.type === "debit")
      .reduce((sum, tx) => sum + tx.convertedAmount, 0);
    const remainingAmount = Math.abs(creditTotal - debitTotal);
    const userNeedsToPay = debitTotal > creditTotal;
    const userFirstName = firstName(user.name, "User");
    const personFirstName = firstName(person.name, "Person");
    const remainingLabel = userNeedsToPay
      ? `${userFirstName} needs to pay ${person.name}`
      : `${person.name} needs to pay ${userFirstName}`;
    const pendingCount = allTransactions.filter((tx) => tx.status === "pending").length;
    const conversionNotes = [];
    const conversionNoteMap = new Map();
    convertedTransactions.forEach((tx) => {
      if (tx.conversionRate && tx.currency !== targetCurrency) {
        conversionNoteMap.set(
          tx.currency,
          `1 ${targetCurrency} = ${money(tx.conversionRate)} ${tx.currency}`
        );
      }
    });
    for (const note of conversionNoteMap.values()) {
      conversionNotes.push(note);
    }

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
      page.drawText("All in one solution myowedue", {
        x: margin + 14,
        y: y - 40,
        size: 11,
        font,
        color: rgb(0.95, 0.95, 0.95),
      });
      page.drawText(`Generated: ${new Date().toLocaleString()}`, {
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

      page.drawText(`${remainingLabel}: ${money(remainingAmount)} ${targetCurrency}`, {
        x: margin + 12,
        y: y - 42,
        size: 14,
        font: bold,
        color: valueColor,
      });

      y -= 68;
    };

    const drawBottomInsightChart = (targetPage, startY) => {
      const chartX = margin;
      const chartWidth = contentWidth;
      const chartHeight = 80;
      const chartY = startY - chartHeight;

      const metrics = [
        { label: `Given by ${userFirstName}`, value: creditTotal, color: rgb(0.9, 0.33, 0.33) },
        { label: `Received by ${userFirstName}`, value: debitTotal, color: rgb(0.21, 0.62, 0.33) },
        {
          label: `Remaining by ${userNeedsToPay ? userFirstName : personFirstName}`,
          value: remainingAmount,
          color: rgb(0.19, 0.42, 0.84),
        },
      ];

      const maxMetricValue = Math.max(...metrics.map((metric) => metric.value), 1);
      const barX = chartX + 160;
      const barMaxWidth = chartWidth - 270;

      targetPage.drawRectangle({
        x: chartX,
        y: chartY,
        width: chartWidth,
        height: chartHeight,
        color: rgb(0.96, 0.98, 1),
        borderWidth: 0.8,
        borderColor: rgb(0.74, 0.82, 0.94),
      });

      targetPage.drawText("INSIGHT CHART", {
        x: chartX + 10,
        y: chartY + chartHeight - 14,
        size: 9,
        font: bold,
        color: rgb(0.18, 0.3, 0.53),
      });
      targetPage.drawText(`Between ${userFirstName} and ${personFirstName}`, {
        x: chartX + 110,
        y: chartY + chartHeight - 14,
        size: 8,
        font,
        color: rgb(0.24, 0.33, 0.52),
      });

      metrics.forEach((metric, index) => {
        const rowY = chartY + chartHeight - 30 - index * 18;
        const barWidth = Math.max(2, (metric.value / maxMetricValue) * barMaxWidth);

        targetPage.drawText(metric.label, {
          x: chartX + 10,
          y: rowY,
          size: 8,
          font,
          color: rgb(0.23, 0.23, 0.23),
        });

        targetPage.drawRectangle({
          x: barX,
          y: rowY - 1,
          width: barMaxWidth,
          height: 8,
          color: rgb(0.9, 0.92, 0.96),
        });

        targetPage.drawRectangle({
          x: barX,
          y: rowY - 1,
          width: barWidth,
          height: 8,
          color: metric.color,
        });

        targetPage.drawText(`${money(metric.value)} ${targetCurrency}`, {
          x: barX + barMaxWidth + 8,
          y: rowY,
          size: 8,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
      });

      return chartY - 10;
    };

    const drawTableHeader = () => {
      page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: rgb(0.08, 0.08, 0.08) });
      page.drawText("Type", { x: margin + 8, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Amount", { x: margin + 92, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Total", { x: margin + 220, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Status", { x: margin + 310, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Date", { x: margin + 380, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Notes", { x: margin + 460, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
      y -= rowHeight;
    };

    const ensureSpace = (spaceNeeded = rowHeight) => {
      if (y - spaceNeeded < margin + 26) {
        page = pdfDoc.addPage([width, height]);
        y = height - margin;
        drawTableHeader();
      }
    };

    drawHeader();

    page.drawText("Billed by:", {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    page.drawText(`${user.name} (${user.email})`, {
      x: margin + 38,
      y,
      size: 9,
      font: bold,
      color: rgb(0.08, 0.38, 0.72),
    });
    page.drawText("Invoice To:", {
      x: margin + 300,
      y,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    page.drawText(person.name, {
      x: margin + 346,
      y,
      size: 9,
      font: bold,
      color: rgb(0.63, 0.1, 0.1),
    });
    y -= 18;

    page.drawText(`Person email: ${person.email || "N/A"}`, {
      x: margin,
      y,
      size: 8.5,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    page.drawText(`Person phone: ${person.phone || "N/A"}`, {
      x: margin + 240,
      y,
      size: 8.5,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 16;

    page.drawText(`Invoice currency: ${targetCurrency}`, {
      x: margin,
      y,
      size: 8.5,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 14;

    page.drawText(
      scope === "all"
        ? "Scope detail: All entries (credit + debit, all statuses)"
        : `Scope detail: ${scope.toUpperCase()} entries`,
      {
        x: margin,
        y,
        size: 8.5,
        font,
        color: rgb(0.35, 0.35, 0.35),
      }
    );
    y -= 16;

    drawCard(margin, "ENTRY COUNT", String(transactions.length), "neutral");
    drawCard(margin + 177, "PENDING ENTRIES", String(pendingCount), "neutral");
    y -= 70;

    drawRemainingBanner();

    drawTableHeader();

    if (!transactions.length) {
      ensureSpace();
      page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: rgb(0.98, 0.98, 0.98) });
      page.drawText("No transactions found for this scope.", {
        x: margin + 8,
        y: y - 15,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= rowHeight;
    } else {
      convertedTransactions.forEach((tx, idx) => {
        ensureSpace();
        if (idx % 2 === 0) {
          page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: rgb(0.98, 0.98, 0.98) });
        }

        const isCredit = tx.type === "credit";
        const typeColor = isCredit ? rgb(0.06, 0.47, 0.22) : rgb(0.6, 0.1, 0.1);
        const amountLabel =
          tx.currency === targetCurrency
            ? `${money(tx.originalAmount)} ${tx.currency}`
            : `${money(tx.originalAmount)} ${tx.currency} × ${money(tx.conversionRate)}`;
        const totalLabel = `${money(tx.convertedAmount)} ${targetCurrency}`;

        page.drawText(tx.type.toUpperCase(), { x: margin + 8, y: y - 15, size: 8.5, font: bold, color: typeColor });
        page.drawText(amountLabel, { x: margin + 92, y: y - 15, size: 8.5, font: bold, color: typeColor });
        page.drawText(totalLabel, { x: margin + 220, y: y - 15, size: 8.5, font: bold, color: typeColor });
        page.drawText(tx.status.toUpperCase(), { x: margin + 310, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
        page.drawText(new Date(tx.date).toLocaleDateString(), { x: margin + 380, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
        page.drawText(short(tx.notes || "-", 28), { x: margin + 460, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
        y -= rowHeight;
      });
    }

    const signedText = `${signedScopeTotal >= 0 ? "+" : "-"}${money(Math.abs(signedScopeTotal))} ${targetCurrency}`;
    const isNegative = signedScopeTotal < 0;
    const summaryColor = isNegative ? rgb(0.65, 0.1, 0.1) : rgb(0.06, 0.47, 0.22);
    const summaryMessage = isNegative
      ? `${person.name}, please send ${userFirstName} this amount ASAP`
      : `${userFirstName} will pay ${person.name} ASAP`;

    const conversionAreaHeight = conversionNotes.length ? 18 + conversionNotes.length * 14 + 14 : 0;
    const chartAreaHeight = 98;
    ensureSpace(54 + conversionAreaHeight + chartAreaHeight);

    page.drawRectangle({
      x: margin,
      y: y - 40,
      width: contentWidth,
      height: 40,
      color: rgb(0.97, 0.97, 0.97),
      borderWidth: 0.8,
      borderColor: summaryColor,
    });
    page.drawText(`NET TOTAL (${scope.toUpperCase()}): ${signedText}`, {
      x: margin + 10,
      y: y - 16,
      size: 10,
      font: bold,
      color: summaryColor,
    });
    page.drawText(summaryMessage, {
      x: margin + 10,
      y: y - 31,
      size: 9,
      font,
      color: summaryColor,
    });
    y -= 48;

    if (conversionNotes.length) {
      const noteX = margin + contentWidth - 180;
      page.drawText("Currency conversion rates:", {
        x: noteX,
        y: y - 15,
        size: 8,
        font: bold,
        color: rgb(0.25, 0.25, 0.25),
      });
      y -= 18;
      conversionNotes.forEach((note) => {
        page.drawText(note, {
          x: noteX,
          y: y - 12,
          size: 8,
          font,
          color: rgb(0.35, 0.35, 0.35),
        });
        y -= 14;
      });
      page.drawText(`As of ${conversionTimestamp}`, {
        x: noteX,
        y: y - 10,
        size: 7.5,
        font,
        color: rgb(0.45, 0.45, 0.45),
      });
      y -= 18;
    }

    y = drawBottomInsightChart(page, y);

    page.drawText("Generated by MYOWEDUE", {
      x: margin,
      y: 18,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    pages.forEach((pdfPage, index) => {
      pdfPage.drawText(`Page ${index + 1} of ${totalPages}`, {
        x: pdfPage.getWidth() - margin - 70,
        y: 18,
        size: 8,
        font,
        color: rgb(0.45, 0.45, 0.45),
      });
    });

    const pdfBuffer = Buffer.from(await pdfDoc.save());

    const safeName = (person.name || "person")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${safeName}-${scope}-invoice.pdf`,
      },
    });
  } catch (error) {
    console.error("Person invoice generation error:", error);
    const message =
      process.env.NODE_ENV === "development"
        ? error?.message || "Failed to generate invoice"
        : "Failed to generate invoice";
    return fail(message, 500);
  }
}
