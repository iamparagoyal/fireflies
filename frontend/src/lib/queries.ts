"use client";

import useSWR, { mutate as globalMutate } from "swr";

import { api, meetingsQuery } from "./api";
import type {
  ActionItemWithMeeting,
  AppInfo,
  Comment,
  MeetingDetail,
  MeetingFilters,
  MeetingPage,
  Participant,
  SearchResponse,
  Segment,
  Tag,
} from "./types";

export const keys = {
  me: "/me",
  meetings: (filters?: MeetingFilters) => meetingsQuery(filters),
  meeting: (id: number) => `/meetings/${id}`,
  transcript: (id: number) => `/meetings/${id}/transcript`,
  comments: (id: number) => `/meetings/${id}/comments`,
  actionItems: "/action-items",
  participants: "/participants",
  tags: "/tags",
  search: (q: string) => `/search?q=${encodeURIComponent(q)}`,
};

export const useMe = () => useSWR<AppInfo>(keys.me);
export const useMeetings = (filters: MeetingFilters) => useSWR<MeetingPage>(keys.meetings(filters), { keepPreviousData: true });
export const useMeeting = (id: number) => useSWR<MeetingDetail>(Number.isFinite(id) ? keys.meeting(id) : null);
export const useTranscript = (id: number) => useSWR<Segment[]>(Number.isFinite(id) ? keys.transcript(id) : null);
export const useComments = (id: number) => useSWR<Comment[]>(keys.comments(id));
export const useActionItems = () => useSWR<ActionItemWithMeeting[]>(keys.actionItems);
export const useParticipants = () => useSWR<Participant[]>(keys.participants);
export const useTags = () => useSWR<Tag[]>(keys.tags);
export const useSearch = (q: string) => useSWR<SearchResponse>(q.trim() ? keys.search(q.trim()) : null, { keepPreviousData: true });

export const swrFetcher = (path: string) => api.get(path);

export function refreshMeetingLists() {
  return globalMutate((key) => typeof key === "string" && (key.startsWith("/meetings?") || key === "/meetings" || key.startsWith("/search") || key === keys.actionItems || key === keys.participants));
}
