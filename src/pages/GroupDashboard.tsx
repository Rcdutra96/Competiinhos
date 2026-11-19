import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckSquare,
  ListTodo,
  Loader2,
  Lock,
  Trophy,
  Vote,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGroupData } from '../hooks/useGroupData';
import type { Task, TaskChangeRequestWithVotes } from '../lib/types';
import { isEvaluationPeriodEnded } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { CompletionModal } from '../components/CompletionModal';
import { EvaluationPeriodModal } from '../components/EvaluationPeriodModal';
import { PrizeProposalModal } from '../components/PrizeProposalModal';
import { TaskProposalModal } from '../components/TaskProposalModal';
import { AllTasksTab } from '../components/tabs/AllTasksTab';
import { MyTasksTab } from '../components/tabs/MyTasksTab';
import { RankingTab } from '../components/tabs/RankingTab';
import { VotesTab } from '../components/tabs/VotesTab';

type DashboardTab = 'ranking' | 'my' | 'all' | 'votes';

function getCompletionStorageKey(groupId: string | undefined): string | null {
  return groupId ? `competiinhos_open_completion_${groupId}` : null;
}

export function GroupDashboard() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();

  const {
    group,
    members,
    membersById,
    ranking,
    tasks,
    completedTodayTaskIds,
    completedThisWeekTaskIds,
    completedOnceTaskIds,
    requests,
    votesBadgeCount,
    loading,
    error,
    refresh,
  } = useGroupData(groupId, user?.id);

  const [activeTab, setActiveTab] = useState<DashboardTab>('my');
  const [completionTaskId, setCompletionTaskId] = useState<string | null>(() => {
    const key = getCompletionStorageKey(groupId);
    if (!key) return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  });

  const [taskModalState, setTaskModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    task: Task | null;
    resubmitRequest: TaskChangeRequestWithVotes | null;
  }>({ open: false, mode: 'create', task: null, resubmitRequest: null });

  const [prizeModalState, setPrizeModalState] = useState<{
    open: boolean;
    resubmitRequest: TaskChangeRequestWithVotes | null;
  }>({ open: false, resubmitRequest: null });

  const [evalPeriodModalState, setEvalPeriodModalState] = useState<{
    open: boolean;
    resubmitRequest: TaskChangeRequestWithVotes | null;
  }>({ open: false, resubmitRequest: null });

  const evaluationEnded = isEvaluationPeriodEnded(group?.evaluation_end_at);

  const setPersistedCompletionTaskId = useCallback(
    (nextTaskId: string | null) => {
      setCompletionTaskId(nextTaskId);
      const key = getCompletionStorageKey(groupId);
      if (!key) return;
      try {
        if (nextTaskId) {
          window.sessionStorage.setItem(key, nextTaskId);
        } else {
          window.sessionStorage.removeItem(key);
        }
      } catch {
        // Ignora indisponibilidade de sessionStorage
      }
    },
    [groupId]
  );

  // Sincroniza sessionStorage se mudar de grupo
  useEffect(() => {
    const key = getCompletionStorageKey(groupId);
    if (!key) {
      setCompletionTaskId(null);
      return;
    }
    try {
      setCompletionTaskId(window.sessionStorage.getItem(key));
    } catch {
      setCompletionTaskId(null);
    }
  }, [groupId]);

  useEffect(() => {
    if (evaluationEnded && completionTaskId) {
      setPersistedCompletionTaskId(null);
    }
  }, [completionTaskId, evaluationEnded, setPersistedCompletionTaskId]);

  const completionTask = useMemo(() => {
    if (evaluationEnded || !completionTaskId) return null;
    return tasks.find((t) => t.id === completionTaskId) ?? null;
  }, [completionTaskId, evaluationEnded, tasks]);

  const handleSelectTaskForCompletion = (task: Task) => {
    if (evaluationEnded) return;
    setPersistedCompletionTaskId(task.id);
  };

  const handleResubmitRequest = (request: TaskChangeRequestWithVotes) => {
    if (request.request_type === 'prize_update') {
      setPrizeModalState({ open: true, resubmitRequest: request });
      return;
    }
    if (request.request_type === 'evaluation_period_update') {
      setEvalPeriodModalState({ open: true, resubmitRequest: request });
      return;
    }

    const linkedTask = request.task_id
      ? tasks.find((t) => t.id === request.task_id) ?? null
      : null;

    setTaskModalState({
      open: true,
      mode: request.request_type === 'create' ? 'create' : 'edit',
      task: linkedTask,
      resubmitRequest: request,
    });
  };

  if (loading && !group) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="text-sm">Carregando grupo...</span>
        </div>
      </div>
    );
  }

  if (error || !group || !user) {
    return (
      <div className="pt-safe-header pb-safe flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-sm font-semibold text-rose-300">
            {error || 'Não foi possível carregar este grupo.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-zinc-700 bg-zinc-800 px-4 text-xs font-semibold text-zinc-100"
            >
              Voltar ao início
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-500 px-4 text-xs font-bold text-zinc-950"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-950">
      <header className="pt-safe-header sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 px-4 pb-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            to="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
            aria-label="Voltar aos grupos"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <Avatar src={group.avatar_url} name={group.name} size="md" />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-zinc-100">
              {group.name}
            </h1>
            <p className="text-xs text-zinc-400">
              {members.length}{' '}
              {members.length === 1 ? 'participante' : 'participantes'}
            </p>
          </div>
        </div>
      </header>

      <main className="pb-content-nav mx-auto max-w-lg space-y-4 px-4 pt-4">
        {evaluationEnded && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-xs font-semibold text-rose-200">
            <Lock className="h-4 w-4 shrink-0 text-rose-400" />
            <span>Período de avaliação encerrado — Check-ins fechados</span>
          </div>
        )}

        {activeTab === 'ranking' && (
          <RankingTab
            group={group}
            ranking={ranking}
            onSuggestPrize={() =>
              setPrizeModalState({ open: true, resubmitRequest: null })
            }
            onProposeEvaluationPeriod={() =>
              setEvalPeriodModalState({ open: true, resubmitRequest: null })
            }
          />
        )}

        {activeTab === 'my' && (
          <MyTasksTab
            tasks={tasks}
            currentUserId={user.id}
            completedTodayTaskIds={completedTodayTaskIds}
            completedThisWeekTaskIds={completedThisWeekTaskIds}
            completedOnceTaskIds={completedOnceTaskIds}
            evaluationEnded={evaluationEnded}
            onSelectTask={handleSelectTaskForCompletion}
          />
        )}

        {activeTab === 'all' && (
          <AllTasksTab
            groupId={group.id}
            currentUserId={user.id}
            tasks={tasks}
            membersById={membersById}
            onCreateTask={() =>
              setTaskModalState({
                open: true,
                mode: 'create',
                task: null,
                resubmitRequest: null,
              })
            }
            onEditTask={(task) =>
              setTaskModalState({
                open: true,
                mode: 'edit',
                task,
                resubmitRequest: null,
              })
            }
            onRequestSubmitted={() => void refresh()}
          />
        )}

        {activeTab === 'votes' && (
          <VotesTab
            group={group}
            currentUserId={user.id}
            members={members}
            membersById={membersById}
            tasks={tasks}
            requests={requests}
            onVoted={() => void refresh()}
            onResubmitRequest={handleResubmitRequest}
          />
        )}
      </main>

      <nav
        aria-label="Navegação do grupo"
        className="pb-safe-nav fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/90 bg-zinc-950/95 px-2 pt-1.5 backdrop-blur-md"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('ranking')}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition-colors ${
              activeTab === 'ranking'
                ? 'bg-zinc-900 text-amber-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Trophy className="h-5 w-5" />
            <span>Ranking</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition-colors ${
              activeTab === 'my'
                ? 'bg-zinc-900 text-emerald-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CheckSquare className="h-5 w-5" />
            <span>Minhas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-zinc-900 text-emerald-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ListTodo className="h-5 w-5" />
            <span>Todas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('votes')}
            className={`relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition-colors ${
              activeTab === 'votes'
                ? 'bg-zinc-900 text-amber-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="relative">
              <Vote className="h-5 w-5" />
              {votesBadgeCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-extrabold text-zinc-950">
                  {votesBadgeCount > 99 ? '99+' : votesBadgeCount}
                </span>
              )}
            </div>
            <span>Votações</span>
          </button>
        </div>
      </nav>

      <CompletionModal
        open={completionTask !== null}
        group={group}
        task={completionTask}
        onClose={() => setPersistedCompletionTaskId(null)}
        onCompleted={() => {
          setPersistedCompletionTaskId(null);
          void refresh();
        }}
      />

      <TaskProposalModal
        open={taskModalState.open}
        mode={taskModalState.mode}
        groupId={group.id}
        members={members}
        membersById={membersById}
        task={taskModalState.task}
        resubmitRequest={taskModalState.resubmitRequest}
        onClose={() =>
          setTaskModalState((prev) => ({
            ...prev,
            open: false,
            task: null,
            resubmitRequest: null,
          }))
        }
        onSubmitted={() => void refresh()}
      />

      <PrizeProposalModal
        open={prizeModalState.open}
        groupId={group.id}
        currentPrizeText={group.prize_text}
        resubmitRequest={prizeModalState.resubmitRequest}
        membersById={membersById}
        onClose={() =>
          setPrizeModalState({ open: false, resubmitRequest: null })
        }
        onSubmitted={() => void refresh()}
      />

      <EvaluationPeriodModal
        open={evalPeriodModalState.open}
        groupId={group.id}
        currentStartAt={group.evaluation_start_at}
        currentEndAt={group.evaluation_end_at}
        resubmitRequest={evalPeriodModalState.resubmitRequest}
        membersById={membersById}
        onClose={() =>
          setEvalPeriodModalState({ open: false, resubmitRequest: null })
        }
        onSubmitted={() => void refresh()}
      />
    </div>
  );
}
