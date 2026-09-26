export type Platform = "zoom" | "google_meet" | "teams" | "upload";
export type MeetingSource = "seed" | "upload" | "paste" | "form";
export type SortOrder = "recent" | "oldest" | "longest" | "shortest" | "title";
export type TranscriptFormat = "auto" | "txt" | "vtt" | "srt" | "json";

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
}

export interface AppInfo {
  user: User;
  llm_enabled: boolean;
  llm_model: string | null;
}

export interface Participant {
  id: number;
  name: string;
  email: string | null;
}

export interface MeetingParticipant extends Participant {
  is_host: boolean;
  talk_time_seconds: number;
}

export interface ParticipantInput {
  name: string;
  email?: string | null;
  is_host?: boolean;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Segment {
  id: number;
  position: number;
  start_seconds: number;
  end_seconds: number;
  text: string;
  speaker_id: number | null;
  speaker_name: string | null;
  comment_count: number;
}

export interface Summary {
  overview: string;
  bullet_points: string[];
  keywords: string[];
  generated_by: string;
  generated_at: string;
}

export interface Chapter {
  id: number;
  position: number;
  title: string;
  start_seconds: number;
  end_seconds: number;
  summary: string;
}

export interface ActionItem {
  id: number;
  meeting_id: number;
  text: string;
  assignee: Participant | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  is_ai_generated: boolean;
  source_segment_id: number | null;
  timestamp_seconds: number | null;
  position: number;
  created_at: string;
}

export interface ActionItemWithMeeting extends ActionItem {
  meeting_title: string;
}

export interface Soundbite {
  id: number;
  title: string;
  start_seconds: number;
  end_seconds: number;
  created_at: string;
}

export interface Comment {
  id: number;
  segment_id: number;
  body: string;
  author: User;
  created_at: string;
}

export interface MeetingListItem {
  id: number;
  title: string;
  started_at: string;
  duration_seconds: number;
  platform: Platform;
  source: MeetingSource;
  participants: Participant[];
  tags: Tag[];
  overview: string | null;
  action_item_count: number;
  open_action_item_count: number;
}

export interface MeetingPage {
  items: MeetingListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface MeetingDetail {
  id: number;
  title: string;
  started_at: string;
  duration_seconds: number;
  platform: Platform;
  source: MeetingSource;
  media_url: string | null;
  owner: User;
  participants: MeetingParticipant[];
  tags: Tag[];
  summary: Summary | null;
  chapters: Chapter[];
  action_items: ActionItem[];
  soundbites: Soundbite[];
  segment_count: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingCreateInput {
  title: string;
  started_at?: string | null;
  platform?: Platform;
  participants?: ParticipantInput[];
  tag_ids?: number[];
  transcript?: string | null;
  transcript_format?: TranscriptFormat;
  duration_seconds?: number | null;
}

export interface MeetingUpdateInput {
  title?: string;
  started_at?: string;
  platform?: Platform;
  participants?: ParticipantInput[];
  tag_ids?: number[];
}

export interface MeetingFilters {
  q?: string;
  participantIds?: number[];
  tagIds?: number[];
  dateFrom?: string;
  dateTo?: string;
  sort?: SortOrder;
  sources?: MeetingSource[];
}

export interface ActionItemInput {
  text?: string;
  assignee_id?: number | null;
  due_date?: string | null;
  is_completed?: boolean;
  source_segment_id?: number | null;
}

export interface SearchHit {
  meeting_id: number;
  meeting_title: string;
  meeting_started_at: string;
  segment_id: number;
  start_seconds: number;
  speaker_name: string | null;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  meetings: MeetingListItem[];
  hits: SearchHit[];
}

export interface Citation {
  segment_id: number;
  start_seconds: number;
  speaker_name: string | null;
  text: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  generated_by: string;
}
