"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function roleLabel(role) {
  if (role === "superadmin") return "Super Admin";
  if (role === "manager") return "Manager";
  return "Support";
}

export default function AdminChatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState([]);
  const [peerId, setPeerId] = useState("");
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [meId, setMeId] = useState("");
  const [myRole, setMyRole] = useState("");
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const bottomRef = useRef(null);

  const loadRecipients = useCallback(async () => {
    const res = await fetch("/api/admin/chat/recipients", { cache: "no-store" });
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const json = await res.json();
    setRecipients(json.recipients || []);
    const meRes = await fetch("/api/admin/me", { cache: "no-store" });
    if (meRes.ok) {
      const me = await meRes.json();
      setMeId(me.id || "");
      setMyRole(me.role || "");
    }
    setLoading(false);
  }, [router]);

  const loadThread = useCallback(
    async (withId) => {
      if (!withId) {
        setPeer(null);
        setMessages([]);
        return;
      }
      setLoadingThread(true);
      setSendError("");
      try {
        const res = await fetch(`/api/admin/chat?with=${encodeURIComponent(withId)}`, { cache: "no-store" });
        if (res.status === 401) {
          router.push("/admin/login");
          return;
        }
        const json = await res.json();
        if (!res.ok) {
          setSendError(json.message || "Could not load conversation");
          setPeer(null);
          setMessages([]);
          return;
        }
        setPeer(json.peer);
        setMessages(json.messages || []);
      } finally {
        setLoadingThread(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  useEffect(() => {
    if (peerId) loadThread(peerId);
  }, [peerId, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerId]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !peerId) return;
    setSendError("");
    setSending(true);
    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toAdminId: peerId, message: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSendError(json.message || "Send failed");
        return;
      }
      setText("");
      if (json.message) setMessages((prev) => [...prev, json.message]);
    } catch {
      setSendError("Network error");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-slate-400 sm:p-6">Loading chat…</div>
      </div>
    );
  }

  return (
    <section className="relative p-4 pb-10 sm:p-6 sm:pb-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_6%,rgba(56,189,248,0.12),transparent_34%),radial-gradient(circle_at_90%_92%,rgba(16,185,129,0.1),transparent_36%)]" />
      <div className="relative mx-auto max-w-4xl space-y-4 sm:space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">Chat</h1>
          <p className="mt-1 text-sm text-slate-400">
            Direct messages. Support can read messages from Admin but cannot send replies here. Managers and super admins can send per your contact list.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_1fr] lg:gap-5">
          <div className="max-h-[min(40vh,320px)] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/70 p-4 lg:max-h-none">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Conversation
            </label>
            {recipients.length === 0 ? (
              <p className="text-sm text-slate-500">No contacts available.</p>
            ) : (
              <ul className="space-y-1">
                {recipients.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setPeerId(r.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        peerId === r.id
                          ? "border-cyan-500/50 bg-cyan-500/10 text-white"
                          : "border-transparent text-slate-300 hover:border-slate-600 hover:bg-slate-800/60"
                      }`}
                    >
                      <span className="block font-medium truncate">{r.name}</span>
                      <span className="block text-[11px] text-slate-500">
                        {myRole === "support" && r.role === "superadmin" ? "Admin" : roleLabel(r.role)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-[min(52vh,420px)] flex-col rounded-2xl border border-slate-700 bg-slate-900/70 sm:min-h-[420px]">
            {!peerId ? (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
                Select someone to start chatting.
              </div>
            ) : loadingThread ? (
              <div className="flex flex-1 items-center justify-center p-8 text-slate-400">Loading messages…</div>
            ) : (
              <>
                <div className="border-b border-slate-700 px-4 py-3">
                  <p className="font-semibold text-white">{peer?.name}</p>
                  <p className="text-xs text-slate-500">
                    {peer
                      ? `${myRole === "support" && peer.role === "superadmin" ? "Admin" : roleLabel(peer.role)}${
                          peer.employeeId ? ` · ${peer.employeeId}` : ""
                        }`
                      : ""}
                  </p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[min(52vh,520px)]">
                  {messages.length === 0 ? (
                    <p className="text-sm text-slate-500">No messages yet. Say hello below.</p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.from?.id === meId;
                      return (
                        <div
                          key={m.id}
                          className={`rounded-xl border px-3 py-2 ${
                            mine
                              ? "ml-4 border-cyan-500/30 bg-cyan-500/10 sm:ml-8"
                              : "mr-4 border-slate-700 bg-slate-950/80 sm:mr-8"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-300">{mine ? "You" : m.from?.name}</p>
                            <p className="text-[11px] text-slate-500">{new Date(m.createdAt).toLocaleString()}</p>
                          </div>
                          <p className="text-sm text-slate-200 whitespace-pre-wrap">{m.message}</p>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>
                {myRole === "support" ? (
                  <div className="border-t border-slate-700 p-4 text-sm text-slate-500">
                    You can read messages from Admin here. Sending replies is not available for your role.
                  </div>
                ) : (
                  <form onSubmit={handleSend} className="border-t border-slate-700 p-4 space-y-2">
                    {sendError && (
                      <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                        {sendError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type a message…"
                        className="min-h-[44px] flex-1 resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={sending || !text.trim()}
                        className="shrink-0 self-end rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
                      >
                        {sending ? "…" : "Send"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
