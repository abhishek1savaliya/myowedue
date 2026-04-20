"use client";

import { useEffect, useMemo, useState } from "react";
import CmsEditor from "@/components/CmsEditor";

const PAGE_LABELS = {
  home: "Home Page",
  "contact-us": "Contact Us",
  "privacy-policy": "Privacy Policy",
};

export default function AdminContentEditorPage() {
  const [selectedPage, setSelectedPage] = useState("home");
  const [adminRole, setAdminRole] = useState("");
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [content, setContent] = useState({});
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadEditor(pageKey = selectedPage) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/content?page=${encodeURIComponent(pageKey)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to load content editor");
        setLoading(false);
        return;
      }
      setAdminRole(data.role || "");
      setPages(data.pages || []);
      setCurrentPage(data.currentPage || null);
      setPendingSubmissions(data.pendingSubmissions || []);
      setContent(data.currentPage?.content || {});
    } catch (err) {
      setError(err?.message || "Failed to load content editor");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEditor("home");
  }, []);

  async function switchPage(pageKey) {
    setSelectedPage(pageKey);
    await loadEditor(pageKey);
  }

  async function saveContent() {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/content/${selectedPage}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, detail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to publish content");
        return;
      }
      setDetail("");
      setNotice("Content published successfully.");
      await loadEditor(selectedPage);
    } catch (err) {
      setError(err?.message || "Failed to publish content");
    } finally {
      setSaving(false);
    }
  }

  async function reviewSubmission(submissionId, decision) {
    const feedback = window.prompt(
      decision === "approve" ? "Approval note (optional):" : "Rejection feedback (required):",
      ""
    );
    if (decision === "reject" && !String(feedback || "").trim()) {
      window.alert("Feedback is required when rejecting.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/content/${selectedPage}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, decision, feedback: feedback || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data?.message || "Failed to review submission");
        return;
      }
      await loadEditor(selectedPage);
    } catch {
      window.alert("Failed to review submission");
    }
  }

  const pageStats = useMemo(
    () => pages.reduce((acc, item) => { acc[item.key] = item; return acc; }, {}),
    [pages]
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Content Editor</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage public page content. Role:{" "}
          <span className="font-semibold uppercase text-cyan-300">{adminRole || "…"}</span>
        </p>
      </header>

      {error && !currentPage && (
        <div className="rounded-xl bg-rose-900/40 border border-rose-700/50 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {loading && !currentPage ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <>
          {/* Page selector */}
          <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Editable pages
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.keys(PAGE_LABELS).map((key) => {
                const stat = pageStats[key] || {};
                const active = key === selectedPage;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switchPage(key)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-cyan-500 bg-cyan-900/40 text-white"
                        : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <p className="text-sm font-semibold">{PAGE_LABELS[key]}</p>
                    <p className={`mt-1 text-xs ${active ? "text-cyan-300" : "text-slate-500"}`}>
                      v{stat.version || 1} &bull; {stat.pendingCount || 0} pending
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Editor */}
          <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">{PAGE_LABELS[selectedPage]}</h2>
              <p className="text-xs text-slate-400">
                Published version: {currentPage?.version || 1}
              </p>
            </div>

            <div className="mt-4">
              <CmsEditor
                pageKey={selectedPage}
                content={content}
                onChange={setContent}
              />
            </div>

            <label className="mt-4 block text-sm font-medium text-slate-300">Change note</label>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Describe what changed (optional)"
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            />

            {error && (
              <p className="mt-3 text-sm text-rose-400">{error}</p>
            )}
            {notice && (
              <p className="mt-3 text-sm text-emerald-400">{notice}</p>
            )}

            <button
              type="button"
              onClick={saveContent}
              disabled={saving}
              className="mt-4 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Publishing…" : "Publish Changes"}
            </button>
          </section>

          {/* Pending Submissions */}
          <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <h2 className="text-lg font-semibold text-white">Pending Submissions</h2>
            {pendingSubmissions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No pending submissions.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {pendingSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-slate-700 bg-slate-900/50 p-3"
                  >
                    <p className="text-sm font-semibold text-white">
                      {PAGE_LABELS[sub.pageKey] || sub.pageKey} &mdash;{" "}
                      {sub.submittedBy?.name || "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(sub.createdAt).toLocaleString()} &bull; {sub.submittedRole}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {sub.diff?.length || 0} field change(s)
                    </p>
                    {sub.feedback && (
                      <p className="mt-1 text-xs text-slate-400">Note: {sub.feedback}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => reviewSubmission(sub.id, "approve")}
                        className="rounded-lg border border-emerald-600/50 bg-emerald-900/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-800/60 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewSubmission(sub.id, "reject")}
                        className="rounded-lg border border-rose-600/50 bg-rose-900/40 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-800/60 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
