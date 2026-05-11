export const ADMIN_SEARCH_MIN_QUERY_LENGTH = 2;
export const ADMIN_SEARCH_MAX_QUERY_LENGTH = 80;

export type AdminSearchRemoteGroup = "posts" | "comments";

export type AdminSearchResult = {
  id: string;
  type: AdminSearchRemoteGroup;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
};

export type AdminSearchRemoteResults = Record<AdminSearchRemoteGroup, AdminSearchResult[]>;

export type AdminSearchResponse = {
  success: true;
  data: {
    query: string;
    results: AdminSearchRemoteResults;
  };
};

export const EMPTY_ADMIN_SEARCH_REMOTE_RESULTS: AdminSearchRemoteResults = {
  posts: [],
  comments: [],
};

export function normalizeAdminSearchQuery(value: unknown) {
  if (typeof value !== "string") return "";

  return value.trim().replace(/\s+/g, " ").slice(0, ADMIN_SEARCH_MAX_QUERY_LENGTH);
}
