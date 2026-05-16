import { formatDistanceToNow } from "date-fns";

/** Authors may edit post body only within this many ms after `created_at` (server-enforced). */
export const COMMUNITY_POST_EDIT_WINDOW_MS = 5 * 60 * 1000;

/** Supabase select fragment for post cards in feeds and profiles. */
export const COMMUNITY_POST_LIST_SELECT =
  "id, author_id, author_name, body, share_count, created_at, updated_at";

/**
 * @param {string | Date} createdAtIso
 * @param {number} [nowMs]
 */
export function isCommunityPostEditWindowOpen(createdAtIso, nowMs = Date.now()) {
  const t = new Date(createdAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t <= COMMUNITY_POST_EDIT_WINDOW_MS;
}

/**
 * @param {string | Date | null | undefined} createdAtIso
 * @param {string | Date | null | undefined} updatedAtIso
 */
export function wasCommunityPostEdited(createdAtIso, updatedAtIso) {
  if (!updatedAtIso) return false;
  const created = new Date(createdAtIso).getTime();
  const updated = new Date(updatedAtIso).getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created > 2000;
}

/**
 * @param {string | Date} updatedAtIso
 */
export function formatCommunityPostEditedLabel(updatedAtIso) {
  const updatedMs = new Date(updatedAtIso).getTime();
  if (Number.isNaN(updatedMs)) return "Edited";
  const elapsedMs = Math.max(0, Date.now() - updatedMs);
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "Edited just now";
  if (minutes === 1) return "Edited 1 minute ago";
  if (minutes < 60) return `Edited ${minutes} minutes ago`;
  return `Edited ${formatDistanceToNow(new Date(updatedAtIso), { addSuffix: true })}`;
}
