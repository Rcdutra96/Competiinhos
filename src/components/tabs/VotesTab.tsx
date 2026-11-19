import { Scale, Vote } from 'lucide-react';
import { calculateQuorum } from '../../lib/quorum';
import type {
  Group,
  GroupMemberWithProfile,
  Profile,
  Task,
  TaskChangeRequestWithVotes,
} from '../../lib/types';
import { VoteCard } from '../VoteCard';

interface VotesTabProps {
  group: Group;
  members: GroupMemberWithProfile[];
  membersById: Record<string, Profile>;
  tasks: Task[];
  requests: TaskChangeRequestWithVotes[];
  onVoted?: () => void;
}

export function VotesTab({
  group,
  members,
  membersById,
  tasks,
  requests,
  onVoted,
}: VotesTabProps) {
  const quorum = calculateQuorum(group, members);

  const tasksById = tasks.reduce<Record<string, Task>>((acc, task) => {
    acc[task.id] = task;
    return acc;
  }, {});

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const historyRequests = requests.filter((r) => r.status !== 'pending');

  const ratioPct = Math.round(Number(group.quorum_majority_ratio) * 100);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-3.5 text-xs text-zinc-300">
        <div className="flex items-center gap-2 font-semibold text-zinc-100">
          <Scale className="h-4 w-4 text-amber-400" />
          Regras de Quórum do Grupo
        </div>
        <p className="mt-1 leading-relaxed text-zinc-400">
          Membros ativos nos últimos{' '}
          <strong className="text-zinc-200">
            {group.active_window_days} dias
          </strong>
          : <strong className="text-zinc-200">{quorum.activeCount}</strong>.
          Até {group.quorum_unanimity_max} ativos exige unanimidade; acima
          disso exige {ratioPct}% ({quorum.requiredVotes} votos neste momento).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          Pendentes ({pendingRequests.length})
        </h2>

        {pendingRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center">
            <Vote className="mb-2 h-7 w-7 text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-200">
              Nenhuma votação pendente
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Novas tarefas, edições ou sugestões de prêmio aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <VoteCard
                key={req.id}
                request={req}
                group={group}
                members={members}
                membersById={membersById}
                tasksById={tasksById}
                onVoted={onVoted}
              />
            ))}
          </div>
        )}
      </section>

      {historyRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Histórico recente ({historyRequests.length})
          </h2>
          <div className="space-y-3">
            {historyRequests.slice(0, 20).map((req) => (
              <VoteCard
                key={req.id}
                request={req}
                group={group}
                members={members}
                membersById={membersById}
                tasksById={tasksById}
                onVoted={onVoted}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
