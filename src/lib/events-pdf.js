import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import moment from "moment-timezone";

const DEFAULT_TZ = "Australia/Melbourne";
const DEFAULT_APP_URL = "https://myowedue.vercel.app";

/** Zinc-inspired palette (print-safe) */
const Z = {
  ink: rgb(0.11, 0.11, 0.12),
  muted: rgb(0.45, 0.45, 0.48),
  faint: rgb(0.55, 0.55, 0.58),
  rule: rgb(0.87, 0.87, 0.9),
  card: rgb(0.98, 0.98, 0.99),
  band: rgb(0.16, 0.16, 0.18),
  white: rgb(1, 1, 1),
  promoBg: rgb(0.96, 0.96, 0.97),
  accentLine: rgb(0.24, 0.24, 0.27),
};

const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 48;
/** Space reserved at bottom of every page for footer + page numbers (no overlap with body). */
const FOOTER_RESERVE = 50;
const GAP_AFTER_CARD = 10;

const MAX_TITLE_LINES = 4;
const MAX_DESC_LINES = 28;

/** Standard PDF fonts use WinAnsi; strip / map unsupported characters to avoid runtime errors. */
function sanitizePdfText(input) {
  const s = String(input ?? "");
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === "\t" || ch === "\n" || ch === "\r") {
      out += ch;
      continue;
    }
    if (c >= 0x20 && c <= 0x7e) {
      out += ch;
      continue;
    }
    if (c === 0x2026) {
      out += "...";
      continue;
    }
    if (c === 0x2013 || c === 0x2014) {
      out += "-";
      continue;
    }
    if (c === 0x2018 || c === 0x2019 || c === 0x0060) {
      out += "'";
      continue;
    }
    if (c === 0x201c || c === 0x201d) {
      out += '"';
      continue;
    }
    if (c === 0x00a0) {
      out += " ";
      continue;
    }
    if (c >= 0xa0 && c <= 0xff) {
      out += ch;
      continue;
    }
  }
  return out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function formatWhen(startTime, endTime, allDay, timezone) {
  const tz = timezone || DEFAULT_TZ;
  const s = moment(startTime).tz(tz);
  if (allDay) {
    const a = s.format("ddd, MMM D, YYYY");
    if (!endTime) return sanitizePdfText(a);
    const e = moment(endTime).tz(tz);
    return sanitizePdfText(`${a} - ${e.format("ddd, MMM D, YYYY")}`);
  }
  let line = `${s.format("ddd, MMM D, YYYY h:mm A")} (${s.format("z")})`;
  if (endTime) {
    const e = moment(endTime).tz(tz);
    line += ` - ${e.format("h:mm A")}`;
  }
  return sanitizePdfText(line);
}

/**
 * @param {string} text
 * @param {import("pdf-lib").PDFFont} font
 * @param {number} size
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapLines(text, font, size, maxWidth) {
  const raw = sanitizePdfText(text).replace(/\n+/g, "\n").trim();
  if (!raw) return [];
  const paragraphs = raw.split("\n");
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      if (font.widthOfTextAtSize(w, size) <= maxWidth) {
        line = w;
        continue;
      }
      let rest = w;
      while (rest.length) {
        let low = 1;
        let high = rest.length;
        let fit = 1;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const slice = rest.slice(0, mid);
          if (font.widthOfTextAtSize(slice, size) <= maxWidth) {
            fit = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
        lines.push(rest.slice(0, fit));
        rest = rest.slice(fit);
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawWrappedSubtitle(page, text, x, yTop, maxWidth, font, size, color, maxLines) {
  const lines = wrapLines(text, font, size, maxWidth).slice(0, maxLines);
  let y = yTop;
  for (const ln of lines) {
    page.drawText(ln, { x, y, size, font, color });
    y -= size + 3;
  }
  return y;
}

const PROMO_BULLETS = [
  "Track credits and debits, balances, and payment history in one workspace.",
  "Calendar events with email reminders (3 days, 3 hours, and 1 hour before).",
  "Secure files, virtual cards, Community, and subscription features.",
];

/**
 * @param {{ events: object[]; title?: string; subtitle?: string; appUrl?: string }} opts
 * @returns {Promise<Uint8Array>}
 */
function displaySiteHost(urlStr) {
  const raw = String(urlStr || "").trim() || DEFAULT_APP_URL;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "myowedue.com";
  }
}

