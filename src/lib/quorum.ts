import type { Group, GroupMemberWithProfile } from './types';

export interface QuorumCalculation {
  activeCount: number;
  totalMembers: number;
  requiredVotes: number;
  mode: 'unanimity' | 'majority';
  activeWindowDays: number;
  ratio: number;
}

export function getActiveMembers(
  members: GroupMemberWithProfile[],
  activeWindowDays: number
): GroupMemberWithProfile[] {
  const windowMs = activeWindowDays * 24 * 60 * 60 * 1000;
  const cutoffMs = Date.now() - windowMs;

  return members.filter((member) => {
    const lastActive = member.profiles?.last_active_at;
    if (!lastActive) return false;
    const parsed = Date.parse(lastActive);
    return !Number.isNaN(parsed) && parsed >= cutoffMs;
  });
}

export function calculateQuorum(
  group: Group,
  members: GroupMemberWithProfile[]
): QuorumCalculation {
  const activeMembers = getActiveMembers(members, group.active_window_days);
  const activeCount = Math.max(1, activeMembers.length);
  const ratio = Number(group.quorum_majority_ratio);

  if (activeCount <= group.quorum_unanimity_max) {
    return {
      activeCount,
      totalMembers: members.length,
      requiredVotes: activeCount,
      mode: 'unanimity',
      activeWindowDays: group.active_window_days,
      ratio,
    };
  }

  return {
    activeCount,
    totalMembers: members.length,
    requiredVotes: Math.max(1, Math.ceil(activeCount * ratio)),
    mode: 'majority',
    activeWindowDays: group.active_window_days,
    ratio,
  };
}
