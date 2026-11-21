import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function toURLSearchParams(searchParams: SearchParams | undefined) {
  const params = new URLSearchParams();
  if (!searchParams) return params;

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    }
  }

  return params;
}

export default async function AdminCategoriesRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
} = {}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const params = toURLSearchParams(resolvedSearchParams);
  params.set("tab", "categories");
  redirect(`/admin/taxonomy?${params.toString()}`);
}
