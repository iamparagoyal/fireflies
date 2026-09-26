import type { MeetingFilters, SortOrder } from "./types";

const SORTS: SortOrder[] = ["recent", "oldest", "longest", "shortest", "title"];

export function filtersFromParams(params: URLSearchParams): MeetingFilters {
  const ids = (key: string) => params.getAll(key).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const sort = params.get("sort") as SortOrder | null;
  return {
    q: params.get("q") ?? "",
    participantIds: ids("participant"),
    tagIds: ids("tag"),
    dateFrom: params.get("from") ?? undefined,
    dateTo: params.get("to") ?? undefined,
    sort: sort && SORTS.includes(sort) ? sort : "recent",
  };
}

export function filtersToParams(filters: MeetingFilters): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  filters.participantIds?.forEach((id) => params.append("participant", String(id)));
  filters.tagIds?.forEach((id) => params.append("tag", String(id)));
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  if (filters.sort && filters.sort !== "recent") params.set("sort", filters.sort);
  return params.toString();
}