export async function buildEventsPdf({ events, title = "Events", subtitle = "", appUrl }) {
  const site = sanitizePdfText(appUrl || DEFAULT_APP_URL).replace(/\s+/g, "") || DEFAULT_APP_URL;
  const siteHost = displaySiteHost(site);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const contentW = PAGE.w - MARGIN * 2;
  const innerW = contentW - 20;
  const yBodyMin = MARGIN + FOOTER_RESERVE;

  let page = pdfDoc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - MARGIN;
  };

  const drawContinuationHeader = () => {
    page.drawText(sanitizePdfText(title), {
      x: MARGIN,
      y,
      size: 13,
      font: bold,
      color: Z.ink,
    });
    y -= 18;
    if (subtitle) {
      const after = drawWrappedSubtitle(page, subtitle, MARGIN, y, contentW, font, 9, Z.muted, 2);
      y = after - 6;
    }
    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: PAGE.w - MARGIN, y: y + 6 },
      thickness: 0.5,
      color: Z.rule,
    });
    y -= 12;
  };

  const drawFirstPageHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 56,
      width: contentW,
      height: 56,
      color: Z.band,
    });
    page.drawRectangle({
      x: MARGIN,
      y: y - 56,
      width: contentW,
      height: 3,
      color: Z.accentLine,
    });
    page.drawText("OWE DUE", {
      x: MARGIN + 14,
      y: y - 22,
      size: 8,
      font: bold,
      color: rgb(0.75, 0.75, 0.78),
    });
    page.drawText(sanitizePdfText(title), {
      x: MARGIN + 14,
      y: y - 42,
      size: 17,
      font: bold,
      color: Z.white,
    });
    y -= 68;
    if (subtitle) {
      const after = drawWrappedSubtitle(page, subtitle, MARGIN, y, contentW, font, 10, Z.muted, 2);
      y = after - 8;
    }
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: PAGE.w - MARGIN, y: y + 4 },
      thickness: 0.75,
      color: Z.rule,
    });
    y -= 14;
  };

  const measureEventBlock = (ev) => {
    const when = formatWhen(ev.startTime, ev.endTime, Boolean(ev.allDay), ev.timezone || DEFAULT_TZ);
    const rawTitle = String(ev.title || "Untitled").slice(0, 240);
    const allTitle = wrapLines(rawTitle, bold, 11, innerW);
    let titleLines = allTitle;
    if (allTitle.length > MAX_TITLE_LINES) {
      titleLines = allTitle.slice(0, MAX_TITLE_LINES);
      const last = titleLines[MAX_TITLE_LINES - 1] || "";
      const trimmed = last.replace(/\s+\.*$/, "").slice(0, 72);
      titleLines[MAX_TITLE_LINES - 1] = `${trimmed}...`;
    }
    if (titleLines.length === 0) titleLines = ["Untitled"];

    const locRaw = (ev.location || "").trim();
    const locLines = locRaw ? wrapLines(`Location: ${sanitizePdfText(locRaw)}`, font, 9, innerW) : [];

    let descLines = wrapLines((ev.description || "").trim(), font, 9, innerW);
    if (descLines.length > MAX_DESC_LINES) {
      descLines = descLines.slice(0, MAX_DESC_LINES);
      descLines.push("...");
    }

    const pad = 12;
    let h = pad + 4;
    h += titleLines.length * 14;
    h += 12;
    h += locLines.length * 11;
    if (descLines.length) h += 6 + descLines.length * 11;
    h += pad;

    return { titleLines, when, locLines, descLines, h };
  };

  const measurePromoBlock = () => {
    const pad = 14;
    let h = pad + 14 + 8 + 10;
    for (const b of PROMO_BULLETS) {
      const lines = wrapLines(b, font, 8.5, innerW - 22);
      h += lines.length * 10 + 2;
    }
    h += 8;
    const visitUrlForMeasure =
      site.startsWith("http://") || site.startsWith("https://") ? site : `https://${site}`;
    const visitLines = wrapLines(`Visit: ${visitUrlForMeasure}`, bold, 9, innerW - 14);
    h += visitLines.length * 11;
    h += 4;
    const ctaLines = wrapLines(
      "Create a free account to sync events, reminders, and balances across devices.",
      font,
      8,
      innerW - 14
    );
    h += ctaLines.length * 9 + pad;
    return h;
  };

  const ensureVerticalSpace = (needed) => {
    if (y - needed < yBodyMin) {
      newPage();
      drawContinuationHeader();
    }
  };

  const drawEventCard = (m) => {
    ensureVerticalSpace(m.h + GAP_AFTER_CARD);
    const cardTop = y;
    const cardBottom = cardTop - m.h;
    page.drawRectangle({
      x: MARGIN,
      y: cardBottom,
      width: contentW,
      height: m.h,
      color: Z.card,
      borderColor: Z.rule,
      borderWidth: 0.75,
    });

    const pad = 12;
    let ty = cardTop - pad - 1;
    for (const tl of m.titleLines) {
      page.drawText(tl, {
        x: MARGIN + pad,
        y: ty,
        size: 11,
        font: bold,
        color: Z.ink,
      });
      ty -= 14;
    }
    page.drawText(m.when, {
      x: MARGIN + pad,
      y: ty,
      size: 9,
      font,
      color: Z.muted,
    });
    ty -= 12;
    for (const ll of m.locLines) {
      page.drawText(ll, {
        x: MARGIN + pad,
        y: ty,
        size: 9,
        font,
        color: Z.muted,
      });
      ty -= 11;
    }
    if (m.descLines.length) {
      ty -= 4;
      for (const ln of m.descLines) {
        page.drawText(ln, {
          x: MARGIN + pad,
          y: ty,
          size: 9,
          font,
          color: Z.muted,
        });
        ty -= 11;
      }
    }
    y = cardBottom - GAP_AFTER_CARD;
  };

  const drawPromoBlock = () => {
    const need = measurePromoBlock() + GAP_AFTER_CARD;
    ensureVerticalSpace(need);

    const h = measurePromoBlock();
    const top = y;
    const bottom = top - h;

    page.drawRectangle({
      x: MARGIN,
      y: bottom,
      width: contentW,
      height: h,
      color: Z.promoBg,
      borderColor: Z.accentLine,
      borderWidth: 1,
    });

    let ty = top - 14;
    page.drawText("Get the full app", {
      x: MARGIN + 14,
      y: ty,
      size: 11,
      font: bold,
      color: Z.ink,
    });
    ty -= 16;
    page.drawText("OWE DUE - Personal credit & debit tracker", {
      x: MARGIN + 14,
      y: ty,
      size: 9,
      font,
      color: Z.muted,
    });
    ty -= 14;

    for (const bullet of PROMO_BULLETS) {
      const lines = wrapLines(bullet, font, 8.5, innerW - 22);
      lines.forEach((ln, i) => {
        const prefix = i === 0 ? "- " : "  ";
        page.drawText(`${prefix}${ln}`, {
          x: MARGIN + 14,
          y: ty,
          size: 8.5,
          font,
          color: Z.ink,
        });
        ty -= 10;
      });
      ty -= 2;
    }

    ty -= 6;
    const visitUrl = site.startsWith("http://") || site.startsWith("https://") ? site : `https://${site}`;
    for (const vl of wrapLines(`Visit: ${visitUrl}`, bold, 9, innerW - 14)) {
      page.drawText(vl, {
        x: MARGIN + 14,
        y: ty,
        size: 9,
        font: bold,
        color: Z.accentLine,
      });
      ty -= 11;
    }
    ty -= 2;
    for (const cl of wrapLines(
      "Create a free account to sync events, reminders, and balances across devices.",
      font,
      8,
      innerW - 14
    )) {
      page.drawText(cl, {
        x: MARGIN + 14,
        y: ty,
        size: 8,
        font,
        color: Z.muted,
      });
      ty -= 9;
    }

    y = bottom - GAP_AFTER_CARD;
  };

  drawFirstPageHeader();

  if (!events.length) {
    ensureVerticalSpace(36);
    page.drawText("No events in this export.", {
      x: MARGIN,
      y,
      size: 11,
      font,
      color: Z.muted,
    });
    y -= 28;
  } else {
    for (const ev of events) {
      drawEventCard(measureEventBlock(ev));
    }
  }

  drawPromoBlock();

  const pages = pdfDoc.getPages();
  const total = pages.length;
  const stamp = moment().format("MMM D, YYYY h:mm A");
  const genLeft = `OWE DUE Events export - Generated ${stamp}`;

  pages.forEach((pg, idx) => {
    const { width } = pg.getSize();
    const baseY = MARGIN + 6;
    pg.drawLine({
      start: { x: MARGIN, y: baseY + 26 },
      end: { x: width - MARGIN, y: baseY + 26 },
      thickness: 0.4,
      color: Z.rule,
    });
    const left = sanitizePdfText(genLeft);
    pg.drawText(left.length > 85 ? `${left.slice(0, 82)}...` : left, {
      x: MARGIN,
      y: baseY + 12,
      size: 7,
      font,
      color: Z.faint,
    });
    const rightTxt = `Page ${idx + 1} of ${total}`;
    const rw = font.widthOfTextAtSize(rightTxt, 7);
    pg.drawText(rightTxt, {
      x: width - MARGIN - rw,
      y: baseY + 12,
      size: 7,
      font,
      color: Z.faint,
    });
    pg.drawText(siteHost, {
      x: MARGIN,
      y: baseY,
      size: 7,
      font: bold,
      color: Z.muted,
    });
  });

  return pdfDoc.save();
}

export function downloadPdfBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
