/** Fired after post / like / share / comment so sidebars can debounce-refetch (e.g. trending). */
export const COMMUNITY_MUTATE_EVENT = "community:mutate";

/**
 * @param {{ reason?: "like" | "comment" | "share" | "post" | "follow" | "settings" | string }} [detail]
 */
export function dispatchCommunityMutate(detail = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COMMUNITY_MUTATE_EVENT, { detail: detail || {} }));
  }
}

/** Reasons that should not force-refetch trending / suggested creators. */
export function isCommunityEngagementMutate(detail) {
  const reason = detail && typeof detail === "object" ? detail.reason : "";
  return reason === "like" || reason === "comment_like" || reason === "share";
}
