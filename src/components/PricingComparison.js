'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Loader from '@/components/Loader';

export default function PricingComparison() {
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    const loadPremiumStatus = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && data?.user) {
          setIsPremium(Boolean(data.user.isPremium));
          setSubscriptionEndDate(data.user.subscriptionEndDate);
        }
      } catch (error) {
        console.error('Failed to load premium status:', error);
      } finally {
        setLoadingStatus(false);
      }
    };

    loadPremiumStatus();
  }, []);

  const features = [
    { name: 'Tracking', free: 'Basic tracking', premium: 'Advanced workflow tracking' },
    { name: 'Records', free: '500 active people and 700 active transactions', premium: 'Unlimited records' },
    { name: 'Reminders', free: 'Manual reminders', premium: 'Smart reminders (SMS/WhatsApp ready)' },
    { name: 'Dashboard', free: 'Basic dashboard', premium: 'Advanced financial intelligence' },
    { name: 'Reports', free: 'Basic list and snapshot', premium: 'Advanced reports and insights' },
    { name: 'Recurring dues', free: '✗', premium: '✓' },
    { name: 'Exports', free: 'CSV and JPG', premium: 'Premium PDF and Excel' },
    { name: 'Payment links', free: '✗', premium: 'Workspace ready' },
    { name: 'Backup & recovery', free: 'Standard', premium: 'Priority support included' },
    { name: 'Bin retention', free: '3 years', premium: 'Unlimited' },
    { name: 'Appearance', free: 'Standard light/dark', premium: 'Premium UI, font family and font size controls' },
    { name: 'Support', free: 'Standard support', premium: 'Advanced personalized support' },
  ];

  if (loadingStatus) {
    return <Loader />;
  }

  // If premium, show minimal info
  if (isPremium) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <h2 className="mb-2 text-2xl font-bold text-amber-900">✓ Premium Member</h2>
        <p className="text-amber-800 mb-4">
          You have an active premium subscription with unlimited access to all features.
        </p>
        {subscriptionEndDate && (
          <p className="text-sm text-amber-700">
            Subscription expires: <span className="font-semibold">{new Date(subscriptionEndDate).toLocaleDateString()}</span>
          </p>
        )}
      </div>
    );
  }

  // If free, show comparison and upgrade options
  return (
    <div className="space-y-8">
      {/* Pricing Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <h2 className="mb-2 text-2xl font-bold text-black">Plans & Features</h2>
        <p className="mb-6 text-zinc-600">Free for basics, or go Pro for $7/month or $70/year.</p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="px-4 py-4 text-left font-semibold text-black">Feature</th>
                <th className="px-4 py-4 text-center font-semibold text-black">Free</th>
                <th className="px-4 py-4 text-center font-semibold text-amber-600">Pro</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, idx) => (
                <tr key={idx} className="border-b border-zinc-100">
                  <td className="px-4 py-4 text-left text-black font-medium">{feature.name}</td>
                  <td className="px-4 py-4 text-center text-zinc-600">{feature.free}</td>
                  <td className="px-4 py-4 text-center font-semibold text-amber-600">{feature.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Purchase Section */}
      <div className="rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <h3 className="mb-2 text-xl font-bold text-amber-900">Upgrade to Pro</h3>
        <p className="mb-3 text-amber-800">Monthly: $7. You can apply voucher codes on the next page and pay $0 when a valid voucher is entered.</p>
        <p className="mb-6 text-sm text-amber-700">Open My Subscription to view pro benefits, voucher field, payment popup, and activation details with due-date guidance.</p>

        <Link
          href="/my-subscription"
          className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-6 py-2 font-semibold text-white hover:bg-amber-600"
        >
          Go to My Subscription
        </Link>
      </div>
    </div>
  );
}
