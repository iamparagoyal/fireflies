import type { ActionItem, MeetingDetail, MeetingListItem, Segment } from "@/lib/types";

export const segments: Segment[] = [
  { id: 1, position: 0, start_seconds: 0, end_seconds: 8, text: "Welcome everyone, let's review the pricing page.", speaker_id: 1, speaker_name: "Dana Lee", comment_count: 0 },
  { id: 2, position: 1, start_seconds: 8, end_seconds: 16, text: "The pricing page needs an enterprise tier and pricing for SSO.", speaker_id: 2, speaker_name: "Sam Ortiz", comment_count: 1 },
  { id: 3, position: 2, start_seconds: 16, end_seconds: 30, text: "I'll draft the launch email tomorrow.", speaker_id: 1, speaker_name: "Dana Lee", comment_count: 0 },
];

export const actionItem = (overrides: Partial<ActionItem> = {}): ActionItem => ({
  id: 10,
  meeting_id: 1,
  text: "Draft the launch email",
  assignee: { id: 1, name: "Dana Lee", email: "dana@example.com" },
  due_date: null,
  is_completed: false,
  completed_at: null,
  is_ai_generated: true,
  source_segment_id: 3,
  timestamp_seconds: 16,
  position: 0,
  created_at: "2026-09-20T10:00:00",
  ...overrides,
});

export const meetingDetail = (overrides: Partial<MeetingDetail> = {}): MeetingDetail => ({
  id: 1,
  title: "Pricing sync",
  started_at: "2026-09-20T10:00:00",
  duration_seconds: 30,
  platform: "zoom",
  source: "seed",
  media_url: null,
  owner: { id: 1, name: "Alex Morgan", email: "alex@example.com", avatar_color: "#7C5CFC" },
  participants: [
    { id: 1, name: "Dana Lee", email: "dana@example.com", is_host: true, talk_time_seconds: 22 },
    { id: 2, name: "Sam Ortiz", email: null, is_host: false, talk_time_seconds: 8 },
  ],
  tags: [{ id: 1, name: "Product", color: "#7C5CFC" }],
  summary: {
    overview: "The team reviewed the pricing page.",
    bullet_points: ["💡 Enterprise tier needs SSO"],
    keywords: ["Pricing Page", "SSO"],
    generated_by: "seed",
    generated_at: "2026-09-20T10:30:00",
  },
  chapters: [
    { id: 1, position: 0, title: "Pricing page", start_seconds: 0, end_seconds: 16, summary: "Pricing review." },
    { id: 2, position: 1, title: "Launch email", start_seconds: 16, end_seconds: 30, summary: "Launch plan." },
  ],
  action_items: [actionItem()],
  soundbites: [],
  segment_count: segments.length,
  created_at: "2026-09-20T10:00:00",
  updated_at: "2026-09-20T10:00:00",
  ...overrides,
});

export const listItem = (overrides: Partial<MeetingListItem> = {}): MeetingListItem => ({
  id: 1,
  title: "Pricing sync",
  started_at: "2026-09-20T10:00:00",
  duration_seconds: 1800,
  platform: "zoom",
  source: "seed",
  participants: [{ id: 1, name: "Dana Lee", email: null }],
  tags: [],
  overview: null,
  action_item_count: 1,
  open_action_item_count: 1,
  ...overrides,
});
