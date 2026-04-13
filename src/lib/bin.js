const THREE_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 3;

export function buildBinMeta() {
  const deletedAt = new Date();
  const restoreUntil = new Date(deletedAt.getTime() + THREE_YEARS_MS);
  return { deletedAt, restoreUntil };
}

export function activeQuery() {
  return {
    $or: [
      { isDeleted: false },
      { isDeleted: { $exists: false } },
      { isDeleted: null },
    ],
  };
}
