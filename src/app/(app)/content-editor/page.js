"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import CmsEditor from "@/components/CmsEditor";

const PAGE_LABELS = {
  home: "Home Page",
  "contact-us": "Contact Us",
  "privacy-policy": "Privacy Policy",
};

export default function ContentEditorPage() {
  const [selectedPage, setSelectedPage] = useState("home");
  const [role, setRole] = useState("");
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [permissionUsers, setPermissionUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [content, setContent] = useState({});
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canReview = role === "super_admin" || role === "manager";
  const canManagePermissions = role === "super_admin" || role === "manager";

  async function loadEditor(pageKey = selectedPage) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/content/editor?page=${encodeURIComponent(pageKey)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Failed to load content editor");
        return;
      }

      setRole(data.role || "");
      setPages(data.pages || []);
      setCurrentPage(data.currentPage || null);
      setPendingSubmissions(data.pendingSubmissions || []);
      setContent(data.currentPage?.content || {});
    } catch (caughtError) {
      setError(caughtError?.message || "Failed to load content editor");
    } finally {
      setLoading(false);
    }
  }

  async function loadPermissions() {
    try {
      const res = await fetch("/api/content/permissions", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPermissionUsers(data.users || data.teamMembers || []);
      }
    } catch {
      // ignore non-critical load failures
    }
  }

  async function loadAudit() {
    try {
      const res = await fetch("/api/content/audit?limit=50", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAuditLogs(data.logs || []);
      }
    } catch {
      // ignore non-critical load failures
    }
  }

  useEffect(() => {
    loadEditor("home");
  }, []);

  useEffect(() => {
    if (!role) return;
    if (canManagePermissions) loadPermissions();
    if (role === "super_admin") loadAudit();
  }, [role]);

  const pageStats = useMemo(() => {
    return pages.reduce((acc, item) => {
      acc[item.key] = item;
      return acc;
    }, {});
  }, [pages]);

  async function saveContent() {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const res = await fetch(`/api/content/editor/${selectedPage}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, detail }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to save content");
        return;
      }

      setDetail("");
      if (data.mode === "published") {
        setNotice("Content published successfully.");
      } else {
        setNotice("Changes submitted for manager approval.");
      }

      await loadEditor(selectedPage);
      if (canManagePermissions) await loadPermissions();
      if (role === "super_admin") await loadAudit();
    } catch (caughtError) {
      setError(caughtError?.message || "Failed to save content");
    } finally {
      setSaving(false);
    }
  }

  async function switchPage(pageKey) {
    setSelectedPage(pageKey);
    await loadEditor(pageKey);
  }

  async function reviewSubmission(submissionId, decision) {
    const feedback = window.prompt(
      decision === "approve"
        ? "Approval note (optional):"
        : "Rejection feedback (required):",
      ""
    );

    if (decision === "reject" && !String(feedback || "").trim()) {
      window.alert("Feedback is required when rejecting a change.");
      return;
    }

    try {
      const res = await fetch(`/api/content/editor/submission/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, feedback: feedback || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data?.message || "Failed to review submission");
        return;
      }
      await loadEditor(selectedPage);
      if (role === "super_admin") await loadAudit();
    } catch {
      window.alert("Failed to review submission");
    }
  }

  async function updatePermission(member, nextValue, nextRole = null) {
    try {
      const res = await fetch("/api/content/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          contentEditPermission: nextValue,
          ...(nextRole ? { cmsRole: nextRole } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data?.message || "Failed to update permission");
        return;
      }

      setPermissionUsers((prev) =>
        prev.map((item) =>
          item.id === member.id
            ? { ...item, contentEditPermission: nextValue, ...(nextRole ? { cmsRole: nextRole } : {}) }
            : item
        )
      );

      if (role === "super_admin") {
        await loadAudit();
      }
    } catch {
      window.alert("Failed to update permission");
    }
  }

  if (loading && !currentPage) return <Loader />;

  if (error && !currentPage) {
    return <EmptyState text={error} />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-black">Content Editor</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Role: <span className="font-semibold uppercase">{role || "unknown"}</span>
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Editable pages</p>
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
                  active ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-zinc-800"
                }`}
              >
                <p className="text-sm font-semibold">{PAGE_LABELS[key]}</p>
                <p className={`mt-1 text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>
                  Version {stat.version || 1} • Pending {stat.pendingCount || 0}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-black">{PAGE_LABELS[selectedPage]}</h2>
          <p className="text-xs text-zinc-500">Published version: {currentPage?.version || 1}</p>
        </div>

        <div className="mt-4">
          <CmsEditor
            pageKey={selectedPage}
            content={content}
            onChange={setContent}
          />
        </div>

        <label className="mt-4 block text-sm font-medium text-zinc-700">Change note</label>
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Describe what changed"
          className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        />

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}

        <button
          type="button"
          onClick={saveContent}
          disabled={saving}
          className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : canReview ? "Publish changes" : "Submit for approval"}
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-black">Pending Submissions</h2>
        {pendingSubmissions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No pending submissions.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {pendingSubmissions.map((submission) => (
              <div key={submission.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-semibold text-zinc-800">
                  {PAGE_LABELS[submission.pageKey] || submission.pageKey} by {submission.submittedBy?.name || "Unknown"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(submission.createdAt).toLocaleString()} • {submission.submittedRole}
                </p>
                <p className="mt-2 text-xs text-zinc-600">Changes: {submission.diff?.length || 0} fields</p>
                {submission.feedback ? (
                  <p className="mt-1 text-xs text-zinc-600">Note: {submission.feedback}</p>
                ) : null}

                {canReview ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => reviewSubmission(submission.id, "approve")}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewSubmission(submission.id, "reject")}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {canManagePermissions ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-black">Permission Management</h2>
          {permissionUsers.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">No users found for permission management.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {permissionUsers.map((member) => (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{member.name}</p>
                    <p className="text-xs text-zinc-500">{member.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {role === "super_admin" ? (
                      <select
                        value={member.cmsRole || "team_member"}
                        onChange={(e) => updatePermission(member, member.contentEditPermission, e.target.value)}
                        className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="manager">Manager</option>
                        <option value="team_member">Team Member</option>
                      </select>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => updatePermission(member, !member.contentEditPermission)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        member.contentEditPermission
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-zinc-300 bg-white text-zinc-700"
                      }`}
                    >
                      {member.contentEditPermission ? "Editing Allowed" : "Grant Editing"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {role === "super_admin" ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-black">Audit Log</h2>
          {auditLogs.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">No audit activity yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-semibold text-zinc-800">{log.action.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(log.createdAt).toLocaleString()} • {log.actor?.name || "Unknown"} ({log.actorRole})
                  </p>
                  {log.pageKey ? <p className="mt-1 text-xs text-zinc-600">Page: {PAGE_LABELS[log.pageKey] || log.pageKey}</p> : null}
                  {log.detail ? <p className="mt-1 text-xs text-zinc-600">{log.detail}</p> : null}
                  <p className="mt-1 text-xs text-zinc-600">Diff entries: {(log.diff || []).length}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
