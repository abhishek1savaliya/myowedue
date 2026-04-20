"use client";

import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";
import { useEffect, useState } from "react";

const DEFAULT_CONTENT = {
  heading: "Need help with your account?",
  description:
    "Tell us what you need, and our team will get back with setup, troubleshooting, or product guidance.",
  contactItems: [
    "Product help: support@myowedue.com",
    "Billing queries: billing@myowedue.com",
    "Partnerships: partners@myowedue.com",
  ],
  formTitle: "Quick message",
  successTitle: "Message sent!",
  successDescription: "Our support team will get back to you soon.",
};

export default function ContactUsPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [content, setContent] = useState(DEFAULT_CONTENT);

  useEffect(() => {
    let ignore = false;
    async function loadPageContent() {
      try {
        const res = await fetch("/api/content/page/contact-us", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!ignore && res.ok) {
          setContent({ ...DEFAULT_CONTENT, ...(data.content || {}) });
        }
      } catch {
        // keep defaults if CMS content request fails
      }
    }
    loadPageContent();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Something went wrong. Please try again.");
      } else {
        setSuccess(true);
        setForm({ name: "", email: "", message: "" });
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <Link href="/" className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
          Back to home
        </Link>

        <div className="mt-5 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-stone-700 bg-stone-900/70 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Contact us</p>
            <h1 className="mt-2 text-4xl text-stone-50">{content.heading}</h1>
            <div className="mt-4 text-sm leading-7 text-stone-300 cms-html" dangerouslySetInnerHTML={{ __html: content.description }} />

            <div className="mt-6 grid gap-3 text-sm text-stone-200">
              {(Array.isArray(content.contactItems) ? content.contactItems : []).map((item, idx) => (
                <p key={`${item}-${idx}`} className="rounded-xl border border-stone-700 bg-stone-900 px-4 py-3">
                  {item}
                </p>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-stone-700 bg-stone-900/70 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">{content.formTitle}</p>

            {success ? (
              <div className="mt-6 rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-4 py-5 text-sm text-emerald-300">
                <p className="font-semibold text-base">{content.successTitle}</p>
                <p className="mt-1 text-stone-400">{content.successDescription}</p>
                <button
                  onClick={() => setSuccess(false)}
                  className="mt-3 text-xs text-amber-300 underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <input
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-400 focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="Your email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-400 focus:outline-none"
                />
                <textarea
                  rows={5}
                  placeholder="How can we help?"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                  className="w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-400 focus:outline-none"
                />
                {error && (
                  <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-amber-200 disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Send message"}
                </button>
              </form>
            )}
          </article>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
