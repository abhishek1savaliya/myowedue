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
  if (["pending", "credit", "all"].includes(scope)) return scope;
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

    const transactions = await Transaction.find(query).sort({ date: -1 }).lean();

    const total = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

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
      page.drawRectangle({ x: margin, y: y - 74, width: contentWidth, height: 74, color: rgb(0.06, 0.06, 0.06) });
      page.drawText("PERSON-WISE INVOICE", {
        x: margin + 14,
        y: y - 28,
        size: 16,
        font: bold,
        color: rgb(1, 1, 1),
      });
      page.drawText(`Scope: ${scope.toUpperCase()}`, {
        x: margin + 14,
        y: y - 46,
        size: 9,
        font,
        color: rgb(0.9, 0.9, 0.9),
      });
      page.drawText(`Generated: ${new Date().toLocaleString()}`, {
        x: margin + 14,
        y: y - 60,
        size: 9,
        font,
        color: rgb(0.9, 0.9, 0.9),
      });
      y -= 92;
    };

    const drawCard = (x, title, value) => {
      page.drawRectangle({ x, y: y - 56, width: 166, height: 56, color: rgb(0.965, 0.965, 0.965), borderWidth: 0.7, borderColor: rgb(0.85, 0.85, 0.85) });
      page.drawText(title, {
        x: x + 10,
        y: y - 20,
        size: 8,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      page.drawText(value, {
        x: x + 10,
        y: y - 42,
        size: 13,
        font: bold,
        color: rgb(0.1, 0.1, 0.1),
      });
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

    const ensureSpace = () => {
      if (y - rowHeight < margin + 26) {
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

    drawCard(margin, "TOTAL DUE", money(total));
    drawCard(margin + 177, "ENTRY COUNT", String(transactions.length));
    drawCard(margin + 354, "STATUS FILTER", scope.toUpperCase());
    y -= 70;

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
      transactions.slice(0, 220).forEach((tx, idx) => {
        ensureSpace();
        if (idx % 2 === 0) {
          page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: rgb(0.98, 0.98, 0.98) });
        }

        page.drawText(tx.type.toUpperCase(), { x: margin + 8, y: y - 15, size: 8.5, font: bold, color: rgb(0.15, 0.15, 0.15) });
        page.drawText(`${money(tx.amount)} ${tx.currency}`, { x: margin + 92, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
        page.drawText(tx.status.toUpperCase(), { x: margin + 190, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
        page.drawText(new Date(tx.date).toLocaleDateString(), { x: margin + 270, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
        page.drawText(short(tx.notes || "-", 34), { x: margin + 350, y: y - 15, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
        y -= rowHeight;
      });
    }

    page.drawText("Generated by Personal Credit/Debit Manager", {
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
