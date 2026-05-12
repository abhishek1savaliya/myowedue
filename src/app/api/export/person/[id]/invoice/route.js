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
import { supportsPremiumExports } from "@/lib/subscription";
import { enqueuePdf } from "@/lib/queue/producers";

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
    
    if (scope === "credit") {
      query.type = "credit";
    }
    if (scope === "debit") {
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

    const invoiceJobId = await enqueuePdf("export-invoice", {
      type: "export-invoice",
      transactions: decryptedTransactions.map((tx) => ({
        amount: Number(tx.amount || 0),
        type: tx.type,
        currency: tx.currency || "USD",
        date: tx.date,
        status: tx.status,
        notes: tx.notes,
      })),
      userName: user.name,
      userEmail: user.email,
      personName: person.name,
      personEmail: person.email,
      targetCurrency,
      scope,
    });
    if (invoiceJobId) {
      return Response.json({ jobId: invoiceJobId, status: "processing" }, { status: 202 });
    }

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
    const isPremiumPdf = supportsPremiumExports(user);

    const width = 595;
    const height = 842;
    const margin = 52;
    const contentWidth = width - margin * 2;
    const rightEdge = margin + contentWidth;
    const rowHeight = 19;

    const black = rgb(0.06, 0.06, 0.06);
    const gray = rgb(0.42, 0.42, 0.42);
    const lineCol = rgb(0.88, 0.88, 0.88);
    const zebra = rgb(0.985, 0.985, 0.985);
    const amber = rgb(0.92, 0.58, 0.08);
    const emerald = rgb(0.06, 0.52, 0.4);

    const invoiceNo = `INV-${String(person._id).slice(-8).toUpperCase()}-${scope.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const invoiceDateStr = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const drawLine = (pg, yLine, thickness = 0.75) => {
      pg.drawLine({
        start: { x: margin, y: yLine },
        end: { x: rightEdge, y: yLine },
        thickness,
        color: lineCol,
      });
    };

    const drawPlus = (pg, cx, cy, s = 4.5) => {
      pg.drawLine({ start: { x: cx - s, y: cy }, end: { x: cx + s, y: cy }, thickness: 1.1, color: black });
      pg.drawLine({ start: { x: cx, y: cy - s }, end: { x: cx, y: cy + s }, thickness: 1.1, color: black });
    };

    const widthOf = (text, size, f = font) => f.widthOfTextAtSize(text, size);

    const drawRight = (pg, text, size, f, color, baselineY) => {
      const w = widthOf(text, size, f);
      pg.drawText(text, { x: rightEdge - w, y: baselineY, size, font: f, color });
    };

    const blankPage = (pg) => {
      pg.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
    };

    let page = pdfDoc.addPage([width, height]);
    blankPage(page);
    let y = height - margin;

    const col = {
      desc: margin + 6,
      amt: margin + 248,
      tot: margin + 338,
      st: margin + 408,
      dt: margin + 468,
    };

    const drawInvoiceTop = (pg, yy) => {
      let t = yy;
      drawPlus(pg, margin + 7, t - 9, 4.5);
      pg.drawText("OWE DUE", { x: margin + 18, y: t - 14, size: 20, font: bold, color: black });
      pg.drawText("Personal credit & debit clarity", { x: margin + 18, y: t - 30, size: 8.5, font, color: gray });
      pg.drawLine({
        start: { x: margin + 18, y: t - 34 },
        end: { x: margin + 168, y: t - 34 },
        thickness: 2,
        color: amber,
      });

      const invWord = "Invoice";
      drawRight(pg, invWord, 30, bold, black, t - 4);
      drawRight(pg, "Invoice No.", 8, bold, gray, t - 26);
      drawRight(pg, invoiceNo, 9, bold, black, t - 38);
      drawRight(pg, "Date", 8, bold, gray, t - 52);
      drawRight(pg, invoiceDateStr, 9, bold, black, t - 64);
      if (isPremiumPdf) {
        drawRight(pg, "Premium", 7, bold, emerald, t - 76);
      }
      return t - 92;
    };

    const drawParties = (pg, yy) => {
      let t = yy;
      pg.drawText("From", { x: margin, y: t, size: 9, font: bold, color: black });
      drawRight(pg, "Billed to:", 9, bold, black, t);
      t -= 14;
      pg.drawText(String(user.name || ""), { x: margin, y: t, size: 9, font, color: black });
      drawRight(pg, String(person.name || ""), 9, font, black, t);
      t -= 12;
      pg.drawText(String(user.email || ""), { x: margin, y: t, size: 8.5, font, color: gray });
      drawRight(pg, String(person.email || "—"), 8.5, font, gray, t);
      t -= 11;
      pg.drawText(user.phone ? String(user.phone) : "—", { x: margin, y: t, size: 8.5, font, color: gray });
      drawRight(pg, String(person.phone || "—"), 8.5, font, gray, t);
      return t - 18;
    };

    const drawTableHeaderRow = (pg) => {
      pg.drawText("Description", { x: col.desc, y, size: 8.5, font: bold, color: black });
      pg.drawText("Amount", { x: col.amt, y, size: 8.5, font: bold, color: black });
      pg.drawText("Total", { x: col.tot, y, size: 8.5, font: bold, color: black });
      pg.drawText("Status", { x: col.st, y, size: 8.5, font: bold, color: black });
      pg.drawText("Date", { x: col.dt, y, size: 8.5, font: bold, color: black });
      y -= rowHeight;
      drawLine(pg, y + 4);
      y -= 6;
    };

    const ensureSpace = (need = rowHeight + 8) => {
      if (y - need < margin + 100) {
        page = pdfDoc.addPage([width, height]);
        blankPage(page);
        y = height - margin;
        page.drawText("OWE DUE — continued", { x: margin, y, size: 9, font: bold, color: gray });
        y -= 16;
        drawLine(page, y + 6);
        y -= 14;
        drawTableHeaderRow(page);
      }
    };

    y = drawInvoiceTop(page, y);
    drawLine(page, y + 8);
    y -= 20;
    y = drawParties(page, y);
    drawLine(page, y + 6);
    y -= 18;

    const scopeLine =
      scope === "all" ? `Scope: All entries · Currency: ${targetCurrency}` : `Scope: ${scope.toUpperCase()} · Currency: ${targetCurrency}`;
    page.drawText(`${transactions.length} line items · ${pendingCount} pending · ${scopeLine}`, {
      x: margin,
      y,
      size: 8,
      font,
      color: gray,
    });
    y -= 22;

    page.drawText("Outstanding balance", { x: margin, y, size: 8, font: bold, color: gray });
    drawRight(page, `${money(remainingAmount)} ${targetCurrency}`, 11, bold, black, y);
    page.drawText(short(remainingLabel, 72), { x: margin, y: y - 12, size: 7.5, font, color: gray });
    y -= 28;

    drawLine(page, y + 8);
    y -= 18;
    drawTableHeaderRow(page);

    if (!transactions.length) {
      ensureSpace();
      page.drawText("No transactions in this view.", { x: col.desc, y, size: 9, font, color: gray });
      y -= rowHeight;
    } else {
      convertedTransactions.forEach((tx, idx) => {
        ensureSpace();
        if (idx % 2 === 0) {
          page.drawRectangle({ x: margin, y: y - rowHeight + 2, width: contentWidth, height: rowHeight, color: zebra });
        }
        const isCredit = tx.type === "credit";
        const tone = isCredit ? emerald : amber;
        const amountLabel =
          tx.currency === targetCurrency
            ? `${money(tx.originalAmount)} ${tx.currency}`
            : `${money(tx.originalAmount)} ${tx.currency}`;
        const totalLabel = `${money(tx.convertedAmount)} ${targetCurrency}`;
        const desc = `${tx.type.toUpperCase()} · ${short(tx.notes || "—", 48)}`;
        page.drawText(short(desc, 52), { x: col.desc, y, size: 7.5, font: bold, color: tone });
        page.drawText(short(amountLabel, 18), { x: col.amt, y, size: 7.5, font, color: black });
        page.drawText(totalLabel, { x: col.tot, y, size: 7.5, font: bold, color: black });
        page.drawText(tx.status.toUpperCase(), { x: col.st, y, size: 7.5, font, color: gray });
        page.drawText(new Date(tx.date).toLocaleDateString(), { x: col.dt, y, size: 7.5, font, color: gray });
        y -= rowHeight;
      });
    }

    drawLine(page, y + 6);
    y -= 20;

    const signedText = `${signedScopeTotal >= 0 ? "+" : "-"}${money(Math.abs(signedScopeTotal))} ${targetCurrency}`;
    const isNegative = signedScopeTotal < 0;
    const summaryMessage = isNegative
      ? `${person.name} -> send to ${userFirstName}`
      : `${userFirstName} -> pay ${person.name}`;

    page.drawText("Due / notes", { x: margin, y, size: 8, font: bold, color: gray });
    page.drawText(short(summaryMessage, 85), { x: margin, y: y - 12, size: 8, font, color: gray });

    drawRight(page, "Net (this scope)", 8, bold, gray, y);
    drawRight(page, signedText, 9, font, black, y - 12);
    drawRight(page, "Total outstanding", 8, bold, gray, y - 28);
    drawRight(page, `${money(remainingAmount)} ${targetCurrency}`, 11, bold, black, y - 40);
    y -= 56;

    if (conversionNotes.length) {
      ensureSpace(40);
      drawLine(page, y + 8);
      y -= 14;
      page.drawText("FX reference", { x: margin, y, size: 8, font: bold, color: black });
      y -= 12;
      conversionNotes.forEach((note) => {
        page.drawText(short(note, 95), { x: margin, y, size: 7.5, font, color: gray });
        y -= 11;
      });
      page.drawText(`As of ${conversionTimestamp}`, { x: margin, y, size: 7, font: font, color: gray });
      y -= 16;
    }

    ensureSpace(72);
    drawLine(page, y + 8);
    y -= 22;
    page.drawText("Summary", { x: margin, y, size: 8, font: bold, color: black });
    y -= 12;
    page.drawText(`Credits recorded: ${money(creditTotal)} ${targetCurrency}`, { x: margin, y, size: 8, font, color: gray });
    y -= 11;
    page.drawText(`Debits recorded: ${money(debitTotal)} ${targetCurrency}`, { x: margin, y, size: 8, font, color: gray });
    y -= 11;
    page.drawText(`Outstanding: ${money(remainingAmount)} ${targetCurrency}`, { x: margin, y, size: 8, font: bold, color: black });
    y -= 28;

    drawLine(page, y + 8);
    y -= 22;
    const footerY = Math.max(margin + 52, y);
    page.drawText("Contact", { x: margin, y: footerY, size: 9, font: bold, color: black });
    page.drawText("Payment", { x: margin + 280, y: footerY, size: 9, font: bold, color: black });
    let fy = footerY - 14;
    page.drawText(process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@myowedue.com", { x: margin, y: fy, size: 8, font, color: gray });
    page.drawText("Settle per your agreement with the counterparty.", { x: margin + 280, y: fy, size: 8, font, color: gray });
    fy -= 11;
    page.drawText(String(user.email), { x: margin, y: fy, size: 8, font, color: gray });
    page.drawText("OWE DUE · myowedue.com", { x: margin + 280, y: fy, size: 8, font, color: gray });

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const pageLabel = (i) => `Page ${i + 1} of ${totalPages}`;
    pages.forEach((pdfPage, index) => {
      const label = pageLabel(index);
      pdfPage.drawText(label, {
        x: width - margin - widthOf(label, 8),
        y: 22,
        size: 8,
        font,
        color: gray,
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
