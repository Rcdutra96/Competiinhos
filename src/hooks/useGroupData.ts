import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Group,
  GroupMemberWithProfile,
  GroupRankingRow,
  Profile,
  Task,
  TaskChangeRequest,
  TaskChangeRequestWithVotes,
  TaskChangeVote,
  TaskCompletion,
} from '../lib/types';
import { getTodayLocalDate, isDateInCurrentWeek } from '../lib/utils';

interface UseGroupDataResult {
  group: Group | null;
  members: GroupMemberWithProfile[];
  membersById: Record<string, Profile>;
  ranking: GroupRankingRow[];
  tasks: Task[];
  userCompletions: TaskCompletion[];
  completedTodayTaskIds: Set<string>;
  completedThisWeekTaskIds: Set<string>;
  completedOnceTaskIds: Set<string>;
  requests: TaskChangeRequestWithVotes[];
  pendingRequestCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useGroupData(
  groupId: string | undefined,
  userId: string | undefined
): UseGroupDataResult {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
  const [ranking, setRanking] = useState<GroupRankingRow[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userCompletions, setUserCompletions] = useState<TaskCompletion[]>([]);
  const [requests, setRequests] = useState<TaskChangeRequestWithVotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<number | null>(null);

  const fetchAll = useCallback(
    async (silent = false) => {
      if (!groupId || !userId) return;
      if (!silent) setLoading(true);
      setError(null);

      try {
        const [
          groupRes,
          membersRes,
          rankingRes,
          tasksRes,
          completionsRes,
          requestsRes,
        ] = await Promise.all([
          supabase.from('groups').select('*').eq('id', groupId).single(),
          supabase
            .from('group_members')
            .select(
              'group_id, user_id, role, prize_accepted_at, joined_at, profiles(id, display_name, avatar_url, last_active_at)'
            )
            .eq('group_id', groupId),
          supabase
            .from('group_ranking')
            .select('*')
            .eq('group_id', groupId)
            .order('total_points', { ascending: false })
            .order('completed_count', { ascending: false }),
          supabase
            .from('tasks')
            .select('*')
            .eq('group_id', groupId)
            .eq('status', 'active')
            .order('created_at', { ascending: true }),
          supabase
            .from('task_completions')
            .select('*')
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .order('completed_at', { ascending: false }),
          supabase
            .from('task_change_requests')
            .select('*')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false }),
        ]);

        if (groupRes.error) throw groupRes.error;
        if (membersRes.error) throw membersRes.error;
        if (rankingRes.error) throw rankingRes.error;
        if (tasksRes.error) throw tasksRes.error;
        if (completionsRes.error) throw completionsRes.error;
        if (requestsRes.error) throw requestsRes.error;

        const normalizedMembers: GroupMemberWithProfile[] = (
          membersRes.data ?? []
        ).map((row) => {
          const rawProfile = row.profiles as unknown;
          const profileObj = Array.isArray(rawProfile)
            ? ((rawProfile[0] as Profile | undefined) ?? null)
            : ((rawProfile as Profile | null) ?? null);
          return {
            group_id: row.group_id,
            user_id: row.user_id,
            role: row.role,
            prize_accepted_at: row.prize_accepted_at,
            joined_at: row.joined_at,
            profiles: profileObj,
          };
        });

        const rawRequests = (requestsRes.data ?? []) as TaskChangeRequest[];
        const requestIds = rawRequests.map((r) => r.id);

        let votesByRequest: Record<string, TaskChangeVote[]> = {};
        if (requestIds.length > 0) {
          const votesRes = await supabase
            .from('task_change_votes')
            .select('*')
            .in('request_id', requestIds)
            .order('created_at', { ascending: true });

          if (votesRes.error) throw votesRes.error;

          votesByRequest = (votesRes.data as TaskChangeVote[]).reduce<
            Record<string, TaskChangeVote[]>
          >((acc, vote) => {
            if (!acc[vote.request_id]) acc[vote.request_id] = [];
            acc[vote.request_id].push(vote);
            return acc;
          }, {});
        }

        const mergedRequests: TaskChangeRequestWithVotes[] = rawRequests.map(
          (req) => ({
            ...req,
            votes: votesByRequest[req.id] ?? [],
          })
        );

        setGroup(groupRes.data as Group);
        setMembers(normalizedMembers);
        setRanking((rankingRes.data ?? []) as GroupRankingRow[]);
        setTasks((tasksRes.data ?? []) as Task[]);
        setUserCompletions((completionsRes.data ?? []) as TaskCompletion[]);
        setRequests(mergedRequests);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Erro ao carregar dados do grupo.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [groupId, userId]
  );

  useEffect(() => {
    void fetchAll(false);
  }, [fetchAll]);

  useEffect(() => {
    if (!groupId || !userId) return;

    const scheduleRefresh = () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        void fetchAll(true);
      }, 150);
    };

    const channel = supabase
      .channel(`group-dashboard-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_completions',
          filter: `group_id=eq.${groupId}`,
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_change_requests',
          filter: `group_id=eq.${groupId}`,
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_change_votes',
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `group_id=eq.${groupId}`,
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'groups',
          filter: `id=eq.${groupId}`,
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [fetchAll, groupId, userId]);

  const membersById = useMemo(() => {
    return members.reduce<Record<string, Profile>>((acc, member) => {
      if (member.profiles) {
        acc[member.user_id] = member.profiles;
      }
      return acc;
    }, {});
  }, [members]);

  const today = getTodayLocalDate();

  const validCompletions = useMemo(
    () => userCompletions.filter((c) => c.validation_status !== 'rejected'),
    [userCompletions]
  );

  const completedTodayTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const completion of validCompletions) {
      if (completion.completion_date === today) {
        ids.add(completion.task_id);
      }
    }
    return ids;
  }, [today, validCompletions]);

  const completedThisWeekTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const completion of validCompletions) {
      if (isDateInCurrentWeek(completion.completion_date)) {
        ids.add(completion.task_id);
      }
    }
    return ids;
  }, [validCompletions]);

  const completedOnceTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const completion of validCompletions) {
      ids.add(completion.task_id);
    }
    return ids;
  }, [validCompletions]);

  const pendingRequestCount = useMemo(
    () => requests.filter((req) => req.status === 'pending').length,
    [requests]
  );

  const refresh = useCallback(async () => {
    await fetchAll(true);
  }, [fetchAll]);

  return {
    group,
    members,
    membersById,
    ranking,
    tasks,
    userCompletions,
    completedTodayTaskIds,
    completedThisWeekTaskIds,
    completedOnceTaskIds,
    requests,
    pendingRequestCount,
    loading,
    error,
    refresh,
  };
}
