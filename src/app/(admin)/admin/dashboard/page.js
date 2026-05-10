"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  CreditCard,
  Crown,
  UserPlus,
  ArrowRightLeft,
  Ticket,
  MessageSquareText,
  Heart,
  Share2,
  AtSign,
  LayoutDashboard,
  Sparkles,
  FileDown,
} from "lucide-react";
import { useAppAlert } from "@/components/AppAlertProvider";

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value == null ? "-" : value.toLocaleString()}</p>
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    queued: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
    open: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    in_progress: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    closed: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${map[status] || map.closed}`}>
      {String(status || "closed").replace("_", " ")}
    </span>
  );
}

function TicketLine({ t }) {
  return (
    <Link
      href={`/admin/tickets/${t.id}`}
      className="group flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 transition hover:border-cyan-400/40"
    >
      <div className="min-w-0 pr-4">
        <p className="truncate text-sm font-semibold text-white">{t.name}</p>
        <p className="truncate text-xs text-slate-400">{t.message}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusChip status={t.status} />
        <span className="text-xs text-slate-500 group-hover:text-cyan-300">Open</span>
      </div>
    </Link>
  );
}

function ManagerDashboard({ admin }) {
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/tickets?page=1"),
      fetch("/api/admin/tickets?status=completed&page=1&limit=1"),
    ])
      .then(([rActive, rDone]) => {
        if (rActive.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return Promise.all([rActive.json(), rDone.ok ? rDone.json() : { total: 0 }]);
      })
      .then((pair) => {
        if (!pair) return;
        const [jActive, jDone] = pair;
        setTickets(jActive.tickets || []);
        setCompletedTotal(typeof jDone.total === "number" ? jDone.total : 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const open = tickets.filter((t) => t.status === "open").length;
  const active = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;

  return (
    <section className="relative p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(45,212,191,0.12),transparent_35%),radial-gradient(circle_at_88%_88%,rgba(14,165,233,0.12),transparent_36%)]" />
      <div className="relative space-y-6">
        <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">Manager Workspace</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Hello, {admin?.name}</h1>
          <p className="mt-1 text-sm text-slate-300">Monitor your queue, balance assignments, and unblock your team quickly.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total Queue" value={tickets.length} accent="text-cyan-300" />
          <StatCard label="Needs Attention" value={active} accent="text-amber-300" />
          <StatCard label="Completed" value={completedTotal} accent="text-emerald-300" />
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Open First</h2>
            <div className="text-xs text-slate-400">Open: {open}</div>
          </div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-slate-500">No tickets assigned to your team yet.</p>
          ) : (
            <div className="space-y-2">{tickets.slice(0, 7).map((t) => <TicketLine key={t.id} t={t} />)}</div>
          )}
          <div className="mt-4">
            <Link href="/admin/tickets" className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300 hover:text-cyan-200">
              Go to full ticket board
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SupportDashboard({ admin }) {
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/tickets?page=1")
      .then((r) => {
        if (r.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((j) => {
        if (!j) return;
        setTickets(j.tickets || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const active = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;

  return (
    <section className="relative p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_90%_90%,rgba(16,185,129,0.1),transparent_35%)]" />
      <div className="relative space-y-6">
        <div className="rounded-2xl border border-blue-500/25 bg-slate-900/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">Support Desk</p>
          <h1 className="mt-2 text-3xl font-bold text-white">{admin?.name}</h1>
          <p className="mt-1 text-sm text-slate-300">Focus only on your assigned cases and keep response quality high.</p>
          {admin?.employeeId && <p className="mt-3 font-mono text-xs text-slate-500">Employee ID: {admin.employeeId}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Assigned to Me" value={tickets.length} accent="text-blue-300" />
          <StatCard label="Active Now" value={active} accent="text-amber-300" />
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">My Recent Cases</h2>
            <Link href="/admin/tickets" className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-300 hover:text-blue-200">
              View all
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : tickets.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-300">No cases assigned yet</p>
              <p className="mt-1 text-xs text-slate-500">Your manager will route new tickets to you.</p>
            </div>
          ) : (
            <div className="space-y-2">{tickets.slice(0, 8).map((t) => <TicketLine key={t.id} t={t} />)}</div>
          )}
        </div>
      </div>
    </section>
  );
}

function AnalyticsBarChart({ series, valueKey, colorClass }) {
  const max = Math.max(...(series || []).map((x) => x[valueKey] || 0), 1);
  return (
    <div className="flex h-36 items-end gap-2 sm:gap-3">
      {(series || []).map((m) => {
        const v = m[valueKey] || 0;
        const pct = Math.max((v / max) * 100, v > 0 ? 8 : 4);
        return (
          <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold tabular-nums text-slate-300">{v}</span>
            <div
              className={`w-full max-w-[48px] rounded-t-md ${colorClass} transition-all`}
              style={{ height: `${pct}%`, minHeight: v > 0 ? "12px" : "4px" }}
            />
            <span className="text-center text-[10px] font-medium uppercase tracking-wider text-slate-500">{m.month}</span>
          </div>
        );
      })}
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition hover:border-slate-600 hover:bg-slate-900/80">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl ${accent.blob}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className={`mt-2 text-3xl font-bold tabular-nums tracking-tight ${accent.text}`}>
            {value == null ? "—" : value.toLocaleString()}
          </p>
          {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={`rounded-xl border p-2.5 ${accent.iconWrap}`}>
          <Icon className={`h-5 w-5 ${accent.icon}`} strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

// ── Superadmin Dashboard ────────────────────────────────────────────────────
function SuperAdminDashboard({ admin }) {
  const router = useRouter();
  const { showAlert } = useAppAlert();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function downloadReportPdf() {
    setPdfLoading(true);
    try {
      const res = await fetch("/api/admin/stats/report-pdf", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showAlert(j.message || "Could not generate PDF report.", { severity: "error" });
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition");
      let filename = "myowedue-executive-report.pdf";
      const m = dispo && /filename="([^"]+)"/.exec(dispo);
      if (m) filename = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showAlert("Report downloaded.", { severity: "success" });
    } catch {
      showAlert("Network error while downloading the report.", { severity: "error" });
    } finally {
      setPdfLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (res.status === 401) {
        setLoading(false);
        router.push("/admin/login");
        return;
      }
      if (res.status === 403) {
        setLoadError("You do not have access to this analytics workspace.");
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.message || "Failed to load analytics");
        setLoading(false);
        return;
      }
      setData(json);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <LayoutDashboard className="h-10 w-10 animate-pulse text-amber-400/50" strokeWidth={1.25} />
        <p className="text-sm text-slate-400">Loading analytics…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">{loadError}</div>
      </div>
    );
  }

  const {
    stats,
    recentUsers,
    monthlyTrend,
    monthlyTransactionsTrend,
    tickets,
    team,
    posts,
  } = data || {};

  const tb = tickets?.byStatus || {};
  const ticketStatusOrder = [
    ["queued", "Queued", "bg-fuchsia-500/80"],
    ["open", "Open", "bg-sky-500/80"],
    ["in_progress", "In progress", "bg-amber-500/80"],
    ["resolved", "Resolved", "bg-emerald-500/80"],
    ["closed", "Closed", "bg-slate-500/80"],
  ];
  const tMax = Math.max(tickets?.total || 1, 1);

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(251,191,36,0.08),transparent),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(56,189,248,0.06),transparent),radial-gradient(ellipse_60%_40%_at_0%_80%,rgba(167,139,250,0.05),transparent)]" />

      <div className="space-y-8 p-6 pb-12">
        <header className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-linear-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 px-6 py-8 shadow-xl shadow-black/30 md:px-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-400/50 to-transparent" />
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                Executive overview
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">Command center</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                Real-time platform health, growth, support load, team footprint, and community engagement — in one view.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3 text-right">
              <button
                type="button"
                onClick={downloadReportPdf}
                disabled={pdfLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100 shadow-sm transition hover:bg-amber-500/25 disabled:opacity-50"
              >
                <FileDown className="h-4 w-4 shrink-0" strokeWidth={2} />
                {pdfLoading ? "Building PDF…" : "Export full report (PDF)"}
              </button>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Signed in</p>
                <p className="mt-1 text-sm font-semibold text-white">{admin?.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                  {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiTile
            icon={Users}
            label="Total users"
            value={stats?.totalUsers}
            sub="All registered accounts"
            accent={{ text: "text-sky-300", icon: "text-sky-300", iconWrap: "border-sky-500/30 bg-sky-500/10", blob: "bg-sky-400" }}
          />
          <KpiTile
            icon={ArrowRightLeft}
            label="Transactions"
            value={stats?.totalTransactions}
            sub="Non-deleted ledger rows"
            accent={{ text: "text-emerald-300", icon: "text-emerald-300", iconWrap: "border-emerald-500/30 bg-emerald-500/10", blob: "bg-emerald-400" }}
          />
          <KpiTile
            icon={Crown}
            label="Active Pro"
            value={stats?.activeSubscribers}
            sub="Premium in good standing"
            accent={{ text: "text-amber-300", icon: "text-amber-300", iconWrap: "border-amber-500/30 bg-amber-500/10", blob: "bg-amber-400" }}
          />
          <KpiTile
            icon={UserPlus}
            label="New users (month)"
            value={stats?.newUsersThisMonth}
            sub="Signups this calendar month"
            accent={{ text: "text-violet-300", icon: "text-violet-300", iconWrap: "border-violet-500/30 bg-violet-500/10", blob: "bg-violet-400" }}
          />
          <KpiTile
            icon={CreditCard}
            label="Txns (month)"
            value={stats?.newTransactionsThisMonth}
            sub="Transaction activity this month"
            accent={{ text: "text-rose-300", icon: "text-rose-300", iconWrap: "border-rose-500/30 bg-rose-500/10", blob: "bg-rose-400" }}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-6 backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">User acquisition</h2>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">6 months</span>
            </div>
            <AnalyticsBarChart series={monthlyTrend} valueKey="users" colorClass="bg-linear-to-t from-sky-600 to-sky-400" />
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-6 backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">Transaction volume</h2>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">6 months</span>
            </div>
            <AnalyticsBarChart
              series={monthlyTransactionsTrend}
              valueKey="transactions"
              colorClass="bg-linear-to-t from-emerald-700 to-emerald-400"
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-6 backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Ticket className="h-4 w-4 text-cyan-400" strokeWidth={2} />
                Support pipeline
              </h2>
              <Link href="/admin/tickets" className="text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                Open tickets →
              </Link>
            </div>
            <p className="mb-4 text-2xl font-bold tabular-nums text-white">{tickets?.total ?? 0} <span className="text-sm font-normal text-slate-500">total</span></p>
            <div className="space-y-3">
              {ticketStatusOrder.map(([key, label, fill]) => {
                const n = tb[key] ?? 0;
                const w = Math.round((n / tMax) * 100);
                return (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-400">{label}</span>
                      <span className="tabular-nums text-slate-300">{n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(w, n ? 6 : 0)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 space-y-2 border-t border-slate-800 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Latest</p>
              {(tickets?.recent || []).length === 0 ? (
                <p className="text-sm text-slate-500">No tickets yet.</p>
              ) : (
                (tickets?.recent || []).map((t) => (
                  <Link
                    key={t.id}
                    href={`/admin/tickets/${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2.5 text-left transition hover:border-cyan-500/35"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">{t.name}</p>
                      <p className="truncate text-xs text-slate-500">{t.preview}</p>
                    </div>
                    <StatusChip status={t.status} />
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-6 backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Admin team</h2>
              <Link href="/admin/team" className="text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                Manage →
              </Link>
            </div>
            <p className="mb-4 text-2xl font-bold tabular-nums text-white">
              {team?.activeTotal ?? 0} <span className="text-sm font-normal text-slate-500">active seats</span>
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "superadmin", label: "Super admin", text: "text-amber-300", box: "border-amber-500/30 bg-amber-500/10" },
                { key: "manager", label: "Managers", text: "text-cyan-300", box: "border-cyan-500/30 bg-cyan-500/10" },
                { key: "support", label: "Support", text: "text-emerald-300", box: "border-emerald-500/30 bg-emerald-500/10" },
              ].map(({ key, label, text, box }) => (
                <div key={key} className={`rounded-xl border px-3 py-4 text-center ${box}`}>
                  <p className={`text-2xl font-bold tabular-nums ${text}`}>{team?.byRole?.[key] ?? 0}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-6 backdrop-blur-sm">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageSquareText className="h-4 w-4 text-violet-400" strokeWidth={2} />
              Community post analytics
            </h2>
            <Link href="/community" className="text-xs font-semibold text-violet-400 hover:text-violet-300">
              View community →
            </Link>
          </div>

          {!posts?.configured ? (
            <p className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-6 text-sm text-slate-500">
              Community (Supabase) is not configured. Connect Supabase to see post engagement metrics here.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Posts</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-white">{posts.totalPosts?.toLocaleString?.() ?? 0}</p>
                  <p className="mt-1 text-xs text-slate-500">{posts.postsThisMonth ?? 0} this month</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <Heart className="h-3.5 w-3.5 text-rose-400" strokeWidth={2} /> Likes
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-rose-200">{posts.totalLikes?.toLocaleString?.() ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <AtSign className="h-3.5 w-3.5 text-sky-400" strokeWidth={2} /> Comments
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-sky-200">{posts.totalComments?.toLocaleString?.() ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <Share2 className="h-3.5 w-3.5 text-amber-400" strokeWidth={2} /> Shares
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-amber-200">{posts.totalShares?.toLocaleString?.() ?? 0}</p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/30 p-5">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">New posts · last 7 days</p>
                <div className="flex h-28 items-end gap-2">
                  {(posts.postsLast7Days || []).map((d) => {
                    const max = Math.max(...(posts.postsLast7Days || []).map((x) => x.posts), 1);
                    const pct = Math.max(((d.posts || 0) / max) * 100, d.posts > 0 ? 12 : 4);
                    return (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] font-semibold text-slate-400">{d.posts}</span>
                        <div className="w-full rounded-t bg-linear-to-t from-violet-700 to-violet-400" style={{ height: `${pct}%`, minHeight: d.posts ? "8px" : "4px" }} />
                        <span className="text-[9px] text-slate-600">{d.shortLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Post</th>
                      <th className="px-4 py-3">Author</th>
                      <th className="px-4 py-3 text-center">Likes</th>
                      <th className="px-4 py-3 text-center">Comments</th>
                      <th className="px-4 py-3 text-center">Shares</th>
                      <th className="px-4 py-3">Posted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(posts.topPosts || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No posts to rank yet.
                        </td>
                      </tr>
                    ) : (
                      (posts.topPosts || []).map((p) => (
                        <tr key={p.id} className="border-b border-slate-800/80 hover:bg-slate-800/30">
                          <td className="max-w-xs px-4 py-3 text-slate-300">{p.bodyPreview}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-400">{p.authorName}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-slate-300">{p.likes}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-slate-300">{p.comments}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-slate-300">{p.shares}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-6 backdrop-blur-sm">
          <h2 className="mb-4 text-sm font-semibold text-white">Recent signups</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Plan</th>
                  <th className="pb-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {(recentUsers || []).map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                    <td className="py-3 pr-4 font-medium text-slate-200">{u.name}</td>
                    <td className="py-3 pr-4 text-slate-400">{u.email}</td>
                    <td className="py-3 pr-4">
                      {u.isPremium ? (
                        <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">Pro</span>
                      ) : (
                        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400">Free</span>
                      )}
                    </td>
                    <td className="py-3 text-xs text-slate-500">{new Date(u.joinedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Root: detect role and render correct dashboard ──────────────────────────
export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => {
        if (r.status === 401) {
          setUnauthorized(true);
          setLoading(false);
          router.push("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setAdmin(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (unauthorized || !admin?.role) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Redirecting to admin login...</p>
      </div>
    );
  }

  if (admin?.role === "manager")    return <ManagerDashboard admin={admin} />;
  if (admin?.role === "support")    return <SupportDashboard admin={admin} />;
  return <SuperAdminDashboard admin={admin} />;
}
