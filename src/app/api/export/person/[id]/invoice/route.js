import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { fail } from "@/lib/api";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";
import { activeQuery } from "@/lib/bin";

export const runtime = "nodejs";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function short(text, max = 34) {
  const str = String(text || "");
  return str.length > max ? `${str.slice(0, max - 1)}...` : str;
}

function getScope(searchParams) {
  const scope = (searchParams.get("scope") || "pending").toLowerCase();
  if (["pending", "credit", "debit", "all"].includes(scope)) return scope;
  return "pending";
}

export async function GET(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const scope = getScope(searchParams);

    await connectDB();

    const person = await Person.findOne({ _id: id, userId: user._id, ...activeQuery() }).lean();
    if (!person) return fail("Person not found", 404);

    const query = { userId: user._id, personId: person._id, ...activeQuery() };
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

    const [transactions, allTransactions] = await Promise.all([
      Transaction.find(query).sort({ date: -1 }).lean(),
      Transaction.find({ userId: user._id, personId: person._id, ...activeQuery() }).lean(),
    ]);

    const scopeTotal = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const signedScopeTotal = transactions.reduce(
      (sum, tx) => sum + (tx.type === "credit" ? Number(tx.amount || 0) : -Number(tx.amount || 0)),
      0
    );
    const creditTotal = allTransactions
      .filter((tx) => tx.type === "credit")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const debitTotal = allTransactions
      .filter((tx) => tx.type === "debit")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const remainingAmount = Math.abs(creditTotal - debitTotal);
    const userNeedsToPay = debitTotal > creditTotal;
    const remainingLabel = userNeedsToPay ? "You need to pay" : `${person.name} needs to pay you`;
    const pendingCount = allTransactions.filter((tx) => tx.status === "pending").length;

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
      page.drawText("Premium Person Invoice", {
        x: margin + 14,
        y: y - 40,
        size: 11,
        font,
        color: rgb(0.95, 0.95, 0.95),
      });
      page.drawText(`Scope: ${scope.toUpperCase()}  |  Generated: ${new Date().toLocaleString()}`, {
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
      page.drawText("Type", { x: margin + 8, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Amount", { x: margin + 92, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Status", { x: margin + 190, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Date", { x: margin + 270, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Notes", { x: margin + 350, y: y - 15, size: 9, font: bold, color: rgb(1, 1, 1) });
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

    page.drawText(`Billed by: ${user.name} (${user.email})`, {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    page.drawText(`Invoice To: ${person.name}`, {
      x: margin + 300,
      y,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.35),
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

    drawCard(margin, "SCOPE TOTAL", money(scopeTotal), "green");
    drawCard(margin + 177, "ENTRY COUNT", String(transactions.length), "neutral");
    drawCard(margin + 354, "PENDING ENTRIES", String(pendingCount), "neutral");
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
      transactions.forEach((tx, idx) => {
        ensureSpace();
        if (idx % 2 === 0) {
          page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: rgb(0.98, 0.98, 0.98) });
        }

        const isCredit = tx.type === "credit";
        const typeColor = isCredit ? rgb(0.06, 0.47, 0.22) : rgb(0.6, 0.1, 0.1);
        const signedAmountText = `${isCredit ? "+" : "-"}${money(tx.amount)} ${tx.currency}`;

        page.drawText(tx.type.toUpperCase(), { x: margin + 8, y: y - 15, size: 8.5, font: bold, color: typeColor });
        page.drawText(signedAmountText, { x: margin + 92, y: y - 15, size: 8.5, font: bold, color: typeColor });
        page.drawText(tx.status.toUpperCase(), { x: margin + 190, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
        page.drawText(new Date(tx.date).toLocaleDateString(), { x: margin + 270, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
        page.drawText(short(tx.notes || "-", 34), { x: margin + 350, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
        y -= rowHeight;
      });
    }

    ensureSpace(54);
    const signedText = `${signedScopeTotal >= 0 ? "+" : "-"}${money(Math.abs(signedScopeTotal))}`;
    const isNegative = signedScopeTotal < 0;
    const summaryColor = isNegative ? rgb(0.65, 0.1, 0.1) : rgb(0.06, 0.47, 0.22);
    const summaryMessage = isNegative
      ? "I will pay you ASAP"
      : "Please send me this amount ASAP";

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

    page.drawText("Generated by MYOWEDUE", {
      x: margin,
      y: 18,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
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
