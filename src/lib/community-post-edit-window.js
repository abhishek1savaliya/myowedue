/** Authors may edit post body only within this many ms after `created_at` (server-enforced). */
export const COMMUNITY_POST_EDIT_WINDOW_MS = 5 * 60 * 1000;

/**
 * @param {string | Date} createdAtIso
 * @param {number} [nowMs]
 */
export function isCommunityPostEditWindowOpen(createdAtIso, nowMs = Date.now()) {
  const t = new Date(createdAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t <= COMMUNITY_POST_EDIT_WINDOW_MS;
}
