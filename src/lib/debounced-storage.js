/**
 * sessionStorage adapter that debounces writes to avoid main-thread jank during navigation.
 * @param {number} delayMs
 */
export function createDebouncedSessionStorage(delayMs = 500) {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }

  const timers = new Map();

  return {
    getItem(name) {
      return sessionStorage.getItem(name);
    },
    setItem(name, value) {
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.set(
        name,
        setTimeout(() => {
          timers.delete(name);
          try {
            sessionStorage.setItem(name, value);
          } catch {
            /* quota exceeded — ignore */
          }
        }, delayMs)
      );
    },
    removeItem(name) {
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.delete(name);
      sessionStorage.removeItem(name);
    },
  };
}
