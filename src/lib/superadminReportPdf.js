/** Aligns with public landing: zinc surfaces, amber CTAs, emerald accents, soft aurora header */
const THEME = {
  pageBg: "#f4f4f5",
  heroGrad0: "#fffbeb",
  heroGrad1: "#fef3c7",
  heroGrad2: "#ecfdf5",
  brand: "#18181b",
  accentAmber: "#d97706",
  accentAmberDark: "#b45309",
  accentEmerald: "#059669",
  accentSky: "#0284c7",
  accentViolet: "#7c3aed",
  textPrimary: "#18181b",
  textSecondary: "#3f3f46",
  textMuted: "#71717a",
  cardBg: "#ffffff",
  cardBorder: "#e4e4e7",
  barUsers: "#0284c7",
  barTx: "#059669",
  ticketColors: {
    queued: "#c026d3",
    open: "#0284c7",
    in_progress: "#d97706",
    resolved: "#059669",
    closed: "#71717a",
  },
};

const M = 50;
const PAGE_MAX_Y = 770;

function trunc(s, n) {
  const t = String(s ?? "");
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function nextY(doc, y, step = 18, startY = M + 20) {
  const ny = y + step;
  if (ny > PAGE_MAX_Y) {
    doc.addPage();
    return startY;
  }
  return ny;
}

function paintPageBackground(doc) {
  const w = doc.page.width;
  const h = doc.page.height;
  doc.save();
  doc.rect(0, 0, w, h).fill(THEME.pageBg);
  doc.restore();
}

function drawHeroBanner(doc) {
  const w = doc.page.width;
  const h = 108;
  const grad = doc.linearGradient(0, 0, w, h);
  grad.stop(0, THEME.heroGrad0).stop(0.45, THEME.heroGrad1).stop(1, THEME.heroGrad2);
  doc.save();
  doc.rect(0, 0, w, h).fill(grad);
  doc.restore();
}

function sectionTitle(doc, y, title) {
  doc.save();
  doc.rect(M - 6, y - 1, 4, 16).fill(THEME.accentAmber);
  doc.fontSize(12.5).fillColor(THEME.textPrimary).font("Helvetica-Bold").text(title, M + 4, y);
  doc.strokeColor(THEME.cardBorder).lineWidth(0.75).moveTo(M, y + 20).lineTo(545, y + 20).stroke();
  doc.restore();
  return y + 30;
}

function drawTrendBars(doc, y, rows, valueKey, barColor) {
  const maxV = Math.max(...rows.map((r) => r[valueKey] || 0), 1);
  const barAreaLeft = M + 130;
  const barMaxW = 320;
  const rowH = 24;
  for (const r of rows) {
    if (y + rowH > PAGE_MAX_Y) {
      doc.addPage();
      y = M + 20;
    }
    const v = r[valueKey] || 0;
    const w = maxV > 0 ? Math.max((v / maxV) * barMaxW, v ? 6 : 0) : 0;
    doc.save();
    doc.roundedRect(barAreaLeft, y + 1, barMaxW, 16, 3).fill("#e4e4e7");
    if (w > 0) {
      const grad = doc.linearGradient(barAreaLeft, 0, barAreaLeft + w, 0);
      grad.stop(0, barColor).stop(1, lightenHex(barColor, 0.15));
      doc.roundedRect(barAreaLeft, y + 1, w, 16, 3).fill(grad);
    }
    doc.restore();
    doc.fontSize(9).fillColor(THEME.textSecondary).font("Helvetica").text(trunc(r.month, 14), M, y + 5);
    doc.font("Helvetica-Bold").fillColor(THEME.accentAmberDark).text(String(v), barAreaLeft - 38, y + 5, { width: 34, align: "right" });
    y += rowH;
  }
  return y + 10;
}

/** Lighten hex color for subtle bar gradient (simple RGB lerp toward white) */
function lightenHex(hex, t) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const l = (c) => Math.round(c + (255 - c) * t);
  const to = (x) => x.toString(16).padStart(2, "0");
  return `#${to(l(r))}${to(l(g))}${to(l(b))}`;
}

function kpiCardRow(doc, y, label, val) {
  doc.save();
  doc.roundedRect(M - 2, y - 3, 500, 26, 4).fillAndStroke(THEME.cardBg, THEME.cardBorder);
  doc.restore();
  doc.fontSize(9.5).fillColor(THEME.textSecondary).font("Helvetica").text(label, M + 10, y + 2, { width: 300 });
  doc.font("Helvetica-Bold").fillColor(THEME.accentAmber).text(String(val ?? "—"), M + 340, y + 2, { width: 140, align: "right" });
  doc.font("Helvetica");
  return y + 30;
}

/**
 * Lazy-load pdfkit (listed in serverExternalPackages).
 * Do not use createRequire(process.cwd()) — Next webpack cannot parse it and
 * leaves PDFDocument undefined during `next build` page-data collection.
 */
