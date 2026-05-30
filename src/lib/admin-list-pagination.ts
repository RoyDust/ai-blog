export type AdminListPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function parseAdminListPagination(
  input: { page?: string | null; limit?: string | null },
  options: { defaultLimit?: number; maxLimit?: number } = {},
) {
  const defaultLimit = options.defaultLimit ?? 10;
  const maxLimit = options.maxLimit ?? 100;
  const page = Math.max(1, Number.parseInt(input.page ?? "1", 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(input.limit ?? String(defaultLimit), 10) || defaultLimit));

  return { page, limit };
}

export function buildAdminListPagination({
  limit,
  page,
  total,
}: {
  page: number;
  limit: number;
  total: number;
}): AdminListPagination {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const activePage = Math.min(page, totalPages);

  return {
    page: activePage,
    limit,
    total,
    totalPages,
  };
}

export function getAdminListSkip(pagination: Pick<AdminListPagination, "page" | "limit">) {
  return (pagination.page - 1) * pagination.limit;
}
