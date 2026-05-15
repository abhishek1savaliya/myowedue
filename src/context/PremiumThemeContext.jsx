'use client';

import { useUserStore } from '@/stores/useUserStore';

export function PremiumThemeProvider({ children }) {
  return children;
}

export function usePremiumTheme() {
  const isPremium = useUserStore((s) => Boolean(s.user?.isPremium));
  return { isPremium };
}