async function loadPdfKit() {
  const mod = await import("pdfkit");
  const PDFDocument = mod?.default ?? mod;
  if (typeof PDFDocument !== "function") {
    throw new Error("pdfkit failed to load");
  }
  return PDFDocument;
}

/** Build a multi-page PDF buffer from the superadmin analytics bundle. */
export async function buildSuperadminAnalyticsPdfBuffer(bundle, admin = {}) {
  const PDFDocument = await loadPdfKit();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: M,
      info: { Title: "OWE DUE — Executive analytics report", Author: "OWE DUE" },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.on("pageAdded", () => {
      paintPageBackground(doc);
    });

    paintPageBackground(doc);
    drawHeroBanner(doc);

    const generated = new Date();
    const {
      stats,
      recentUsers,
      monthlyTrend,
      monthlyTransactionsTrend,
      tickets,
      team,
      posts,
    } = bundle;

    let y = 28;

    doc.fontSize(22).fillColor(THEME.brand).font("Helvetica-Bold").text("OWE DUE", M, y);
    y += 26;
    doc.fontSize(11).fillColor(THEME.accentAmberDark).font("Helvetica-Bold").text("Executive analytics report", M, y);
    y += 18;
    doc.fontSize(8.5).fillColor(THEME.textMuted).font("Helvetica").text(`Generated: ${generated.toLocaleString()}`, M, y);
    y += 12;
    doc.text(`Prepared for: ${trunc(admin.name || "Superadmin", 55)} · ${trunc(admin.email || "", 45)}`, M, y);
    y = 118;

    y = sectionTitle(doc, y, "Platform overview");
    const kpi = [
      ["Total registered users", stats?.totalUsers],
      ["Total transactions (non-deleted)", stats?.totalTransactions],
      ["Active Pro subscribers", stats?.activeSubscribers],
      ["New users (calendar month)", stats?.newUsersThisMonth],
      ["New transactions (calendar month)", stats?.newTransactionsThisMonth],
    ];
    for (const [label, val] of kpi) {
      if (y + 32 > PAGE_MAX_Y) {
        doc.addPage();
        y = M + 20;
      }
      y = kpiCardRow(doc, y, label, val);
    }
    y += 8;

    y = sectionTitle(doc, y, "User acquisition — last 6 months");
    y = drawTrendBars(doc, y, monthlyTrend || [], "users", THEME.barUsers);

    y = sectionTitle(doc, y, "Transaction volume — last 6 months");
    y = drawTrendBars(doc, y, monthlyTransactionsTrend || [], "transactions", THEME.barTx);

    y = sectionTitle(doc, y, "Support tickets by status");
    const tb = tickets?.byStatus || {};
    const order = ["queued", "open", "in_progress", "resolved", "closed"];
    const labels = {
      queued: "Queued",
      open: "Open",
      in_progress: "In progress",
      resolved: "Resolved",
      closed: "Closed",
    };
    const tMax = Math.max(tickets?.total || 1, 1);
    for (const key of order) {
      const v = tb[key] ?? 0;
      y = nextY(doc, y, 28);
      const barMaxW = 280;
      const bw = (v / tMax) * barMaxW;
      const barColor = THEME.ticketColors[key] || THEME.textMuted;
      doc.fontSize(9).fillColor(THEME.textSecondary).font("Helvetica").text(labels[key], M, y + 5);
      doc.font("Helvetica-Bold").fillColor(barColor).text(String(v), M + 128, y + 5, { width: 40, align: "right" });
      doc.save();
      doc.roundedRect(M + 175, y + 2, barMaxW, 16, 3).fill("#e4e4e7");
      if (bw > 0) {
        const grad = doc.linearGradient(M + 175, 0, M + 175 + bw, 0);
        grad.stop(0, barColor).stop(1, lightenHex(barColor, 0.2));
        doc.roundedRect(M + 175, y + 2, bw, 16, 3).fill(grad);
      }
      doc.restore();
    }
    doc.font("Helvetica").fontSize(9).fillColor(THEME.accentEmerald);
    y = nextY(doc, y, 22);
    doc.font("Helvetica-Bold").text(`Total tickets: ${tickets?.total ?? 0}`, M, y);
    y += 18;

    y = sectionTitle(doc, y, "Admin team (active)");
    const roleRows = [
      ["Superadmin", team?.byRole?.superadmin ?? 0, THEME.accentAmber],
      ["Managers", team?.byRole?.manager ?? 0, THEME.barUsers],
      ["Support", team?.byRole?.support ?? 0, THEME.barTx],
    ];
    for (const [roleLabel, count, chipColor] of roleRows) {
      y = nextY(doc, y, 26);
      doc.roundedRect(M, y, 52, 16, 8).fill(chipColor);
      doc.fontSize(8).fillColor("#ffffff").font("Helvetica-Bold").text(String(count), M, y + 4, { width: 52, align: "center" });
      doc.fontSize(10).fillColor(THEME.textSecondary).font("Helvetica").text(roleLabel, M + 62, y + 3);
    }
    y = nextY(doc, y, 24);
    doc.fontSize(10).fillColor(THEME.textPrimary).font("Helvetica-Bold").text(`Total active seats: ${team?.activeTotal ?? 0}`, M, y);
    y += 20;

    if (posts?.configured) {
      y = sectionTitle(doc, y, "Community");
      y = nextY(doc, y);
      doc.fontSize(10).fillColor(THEME.textSecondary).font("Helvetica");
      doc.text(`Posts: ${posts.totalPosts ?? 0} · This month: ${posts.postsThisMonth ?? 0}`, M, y);
      y = nextY(doc, y);
      doc.text(`Likes: ${posts.totalLikes ?? 0} · Comments: ${posts.totalComments ?? 0} · Shares: ${posts.totalShares ?? 0}`, M, y);
      y += 10;
      doc.fontSize(9).fillColor(THEME.accentViolet).font("Helvetica-Bold").text("New posts — last 7 days", M, y);
      y += 16;
      const days = posts.postsLast7Days || [];
      const dmax = Math.max(...days.map((d) => d.posts || 0), 1);
      for (const d of days) {
        y = nextY(doc, y, 24);
        const v = d.posts || 0;
        const barW = (v / dmax) * 200;
        doc.font("Helvetica").fillColor(THEME.textSecondary).text(d.shortLabel || d.date, M, y + 4);
        doc.font("Helvetica-Bold").fillColor(THEME.accentViolet).text(String(v), M + 52, y + 4);
        doc.save();
        doc.roundedRect(M + 88, y + 2, 200, 14, 3).fill("#ede9fe");
        if (barW > 0) {
          const g = doc.linearGradient(M + 88, 0, M + 88 + barW, 0);
          g.stop(0, "#7c3aed").stop(1, "#a78bfa");
          doc.roundedRect(M + 88, y + 2, barW, 14, 3).fill(g);
        }
        doc.restore();
      }
      y += 10;
      doc.fontSize(9).font("Helvetica-Bold").fillColor(THEME.textPrimary).text("Top posts (by shares)", M, y);
      y += 14;
      doc.font("Helvetica").fontSize(8).fillColor(THEME.textSecondary);
      for (const p of posts.topPosts || []) {
        y = nextY(doc, y, 30);
        doc.save();
        doc.roundedRect(M - 2, y - 2, 504, 26, 3).fillAndStroke("#fafafa", THEME.cardBorder);
        doc.restore();
        doc.fillColor(THEME.textPrimary).text(trunc(p.bodyPreview, 88), M + 6, y + 2, { width: 236 });
        doc.fillColor(THEME.textMuted).text(`${p.authorName} · ♥${p.likes} 💬${p.comments} ↗${p.shares}`, M + 248, y + 2, { width: 252 });
      }
      y += 8;
    } else {
      y = sectionTitle(doc, y, "Community");
      y = nextY(doc, y);
      doc.fontSize(10).fillColor(THEME.textMuted).text("Supabase community is not configured — no post metrics in this report.", M, y);
      y += 16;
    }

    if (y > 560) {
      doc.addPage();
      y = M + 20;
    }
    y = sectionTitle(doc, y, "Latest support tickets (sample)");
    doc.fontSize(8).font("Helvetica");
    for (const t of tickets?.recent || []) {
      y = nextY(doc, y, 36);
      doc.save();
      doc.roundedRect(M - 2, y - 2, 504, 32, 3).fillAndStroke(THEME.cardBg, THEME.cardBorder);
      doc.restore();
      doc.fillColor(THEME.textPrimary).font("Helvetica-Bold").text(`${trunc(t.name, 38)} · ${t.status}`, M + 6, y, { width: 490 });
      y += 11;
      doc.font("Helvetica").fillColor(THEME.textSecondary).text(trunc(t.preview, 118), M + 6, y, { width: 490 });
      y += 16;
    }

    if (y > 560) {
      doc.addPage();
      y = M + 20;
    }
    y = sectionTitle(doc, y, "Recent signups (sample)");
    doc.fontSize(9).font("Helvetica");
    for (const u of recentUsers || []) {
      y = nextY(doc, y, 24);
      doc.save();
      doc.roundedRect(M - 2, y - 3, 504, 20, 3).fillAndStroke(THEME.cardBg, THEME.cardBorder);
      doc.restore();
      const planColor = u.isPremium ? THEME.accentAmber : THEME.textMuted;
      doc.fillColor(THEME.textSecondary).text(`${trunc(u.name, 26)}  |  ${trunc(u.email, 34)}`, M + 6, y, { width: 360 });
      doc.fillColor(planColor).font("Helvetica-Bold").text(u.isPremium ? "Pro" : "Free", M + 380, y, { width: 36 });
      doc.fillColor(THEME.textMuted).font("Helvetica").text(new Date(u.joinedAt).toLocaleDateString(), M + 420, y, { width: 80 });
    }

    doc.end();
  });
}
