/** Fired after post / like / share / comment so sidebars can debounce-refetch (e.g. trending). */
export const COMMUNITY_MUTATE_EVENT = "community:mutate";

export function dispatchCommunityMutate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COMMUNITY_MUTATE_EVENT));
  }
}
