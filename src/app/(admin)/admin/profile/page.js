"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function roleLabel(role) {
  if (role === "superadmin") return "Super Admin";
  if (role === "manager") return "Manager";
  return "Support";
}

export default function AdminProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [profile, setProfile] = useState(null);
  const [target, setTarget] = useState(null);
  const [messages, setMessages] = useState([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [messageText, setMessageText] = useState("");

  const [saveError, setSaveError] = useState("");
  const [sendError, setSendError] = useState("");

  const joinDateText = useMemo(() => {
    if (!profile?.joinDate) return "-";
    return new Date(profile.joinDate).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [profile]);

  async function loadProfile() {
    setLoading(true);

    const [profileRes, messagesRes] = await Promise.all([
      fetch("/api/admin/profile", { cache: "no-store" }),
      fetch("/api/admin/profile/messages", { cache: "no-store" }),
    ]);

    if (profileRes.status === 401 || messagesRes.status === 401) {
      router.push("/admin/login");
      return;
    }

    const profileJson = await profileRes.json();
    const messagesJson = await messagesRes.json();

    const p = profileJson.profile;
    setProfile(p);
    setFirstName(p?.firstName || "");
    setLastName(p?.lastName || "");
    setTarget(profileJson.messageTarget || null);
    setMessages(messagesJson.messages || []);

    setLoading(false);
  }

  useEffect(() => {
    loadProfile().catch(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaveError("");
    setSaving(true);

    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.message || "Unable to save profile");
        return;
      }
      setProfile((prev) => ({ ...prev, ...json.profile }));
    } catch {
      setSaveError("Network error while saving profile");
    } finally {
      setSaving(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const text = messageText.trim();
    if (!text) return;

    setSendError("");
    setSending(true);

    try {
      const res = await fetch("/api/admin/profile/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSendError(json.message || "Unable to send message");
        return;
      }
      setMessages((prev) => [...prev, json.message]);
      setMessageText("");
    } catch {
      setSendError("Network error while sending message");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-slate-400">Loading profile...</div>
      </div>
    );
  }

  return (
    <section className="relative p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_6%,rgba(56,189,248,0.12),transparent_34%),radial-gradient(circle_at_90%_92%,rgba(16,185,129,0.1),transparent_36%)]" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Profile</p>
            <h1 className="mt-1 text-2xl font-bold text-white">My Profile</h1>
            <p className="mt-1 text-sm text-slate-400">Update your personal details used in admin workspace.</p>
          </div>

          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">First Name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Last Name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Email</p>
                <p className="text-sm text-slate-200 break-all">{profile?.email || "-"}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Role</p>
                <p className="text-sm text-slate-200">{roleLabel(profile?.role)}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Employee ID</p>
                <p className="text-sm font-mono text-slate-200">{profile?.employeeId || "-"}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Join Date</p>
                <p className="text-sm text-slate-200">{joinDateText}</p>
              </div>
            </div>

            {saveError && (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{saveError}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Upward Message</p>
            <h2 className="mt-1 text-2xl font-bold text-white">
              {profile?.role === "manager" ? "Message to Super Admin" : "Message to Manager"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {target
                ? `Conversation with ${target.name} (${roleLabel(target.role)})`
                : "No target available for your role yet."}
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages yet.</p>
            ) : (
              messages.map((m) => {
                const mine = m.from?.id === profile?.id;
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl border px-3 py-2 ${
                      mine
                        ? "ml-8 border-cyan-500/30 bg-cyan-500/10"
                        : "mr-8 border-slate-700 bg-slate-900"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-300">{mine ? "You" : m.from?.name || "Unknown"}</p>
                      <p className="text-[11px] text-slate-500">{new Date(m.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{m.message}</p>
                  </div>
                );
              })
            )}
          </div>

          {target && (
            <form onSubmit={sendMessage} className="space-y-3">
              <textarea
                rows={3}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={`Write a message to ${target.name}...`}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
              {sendError && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{sendError}</p>
              )}
              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-300 disabled:opacity-60"
              >
                {sending ? "Sending..." : `Send to ${roleLabel(target.role)}`}
              </button>
            </form>
          )}
        </article>
      </div>
    </section>
  );
}
