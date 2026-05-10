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
    /** Serif for headings / luxury feel; sans for dense table rows (matches app display + body pairing). */
    const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontSerifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const isPremiumPdf = supportsPremiumExports(user);

    const width = 595;
    const height = 842;
    const margin = 40;
    const contentWidth = width - margin * 2;
    const rowHeight = 22;

    let page = pdfDoc.addPage([width, height]);
    let y = height - margin;

    /** Warm stone, amber, emerald — aligned with app `globals.css` / OWE DUE brand. */
    const theme = {
      pagePaper: rgb(0.99, 0.978, 0.952),
      frameGold: rgb(0.78, 0.66, 0.42),
      ink: rgb(0.11, 0.1, 0.09),
      inkMuted: rgb(0.38, 0.34, 0.3),
      inkSoft: rgb(0.52, 0.47, 0.42),
      accentAmber: rgb(0.94, 0.62, 0.12),
      accentAmberDeep: rgb(0.72, 0.48, 0.08),
      accentEmerald: rgb(0.06, 0.65, 0.48),
      accentEmeraldSoft: rgb(0.12, 0.55, 0.42),
      headerBg: rgb(0.13, 0.11, 0.095),
      headerStripeGold: rgb(0.93, 0.72, 0.26),
      headerStripeEmerald: rgb(0.1, 0.58, 0.44),
      headerText: rgb(0.99, 0.98, 0.95),
      headerSub: rgb(0.82, 0.76, 0.66),
      metricNeutral: {
        bg: rgb(0.99, 0.97, 0.93),
        border: rgb(0.82, 0.7, 0.48),
        title: rgb(0.42, 0.36, 0.28),
        value: rgb(0.14, 0.12, 0.1),
      },
      metricYellow: {
        bg: rgb(0.995, 0.97, 0.88),
        border: rgb(0.9, 0.72, 0.28),
        title: rgb(0.48, 0.36, 0.12),
        value: rgb(0.32, 0.22, 0.06),
      },
      metricRed: {
        bg: rgb(0.99, 0.93, 0.92),
        border: rgb(0.78, 0.38, 0.36),
        title: rgb(0.52, 0.14, 0.12),
        value: rgb(0.42, 0.1, 0.1),
      },
      metricGreen: {
        bg: rgb(0.93, 0.99, 0.96),
        border: rgb(0.35, 0.68, 0.52),
        title: rgb(0.1, 0.42, 0.28),
        value: rgb(0.06, 0.32, 0.2),
      },
      tableHeaderBg: rgb(0.26, 0.21, 0.16),
      tableHeaderAccent: rgb(0.94, 0.62, 0.12),
      tableHeaderText: rgb(0.99, 0.96, 0.9),
      rowAlt: rgb(0.992, 0.988, 0.978),
      rowLine: rgb(0.9, 0.86, 0.78),
      summaryBg: rgb(0.99, 0.975, 0.94),
      footer: rgb(0.48, 0.42, 0.36),
      chartBg: rgb(0.99, 0.975, 0.94),
      chartBorder: rgb(0.82, 0.72, 0.52),
      chartTrack: rgb(0.93, 0.9, 0.84),
      chartTitle: rgb(0.28, 0.22, 0.16),
      chartSubtitle: rgb(0.45, 0.4, 0.34),
    };

    const drawPageCanvas = (targetPage) => {
      targetPage.drawRectangle({ x: 0, y: 0, width, height, color: theme.pagePaper });
      targetPage.drawRectangle({
        x: 22,
        y: 22,
        width: width - 44,
        height: height - 44,
        color: theme.pagePaper,
        borderWidth: 1.1,
        borderColor: theme.frameGold,
      });
    };

    drawPageCanvas(page);

    const drawHeader = () => {
      const bandH = 88;
      page.drawRectangle({ x: margin, y: y - bandH, width: contentWidth, height: bandH, color: theme.headerBg });
      page.drawRectangle({ x: margin, y: y - bandH, width: 5, height: bandH, color: theme.headerStripeGold });
      page.drawRectangle({ x: margin + 5, y: y - bandH, width: 3, height: bandH, color: theme.headerStripeEmerald });
      page.drawRectangle({ x: margin + 8, y: y - bandH, width: 4, height: bandH, color: theme.headerStripeGold });
      if (isPremiumPdf) {
        page.drawRectangle({
          x: margin + contentWidth - 6,
          y: y - bandH,
          width: 6,
          height: bandH,
          color: theme.headerStripeEmerald,
        });
      }

      page.drawText("STATEMENT OF ACCOUNT", {
        x: margin + 22,
        y: y - 20,
        size: 8.5,
        font: fontSerifBold,
        color: theme.headerSub,
      });
      page.drawText("OWE DUE", {
        x: margin + 22,
        y: y - 40,
        size: 22,
        font: fontSerifBold,
        color: theme.headerText,
      });
      page.drawText("Personal credit & debit clarity", {
        x: margin + 22,
        y: y - 58,
        size: 10,
        font: fontSerif,
        color: theme.headerSub,
      });
      page.drawText(`Issued ${new Date().toLocaleDateString()} · ${new Date().toLocaleTimeString()}`, {
        x: margin + 22,
        y: y - 74,
        size: 8,
        font: font,
        color: theme.headerSub,
      });
      if (isPremiumPdf) {
        page.drawRectangle({
          x: margin + contentWidth - 86,
          y: y - 36,
          width: 74,
          height: 18,
          color: theme.accentAmber,
          borderWidth: 0.4,
          borderColor: theme.accentAmberDeep,
        });
        page.drawText("PREMIUM", {
          x: margin + contentWidth - 78,
          y: y - 30,
          size: 8,
          font: bold,
          color: theme.headerBg,
        });
      }
      y -= bandH + 20;
    };

    const drawCard = (x, title, value, tone = "neutral") => {
      const palette = {
        neutral: theme.metricNeutral,
        yellow: theme.metricYellow,
        red: theme.metricRed,
        green: theme.metricGreen,
      };
      const style = palette[tone] || palette.neutral;

      page.drawRectangle({ x, y: y - 56, width: 166, height: 56, color: style.bg, borderWidth: 1, borderColor: style.border });
      page.drawText(title, {
        x: x + 10,
        y: y - 20,
        size: 7.5,
        font: fontSerif,
        color: style.title,
      });
      page.drawText(value, {
        x: x + 10,
        y: y - 42,
        size: 14,
        font: fontSerifBold,
        color: style.value,
      });
    };

    const drawRemainingBanner = () => {
      const bg = userNeedsToPay ? theme.metricYellow.bg : theme.metricRed.bg;
      const border = userNeedsToPay ? theme.metricYellow.border : theme.metricRed.border;
      const titleColor = userNeedsToPay ? theme.metricYellow.title : theme.metricRed.title;
      const valueColor = userNeedsToPay ? theme.metricYellow.value : theme.metricRed.value;

      page.drawRectangle({
        x: margin,
        y: y - 62,
        width: contentWidth,
        height: 62,
        color: bg,
        borderWidth: 1.2,
        borderColor: border,
      });
      page.drawRectangle({ x: margin, y: y - 62, width: 4, height: 62, color: userNeedsToPay ? theme.accentAmber : theme.accentAmberDeep });

      page.drawText("OUTSTANDING BALANCE", {
        x: margin + 14,
        y: y - 22,
        size: 8,
        font: fontSerifBold,
        color: titleColor,
      });

      page.drawText(`${remainingLabel}`, {
        x: margin + 14,
        y: y - 38,
        size: 10,
        font: fontSerif,
        color: titleColor,
      });
      page.drawText(`${money(remainingAmount)} ${targetCurrency}`, {
        x: margin + 14,
        y: y - 54,
        size: 16,
        font: fontSerifBold,
        color: valueColor,
      });

      y -= 74;
    };

    const drawBottomInsightChart = (targetPage, startY) => {
      const chartX = margin;
      const chartWidth = contentWidth;
      const chartHeight = 80;
      const chartY = startY - chartHeight;

      const metrics = [
        { label: `Given by ${userFirstName}`, value: creditTotal, color: theme.accentAmber },
        { label: `Received by ${userFirstName}`, value: debitTotal, color: theme.accentEmerald },
        {
          label: `Remaining by ${userNeedsToPay ? userFirstName : personFirstName}`,
          value: remainingAmount,
          color: theme.accentAmberDeep,
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
        color: theme.chartBg,
        borderWidth: 0.8,
        borderColor: theme.chartBorder,
      });

      targetPage.drawText("BALANCE OVERVIEW", {
        x: chartX + 10,
        y: chartY + chartHeight - 14,
        size: 9,
        font: fontSerifBold,
        color: theme.chartTitle,
      });
      targetPage.drawText(`${userFirstName} · ${personFirstName}`, {
        x: chartX + 118,
        y: chartY + chartHeight - 14,
        size: 8,
        font: fontSerif,
        color: theme.chartSubtitle,
      });

      metrics.forEach((metric, index) => {
        const rowY = chartY + chartHeight - 30 - index * 18;
        const barWidth = Math.max(2, (metric.value / maxMetricValue) * barMaxWidth);

        targetPage.drawText(metric.label, {
          x: chartX + 10,
          y: rowY,
          size: 8,
          font: fontSerif,
          color: theme.inkMuted,
        });

        targetPage.drawRectangle({
          x: barX,
          y: rowY - 1,
          width: barMaxWidth,
          height: 8,
          color: theme.chartTrack,
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
          font: fontSerifBold,
          color: theme.ink,
        });
      });

      return chartY - 10;
    };

    const drawTableHeader = () => {
      page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: theme.tableHeaderBg });
      page.drawRectangle({ x: margin, y: y - rowHeight, width: 4, height: rowHeight, color: theme.tableHeaderAccent });
      const th = theme.tableHeaderText;
      page.drawText("Type", { x: margin + 8, y: y - 15, size: 8.5, font: bold, color: th });
      page.drawText("Amount", { x: margin + 92, y: y - 15, size: 8.5, font: bold, color: th });
      page.drawText("Total", { x: margin + 220, y: y - 15, size: 8.5, font: bold, color: th });
      page.drawText("Status", { x: margin + 310, y: y - 15, size: 8.5, font: bold, color: th });
      page.drawText("Date", { x: margin + 380, y: y - 15, size: 8.5, font: bold, color: th });
      page.drawText("Notes", { x: margin + 460, y: y - 15, size: 8.5, font: bold, color: th });
      y -= rowHeight;
    };

    const ensureSpace = (spaceNeeded = rowHeight) => {
      if (y - spaceNeeded < margin + 26) {
        page = pdfDoc.addPage([width, height]);
        y = height - margin;
        drawPageCanvas(page);
        drawTableHeader();
      }
    };

    drawHeader();

    page.drawRectangle({
      x: margin,
      y: y - 52,
      width: contentWidth,
      height: 52,
      color: rgb(0.995, 0.99, 0.965),
      borderWidth: 0.75,
      borderColor: theme.frameGold,
    });
    page.drawText("FROM", {
      x: margin + 10,
      y: y - 16,
      size: 7,
      font: fontSerifBold,
      color: theme.inkSoft,
    });
    page.drawText(`${user.name}`, {
      x: margin + 10,
      y: y - 30,
      size: 10,
      font: fontSerifBold,
      color: theme.ink,
    });
    page.drawText(user.email, {
      x: margin + 10,
      y: y - 42,
      size: 8,
      font: font,
      color: theme.accentEmeraldSoft,
    });
    page.drawText("TO", {
      x: margin + 300,
      y: y - 16,
      size: 7,
      font: fontSerifBold,
      color: theme.inkSoft,
    });
    page.drawText(person.name, {
      x: margin + 300,
      y: y - 30,
      size: 10,
      font: fontSerifBold,
      color: theme.accentAmberDeep,
    });
    y -= 62;

    page.drawText(`Contact · ${person.email || "—"} · ${person.phone || "—"}`, {
      x: margin,
      y,
      size: 8.5,
      font: fontSerif,
      color: theme.inkMuted,
    });
    y -= 14;

    page.drawText(`Denomination · ${targetCurrency}`, {
      x: margin,
      y,
      size: 8.5,
      font: fontSerifBold,
      color: theme.ink,
    });
    y -= 14;

    page.drawText(
      scope === "all"
        ? "Scope · All entries (credits & debits, every status)"
        : `Scope · ${scope.toUpperCase()} entries only`,
      {
        x: margin,
        y,
        size: 8.5,
        font: fontSerif,
        color: theme.inkMuted,
      }
    );
    y -= 18;

    drawCard(margin, "ENTRY COUNT", String(transactions.length), "neutral");
    drawCard(margin + 177, "PENDING ENTRIES", String(pendingCount), "neutral");
    y -= 70;

    drawRemainingBanner();

    drawTableHeader();

    if (!transactions.length) {
      ensureSpace();
      page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: theme.rowAlt });
      page.drawText("No line items in this view.", {
        x: margin + 8,
        y: y - 15,
        size: 9,
        font: fontSerif,
        color: theme.inkMuted,
      });
      y -= rowHeight;
    } else {
      convertedTransactions.forEach((tx, idx) => {
        ensureSpace();
        if (idx % 2 === 0) {
          page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: theme.rowAlt });
        }

        const isCredit = tx.type === "credit";
        const typeColor = isCredit ? theme.accentEmerald : theme.accentAmberDeep;
        const amountLabel =
          tx.currency === targetCurrency
            ? `${money(tx.originalAmount)} ${tx.currency}`
            : `${money(tx.originalAmount)} ${tx.currency} × ${money(tx.conversionRate)}`;
        const totalLabel = `${money(tx.convertedAmount)} ${targetCurrency}`;

        page.drawText(tx.type.toUpperCase(), { x: margin + 8, y: y - 15, size: 8.5, font: bold, color: typeColor });
        page.drawText(amountLabel, { x: margin + 92, y: y - 15, size: 8.5, font: bold, color: typeColor });
        page.drawText(totalLabel, { x: margin + 220, y: y - 15, size: 8.5, font: bold, color: typeColor });
        page.drawText(tx.status.toUpperCase(), { x: margin + 310, y: y - 15, size: 8.5, font, color: theme.inkMuted });
        page.drawText(new Date(tx.date).toLocaleDateString(), { x: margin + 380, y: y - 15, size: 8.5, font, color: theme.inkMuted });
        page.drawText(short(tx.notes || "-", 28), { x: margin + 460, y: y - 15, size: 8.5, font, color: theme.inkMuted });
        y -= rowHeight;
      });
    }

    const signedText = `${signedScopeTotal >= 0 ? "+" : "-"}${money(Math.abs(signedScopeTotal))} ${targetCurrency}`;
    const isNegative = signedScopeTotal < 0;
    const summaryColor = isNegative ? theme.metricRed.value : theme.accentEmerald;
    const summaryMessage = isNegative
      ? `${person.name}, please send ${userFirstName} this amount ASAP`
      : `${userFirstName} will pay ${person.name} ASAP`;

    const conversionAreaHeight = conversionNotes.length ? 18 + conversionNotes.length * 14 + 14 : 0;
    const chartAreaHeight = 98;
    ensureSpace(54 + conversionAreaHeight + chartAreaHeight);

    page.drawRectangle({
      x: margin,
      y: y - 44,
      width: contentWidth,
      height: 44,
      color: theme.summaryBg,
      borderWidth: 1,
      borderColor: theme.frameGold,
    });
    page.drawRectangle({ x: margin, y: y - 44, width: 3, height: 44, color: summaryColor });
    page.drawText(`NET (${scope.toUpperCase()}) · ${signedText}`, {
      x: margin + 12,
      y: y - 18,
      size: 11,
      font: fontSerifBold,
      color: summaryColor,
    });
    page.drawText(summaryMessage, {
      x: margin + 12,
      y: y - 34,
      size: 9,
      font: fontSerif,
      color: theme.inkMuted,
    });
    y -= 52;

    if (conversionNotes.length) {
      const noteX = margin + contentWidth - 180;
      page.drawText("FX reference", {
        x: noteX,
        y: y - 15,
        size: 8,
        font: fontSerifBold,
        color: theme.ink,
      });
      y -= 18;
      conversionNotes.forEach((note) => {
        page.drawText(note, {
          x: noteX,
          y: y - 12,
          size: 8,
          font: fontSerif,
          color: theme.inkMuted,
        });
        y -= 14;
      });
      page.drawText(`As of ${conversionTimestamp}`, {
        x: noteX,
        y: y - 10,
        size: 7.5,
        font: font,
        color: theme.inkSoft,
      });
      y -= 18;
    }

    y = drawBottomInsightChart(page, y);

    page.drawText("OWE DUE · myowedue.com", {
      x: margin,
      y: 18,
      size: 8,
      font: fontSerif,
      color: theme.footer,
    });

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    pages.forEach((pdfPage, index) => {
      pdfPage.drawText(`Page ${index + 1} of ${totalPages}`, {
        x: pdfPage.getWidth() - margin - 70,
        y: 18,
        size: 8,
        font,
        color: theme.footer,
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
