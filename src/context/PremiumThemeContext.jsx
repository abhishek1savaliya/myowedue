'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const PremiumThemeContext = createContext();

export function PremiumThemeProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    // Load premium status when component mounts
    const loadPremiumStatus = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && data?.user) {
          setIsPremium(Boolean(data.user.isPremium));
        }
      } catch (error) {
        console.error('Failed to load premium status:', error);
      }
    };

    loadPremiumStatus();
  }, []);

  return (
    <PremiumThemeContext.Provider value={{ isPremium }}>
      {children}
    </PremiumThemeContext.Provider>
  );
}

export function usePremiumTheme() {
  const context = useContext(PremiumThemeContext);
  if (!context) {
    throw new Error('usePremiumTheme must be used within PremiumThemeProvider');
  }
  return context;
}
