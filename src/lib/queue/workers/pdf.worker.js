import { setRedisJSON } from "@/lib/redis";

export const PDF_QUEUE_NAME = "pdf-generation";
export const PDF_CONCURRENCY = 2;

export async function pdfProcessor(job) {
  const { type } = job.data;

  let base64;
  switch (type) {
    case "export-transactions":
      base64 = await handleExportTransactions(job.data);
      break;
    case "export-dues-report":
      base64 = await handleExportDuesReport(job.data);
      break;
    case "export-invoice":
      base64 = await handleExportInvoice(job.data);
      break;
    case "admin-report":
      base64 = await handleAdminReport(job.data);
      break;
    default:
      throw new Error(`Unknown PDF job type: ${type}`);
  }

  await setRedisJSON(`pdf-result:${job.id}`, { base64, contentType: "application/pdf" }, 600);
  return { ready: true };
}

async function handleExportTransactions(data) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { transactions, userName, userEmail, startDate, endDate, fontPreset, fontSizePreset } = data;
  const { getFontPreset, getFontSizePreset } = await import("@/lib/appearance");
  const { formatDateOnly, formatDateTimeLabel } = await import("@/lib/datetime");

  const pdfDoc = await PDFDocument.create();
  const preset = getFontPreset(fontPreset);
  let font, bold;
  if (preset.pdfFamily === "times") {
    font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  } else if (preset.pdfFamily === "courier") {
    font = await pdfDoc.embedFont(StandardFonts.Courier);
    bold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }
  const scale = getFontSizePreset(fontSizePreset).scale;
  const money = (v) => Number(v || 0).toFixed(2);

  const width = 595, height = 842, margin = 40;
  const contentWidth = width - margin * 2;
  const rowHeight = 20;
  let currentPageNum = 0, yPos = height - margin;

  const palette = {
    ink: rgb(0.07, 0.07, 0.08), muted: rgb(0.45, 0.45, 0.45),
    line: rgb(0.84, 0.84, 0.84), accent: rgb(0.96, 0.68, 0.12),
    accentSoft: rgb(1, 0.97, 0.86), surface: rgb(0.97, 0.97, 0.97),
    success: rgb(0.08, 0.48, 0.24), danger: rgb(0.66, 0.12, 0.12),
  };

  function addNewPage() {
    currentPageNum++;
    yPos = height - margin - 72;
    return pdfDoc.addPage([width, height]);
  }

  function drawHeader(page) {
    page.drawRectangle({ x: margin, y: height - margin - 62, width: contentWidth, height: 62, color: palette.ink });
    page.drawRectangle({ x: margin, y: height - margin - 62, width: contentWidth, height: 4, color: palette.accent });
    page.drawText("TRANSACTIONS REPORT", { x: margin + 10, y: height - margin - 24, font: bold, size: 16 * scale, color: rgb(1, 1, 1) });
    const dateText = startDate && endDate ? `${startDate} to ${endDate}` : "All Time";
    page.drawText(dateText, { x: margin + 10, y: height - margin - 42, font, size: 9 * scale, color: rgb(0.7, 0.7, 0.7) });
    page.drawText(`Page ${currentPageNum}`, { x: width - margin - 42, y: height - margin - 53, font, size: 8 * scale, color: rgb(0.72, 0.72, 0.72) });
  }

  function drawFooter(page) {
    page.drawLine({ start: { x: margin, y: 30 }, end: { x: width - margin, y: 30 }, thickness: 0.5, color: palette.line });
    page.drawText(`Generated on ${formatDateTimeLabel(new Date())}`, { x: margin, y: 10, font, size: 8 * scale, color: palette.muted });
    page.drawText("MYOWEDUE PREMIUM EXPORT", { x: width - margin - 150, y: 10, font: bold, size: 8 * scale, color: rgb(0.33, 0.33, 0.33) });
  }

  let page = addNewPage();
  drawHeader(page);

  let creditTotal = 0, debitTotal = 0;
  transactions.forEach((t) => {
    if (t.type === "credit") creditTotal += Number(t.amount || 0);
    if (t.type === "debit") debitTotal += Number(t.amount || 0);
  });
  const netAmount = debitTotal - creditTotal;

  page.drawText(`Prepared for ${userName || "User"} (${userEmail || ""})`, { x: margin, y: yPos - 8, font, size: 9 * scale, color: rgb(0.32, 0.32, 0.32) });
  yPos -= 30;
  yPos -= 64;

  const col1 = margin + 10, col2 = col1 + 150, col3 = col2 + 80, col4 = col3 + 80, col5 = col4 + 80;
  page.drawRectangle({ x: margin, y: yPos - rowHeight, width: contentWidth, height: rowHeight, color: palette.ink });
  page.drawText("Person", { x: col1, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
  page.drawText("Type", { x: col2, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
  page.drawText("Amount", { x: col3, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
  page.drawText("Currency", { x: col4, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
  page.drawText("Date", { x: col5, y: yPos - 15, font: bold, size: 10 * scale, color: rgb(1, 1, 1) });
  yPos -= rowHeight + 5;

  for (let idx = 0; idx < transactions.length; idx++) {
    const tx = transactions[idx];
    if (yPos < margin + 50) {
      drawFooter(page);
      page = addNewPage();
      drawHeader(page);
      yPos -= 28;
    }
    const bgColor = idx % 2 === 0 ? rgb(0.98, 0.98, 0.98) : rgb(1, 1, 1);
    page.drawRectangle({ x: margin, y: yPos - rowHeight, width: contentWidth, height: rowHeight, color: bgColor });
    const textColor = tx.type === "credit" ? palette.danger : palette.success;
    page.drawText((tx.personName || "Unknown").substring(0, 20), { x: col1, y: yPos - 15, font, size: 9 * scale });
    page.drawText(tx.type.toUpperCase(), { x: col2, y: yPos - 15, font: bold, size: 9 * scale, color: textColor });
    page.drawText(money(tx.amount), { x: col3, y: yPos - 15, font, size: 9 * scale });
    page.drawText(tx.currency || "USD", { x: col4, y: yPos - 15, font, size: 9 * scale });
    page.drawText(formatDateOnly(tx.date), { x: col5, y: yPos - 15, font, size: 9 * scale });
    yPos -= rowHeight;
  }
  drawFooter(page);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
}

async function handleExportDuesReport(data) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { transactions, userName, userEmail, fontPreset, fontSizePreset } = data;
  const { getFontPreset, getFontSizePreset } = await import("@/lib/appearance");

  const pdfDoc = await PDFDocument.create();
  const preset = getFontPreset(fontPreset);
  let font, bold;
  if (preset.pdfFamily === "times") {
    font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  } else if (preset.pdfFamily === "courier") {
    font = await pdfDoc.embedFont(StandardFonts.Courier);
    bold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }
  const scale = getFontSizePreset(fontSizePreset).scale;
  const money = (v) => Number(v || 0).toFixed(2);
  const short = (text, max = 42) => { const s = String(text || ""); return s.length > max ? `${s.slice(0, max - 1)}...` : s; };

  const width = 595, height = 842, margin = 40;
  const contentWidth = width - margin * 2;
  const rowHeight = 22;

  const palette = {
    ink: rgb(0.07, 0.07, 0.08), accent: rgb(0.96, 0.68, 0.12),
    rowAlt: rgb(0.98, 0.98, 0.98), muted: rgb(0.45, 0.45, 0.45),
    success: rgb(0.06, 0.47, 0.22), danger: rgb(0.6, 0.1, 0.1),
  };

  let page = pdfDoc.addPage([width, height]);
  let y = height - margin;

  page.drawRectangle({ x: margin, y: y - 76, width: contentWidth, height: 76, color: palette.ink });
  page.drawRectangle({ x: margin, y: y - 76, width: contentWidth, height: 4, color: palette.accent });
  page.drawText("MYOWEDUE", { x: margin + 14, y: y - 22, size: 16 * scale, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Premium Financial Report", { x: margin + 14, y: y - 40, size: 11 * scale, font, color: rgb(0.95, 0.95, 0.95) });
  y -= 96;

  page.drawText(`Prepared for ${userName} (${userEmail})`, { x: margin, y, size: 9 * scale, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 18;

  const drawTableHeader = () => {
    page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: palette.ink });
    page.drawText("Person", { x: margin + 8, y: y - 15, size: 9 * scale, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Type", { x: margin + 210, y: y - 15, size: 9 * scale, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Amount", { x: margin + 265, y: y - 15, size: 9 * scale, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Status", { x: margin + 355, y: y - 15, size: 9 * scale, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Date", { x: margin + 430, y: y - 15, size: 9 * scale, font: bold, color: rgb(1, 1, 1) });
    y -= rowHeight;
  };

  drawTableHeader();

  transactions.forEach((item, idx) => {
    if (y - rowHeight < margin + 28) {
      page = pdfDoc.addPage([width, height]);
      y = height - margin;
      drawTableHeader();
    }
    if (idx % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: palette.rowAlt });
    }
    const typeColor = item.type === "credit" ? palette.danger : palette.success;
    const signedAmount = `${item.type === "credit" ? "-" : "+"}${money(item.amount)} ${item.currency}`;
    page.drawText(short(item.personName || "Unknown", 26), { x: margin + 8, y: y - 15, size: 8.5 * scale, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(item.type.toUpperCase(), { x: margin + 210, y: y - 15, size: 8.5 * scale, font: bold, color: typeColor });
    page.drawText(signedAmount, { x: margin + 265, y: y - 15, size: 8.5 * scale, font: bold, color: typeColor });
    page.drawText((item.status || "").toUpperCase(), { x: margin + 355, y: y - 15, size: 8.5 * scale, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(new Date(item.date).toLocaleDateString(), { x: margin + 430, y: y - 15, size: 8.5 * scale, font, color: rgb(0.15, 0.15, 0.15) });
    y -= rowHeight;
  });

  page.drawText("Generated by MYOWEDUE PREMIUM EXPORT", { x: margin, y: 18, size: 8 * scale, font, color: palette.muted });
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
}

async function handleExportInvoice(data) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { transactions, userName, userEmail, personName, personEmail, targetCurrency, scope } = data;
  const money = (v) => Number(v || 0).toFixed(2);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const width = 595, height = 842, margin = 52;
  const contentWidth = width - margin * 2;
  const rowHeight = 19;
  const black = rgb(0.06, 0.06, 0.06);
  const gray = rgb(0.42, 0.42, 0.42);
  const zebra = rgb(0.985, 0.985, 0.985);
  const amber = rgb(0.92, 0.58, 0.08);
  const emerald = rgb(0.06, 0.52, 0.4);
  const lineCol = rgb(0.88, 0.88, 0.88);

  let page = pdfDoc.addPage([width, height]);
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
  let y = height - margin;

  page.drawText("OWE DUE", { x: margin + 18, y: y - 14, size: 20, font: bold, color: black });
  page.drawText("Invoice", { x: width - margin - bold.widthOfTextAtSize("Invoice", 30), y: y - 4, size: 30, font: bold, color: black });
  y -= 92;

  page.drawText("From", { x: margin, y, size: 9, font: bold, color: black });
  y -= 14;
  page.drawText(String(userName || ""), { x: margin, y, size: 9, font, color: black });
  y -= 12;
  page.drawText(String(userEmail || ""), { x: margin, y, size: 8.5, font, color: gray });
  y -= 30;

  page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: margin + contentWidth, y: y + 8 }, thickness: 0.75, color: lineCol });
  y -= 18;

  const col = { desc: margin + 6, amt: margin + 248, st: margin + 408, dt: margin + 468 };
  page.drawText("Description", { x: col.desc, y, size: 8.5, font: bold, color: black });
  page.drawText("Amount", { x: col.amt, y, size: 8.5, font: bold, color: black });
  page.drawText("Status", { x: col.st, y, size: 8.5, font: bold, color: black });
  page.drawText("Date", { x: col.dt, y, size: 8.5, font: bold, color: black });
  y -= rowHeight;
  page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: margin + contentWidth, y: y + 4 }, thickness: 0.75, color: lineCol });
  y -= 6;

  transactions.forEach((tx, idx) => {
    if (y - rowHeight < margin + 100) {
      page = pdfDoc.addPage([width, height]);
      page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
      y = height - margin;
    }
    if (idx % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - rowHeight + 2, width: contentWidth, height: rowHeight, color: zebra });
    }
    const tone = tx.type === "credit" ? emerald : amber;
    const desc = `${tx.type.toUpperCase()} · ${String(tx.notes || "—").substring(0, 48)}`;
    page.drawText(desc.substring(0, 52), { x: col.desc, y, size: 7.5, font: bold, color: tone });
    page.drawText(`${money(tx.amount)} ${tx.currency || targetCurrency}`, { x: col.amt, y, size: 7.5, font, color: black });
    page.drawText((tx.status || "").toUpperCase(), { x: col.st, y, size: 7.5, font, color: gray });
    page.drawText(new Date(tx.date).toLocaleDateString(), { x: col.dt, y, size: 7.5, font, color: gray });
    y -= rowHeight;
  });

  page.drawText("Generated by OWE DUE", { x: margin, y: 18, size: 8, font, color: gray });
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
}

async function handleAdminReport(data) {
  const { connectDB } = await import("@/lib/db");
  const { buildSuperadminStatsBundle } = await import("@/lib/buildSuperadminStatsBundle");
  const { buildSuperadminAnalyticsPdfBuffer } = await import("@/lib/superadminReportPdf");

  await connectDB();
  const bundle = await buildSuperadminStatsBundle();
  const buffer = await buildSuperadminAnalyticsPdfBuffer(bundle, {
    name: data.adminName,
    email: data.adminEmail,
  });
  return Buffer.from(buffer).toString("base64");
}
