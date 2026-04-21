import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Copy, Lock, Wallet } from "lucide-react";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";
import { activeQuery } from "@/lib/bin";
import { deriveUserKey, decryptTransaction } from "@/lib/crypto";
import { recurringLabel } from "@/lib/recurring";
import { getSessionUser } from "@/lib/session";

export const metadata = {
	title: "Payment Request",
	description: "Payment request link for a due transaction.",
};

function formatMoney(value, currency) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency || "USD",
		maximumFractionDigits: 2,
	}).format(Number(value || 0));
}

export default async function PaymentLinkPage({ params }) {
	const { token } = await params;
	await connectDB();

	const tx = await Transaction.findOne({
		paymentLinkToken: token,
		...activeQuery(),
	})
		.populate("personId", "name email phone")
		.populate("userId", "name email phone");

	if (!tx?.userId) notFound();

	const visibility = tx.paymentLinkVisibility || "public";

	if (visibility === "private") {
		const sessionUser = await getSessionUser();
		if (!sessionUser) {
			redirect(`/login?next=/pay/${token}`);
		}
		if (String(sessionUser._id) !== String(tx.userId._id)) {
			return (
				<main className="payment-link-ui flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
					<div className="max-w-md text-center">
						<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
							<Lock className="h-6 w-6" />
						</div>
						<h1 className="text-2xl font-semibold text-black">Private Link</h1>
						<p className="mt-3 text-sm leading-7 text-zinc-600">
							This payment link is private and can only be viewed by the person who created it.
						</p>
						<Link
							href="/dashboard"
							className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
						>
							Go to Dashboard
						</Link>
					</div>
				</main>
			);
		}
	}

	const userKey = await deriveUserKey(tx.userId._id.toString(), tx.userId.email);
	const decrypted = tx.encryptedAmount ? await decryptTransaction(tx.toObject(), userKey) : tx.toObject();

	const ownerName = tx.userId.name || "OWE DUE user";
	const personName = tx.personId?.name || "there";
	const noteText = decrypted.notes || "No additional note shared.";
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://myowedue.vercel.app";
	const recurringText = recurringLabel(tx);
	const isPaid = tx.status === "paid";

	return (
		<main className="payment-link-ui min-h-screen bg-background text-foreground">
			<section className="mx-auto max-w-4xl px-6 py-12 md:py-16">
				<div className="flex items-center justify-between">
					<Link href="/" className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-600">
						Back to home
					</Link>
					{visibility === "private" ? (
						<span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
							<Lock className="h-3 w-3" /> Private
						</span>
					) : null}
				</div>

				{isPaid ? (
					<div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
						This transaction has already been marked as paid.
					</div>
				) : null}

				<div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
					<article className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.08)] md:p-8">
						<p className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
							<Wallet className="h-3.5 w-3.5" />
							Payment Request
						</p>
						<h1 className="mt-4 text-4xl text-black">{ownerName} is requesting a payment</h1>
						<p className="mt-4 text-sm leading-7 text-zinc-600">
							This link was generated from OWE DUE as a premium payment request for {personName}. Use the amount and contact details below to complete the payment directly with the requester.
						</p>

						<div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
							<p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Amount Due</p>
							<p className="mt-2 text-3xl font-semibold text-black">{formatMoney(decrypted.amount || 0, tx.currency)}</p>
							<p className="mt-2 text-sm text-zinc-600">Due date: {new Date(tx.date).toLocaleDateString()}</p>
							<p className="mt-1 text-sm text-zinc-600">Schedule: {recurringText}</p>
						</div>

						<div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
							<p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Request Note</p>
							<p className="mt-2 text-sm leading-7 text-zinc-700">{noteText}</p>
						</div>
					</article>

					<article className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.08)] md:p-8">
						<h2 className="text-xl font-semibold text-black">How to pay</h2>
						<p className="mt-3 text-sm leading-7 text-zinc-600">
							OWE DUE does not process card payments directly in this link yet. Use your preferred channel to coordinate payment with the requester, then confirm payment in the app.
						</p>

						<div className="mt-5 space-y-3 text-sm text-zinc-700">
							<div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
								<p className="font-semibold text-black">Requester</p>
								<p className="mt-1">{ownerName}</p>
							</div>
							<div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
								<p className="font-semibold text-black">Privacy</p>
								<p className="mt-1">Contact details are hidden for security.</p>
							</div>
						</div>

						<div className="mt-6 flex flex-col gap-3">
							<a
								href={`${siteUrl}/login`}
								className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700"
							>
								Open OWE DUE
								<Copy className="h-4 w-4" />
							</a>
						</div>
					</article>
				</div>
			</section>
		</main>
	);
}
