import type {
  ActionItem,
  ActionItemInput,
  ActionItemWithMeeting,
  AppInfo,
  AskResponse,
  Comment,
  MeetingCreateInput,
  MeetingDetail,
  MeetingFilters,
  MeetingPage,
  MeetingUpdateInput,
  Participant,
  SearchResponse,
  Segment,
  Soundbite,
  Tag,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`/api${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, errorMessage(body, `Request failed (${response.status})`));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function meetingsQuery(filters: MeetingFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  filters.participantIds?.forEach((id) => params.append("participant_id", String(id)));
  filters.tagIds?.forEach((id) => params.append("tag_id", String(id)));
  filters.sources?.forEach((source) => params.append("source", source));
  if (filters.dateFrom) params.set("date_from", `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) params.set("date_to", `${filters.dateTo}T23:59:59`);
  if (filters.sort && filters.sort !== "recent") params.set("sort", filters.sort);
  const query = params.toString();
  return `/meetings${query ? `?${query}` : ""}`;
}

const json = (data: unknown) => JSON.stringify(data);

export const api = {
  get: <T>(path: string) => request<T>(path),

  me: () => request<AppInfo>("/me"),
  listMeetings: (filters?: MeetingFilters) => request<MeetingPage>(meetingsQuery(filters)),
  getMeeting: (id: number) => request<MeetingDetail>(`/meetings/${id}`),
  getTranscript: (id: number) => request<Segment[]>(`/meetings/${id}/transcript`),
  createMeeting: (data: MeetingCreateInput) => request<MeetingDetail>("/meetings", { method: "POST", body: json(data) }),
  uploadMeeting: (form: FormData) => request<MeetingDetail>("/meetings/upload", { method: "POST", body: form }),
  updateMeeting: (id: number, data: MeetingUpdateInput) =>
    request<MeetingDetail>(`/meetings/${id}`, { method: "PATCH", body: json(data) }),
  deleteMeeting: (id: number) => request<void>(`/meetings/${id}`, { method: "DELETE" }),
  regenerateNotes: (id: number) => request<MeetingDetail>(`/meetings/${id}/regenerate`, { method: "POST" }),
  ask: (id: number, question: string) =>
    request<AskResponse>(`/meetings/${id}/ask`, { method: "POST", body: json({ question }) }),
  exportUrl: (id: number, format: "md" | "txt") => `/api/meetings/${id}/export?format=${format}`,

  listActionItems: (completed?: boolean) =>
    request<ActionItemWithMeeting[]>(`/action-items${completed === undefined ? "" : `?completed=${completed}`}`),
  createActionItem: (meetingId: number, data: ActionItemInput & { text: string }) =>
    request<ActionItem>(`/meetings/${meetingId}/action-items`, { method: "POST", body: json(data) }),
  updateActionItem: (id: number, data: ActionItemInput) =>
    request<ActionItem>(`/action-items/${id}`, { method: "PATCH", body: json(data) }),
  deleteActionItem: (id: number) => request<void>(`/action-items/${id}`, { method: "DELETE" }),

  listComments: (meetingId: number) => request<Comment[]>(`/meetings/${meetingId}/comments`),
  createComment: (segmentId: number, body: string) =>
    request<Comment>(`/segments/${segmentId}/comments`, { method: "POST", body: json({ body }) }),
  deleteComment: (id: number) => request<void>(`/comments/${id}`, { method: "DELETE" }),

  createSoundbite: (meetingId: number, data: { title: string; start_seconds: number; end_seconds: number }) =>
    request<Soundbite>(`/meetings/${meetingId}/soundbites`, { method: "POST", body: json(data) }),
  deleteSoundbite: (id: number) => request<void>(`/soundbites/${id}`, { method: "DELETE" }),

  listParticipants: () => request<Participant[]>("/participants"),
  listTags: () => request<Tag[]>("/tags"),
  createTag: (name: string) => request<Tag>("/tags", { method: "POST", body: json({ name }) }),
  search: (q: string) => request<SearchResponse>(`/search?q=${encodeURIComponent(q)}`),
};
