'use client';

import { useEffect, useState } from 'react';
import Loader from '@/components/Loader';

export default function PricingComparison() {
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
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
    { name: 'People Tracking', free: 'Up to 50', premium: 'Unlimited' },
    { name: 'Monthly Transactions', free: 'Up to 1,000', premium: 'Unlimited' },
    { name: 'Transaction History', free: '✓', premium: '✓' },
    { name: 'Currency Support', free: '✓', premium: '✓' },
    { name: 'PDF Export', free: '✓', premium: '✓' },
    { name: 'Email Reminders', free: '✓', premium: '✓' },
    { name: 'Premium Theme Access', free: '✗', premium: '✓' },
    { name: 'Priority Support', free: '✗', premium: '✓' },
  ];

  const handleVoucherSubmit = async (e) => {
    e.preventDefault();
    if (!voucherCode.trim()) {
      setMessage('Please enter a voucher code');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/subscription/validate-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`Error: ${data.error}`);
      } else {
        setMessage(`✓ Premium subscription activated until ${new Date(data.subscriptionEndDate).toLocaleDateString()}`);
        setVoucherCode('');
        setIsPremium(true);
        setSubscriptionEndDate(data.subscriptionEndDate);
      }
    } catch (error) {
      setMessage('Failed to validate voucher');
    } finally {
      setLoading(false);
    }
  };

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
        <p className="mb-6 text-zinc-600">Choose the plan that fits your needs</p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="px-4 py-4 text-left font-semibold text-black">Feature</th>
                <th className="px-4 py-4 text-center font-semibold text-black">Free</th>
                <th className="px-4 py-4 text-center font-semibold text-amber-600">Premium</th>
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

      {/* Voucher Code Section */}
      <div className="rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <h3 className="mb-2 text-xl font-bold text-amber-900">Upgrade to Premium</h3>
        <p className="mb-6 text-amber-800">Have a voucher code? Activate it below to get premium access.</p>

        <form onSubmit={handleVoucherSubmit} className="flex gap-3">
          <input
            type="text"
            value={voucherCode}
            onChange={(e) => setVoucherCode(e.target.value)}
            placeholder="Enter voucher code"
            className="flex-1 rounded-lg border border-amber-300 bg-white px-4 py-2 text-black placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-amber-500 px-6 py-2 font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? 'Activating...' : 'Activate'}
          </button>
        </form>

        {message && (
          <p className={`mt-4 text-sm font-medium ${message.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
