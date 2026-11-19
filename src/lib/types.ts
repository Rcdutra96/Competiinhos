export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  last_active_at: string;
  created_at?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  prize_text: string;
  invite_code: string;
  active_window_days: number;
  quorum_unanimity_max: number;
  quorum_majority_ratio: number;
  exif_tolerance_minutes: number;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: string;
  prize_accepted_at: string | null;
  joined_at: string;
}

export interface GroupMemberWithProfile extends GroupMember {
  profiles: Profile | null;
}

export interface GroupMembershipWithGroup extends GroupMember {
  groups: Group | null;
}

export type TaskRecurrence = 'daily' | 'weekly' | 'once';

export interface Task {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  points: number;
  recurrence: TaskRecurrence;
  assigned_to: string | null;
  created_by: string;
  status: string;
  created_at: string;
}

export type ChangeRequestType = 'create' | 'edit' | 'delete' | 'prize_update';

export type ChangeRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'counter_proposed';

export interface TaskProposedData {
  title?: string;
  description?: string | null;
  points?: number;
  recurrence?: TaskRecurrence;
  assigned_to?: string | null;
}

export interface PrizeProposedData {
  prize_text?: string;
}

export interface TaskChangeRequest {
  id: string;
  group_id: string;
  task_id: string | null;
  request_type: ChangeRequestType;
  proposed_data: Record<string, unknown>;
  requested_by: string;
  status: ChangeRequestStatus;
  created_at: string;
  resolved_at: string | null;
}

export type VoteType = 'approve' | 'reject' | 'reject_with_suggestion';

export interface TaskChangeVote {
  id: string;
  request_id: string;
  user_id: string;
  vote: VoteType;
  suggestion_note: string | null;
  suggested_data: Record<string, unknown> | null;
  created_at: string;
}

export interface TaskChangeRequestWithVotes extends TaskChangeRequest {
  votes: TaskChangeVote[];
}

export type EvidenceType = 'photo' | 'audio';
export type ValidationStatus = 'valid' | 'pending_review' | 'rejected' | string;

export interface TaskCompletion {
  id: string;
  group_id: string;
  task_id: string;
  user_id: string;
  completion_date: string;
  completed_at: string;
  evidence_type: EvidenceType | string;
  evidence_url: string;
  exif_timestamp: string | null;
  validation_status: ValidationStatus;
  points_awarded: number;
}

export interface TaskCompletionWithDetails extends TaskCompletion {
  profiles: Pick<Profile, 'display_name' | 'avatar_url'> | null;
  tasks: Pick<Task, 'title' | 'points'> | null;
}

export interface GroupRankingRow {
  group_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  completed_count: number;
  last_completion_at: string | null;
}
