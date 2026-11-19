import {
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import type { Task } from '../../lib/types';
import { formatRecurrence } from '../../lib/utils';

interface MyTasksTabProps {
  tasks: Task[];
  currentUserId: string;
  completedTodayTaskIds: Set<string>;
  completedOnceTaskIds: Set<string>;
  onSelectTask: (task: Task) => void;
}

export function MyTasksTab({
  tasks,
  currentUserId,
  completedTodayTaskIds,
  completedOnceTaskIds,
  onSelectTask,
}: MyTasksTabProps) {
  const myTasks = tasks.filter(
    (task) => task.assigned_to === null || task.assigned_to === currentUserId
  );

  const isTaskDone = (task: Task) => {
    if (task.recurrence === 'once') {
      return completedOnceTaskIds.has(task.id);
    }
    return completedTodayTaskIds.has(task.id);
  };

  const completedCount = myTasks.filter(isTaskDone).length;
  const pct =
    myTasks.length > 0 ? Math.round((completedCount / myTasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-zinc-300">
            Progresso de hoje
          </span>
          <span className="font-bold text-emerald-400">
            {completedCount} / {myTasks.length} concluídas
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {myTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
          <Sparkles className="mb-2 h-8 w-8 text-zinc-500" />
          <p className="text-sm font-semibold text-zinc-200">
            Nenhuma tarefa atribuída para você agora
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Proponha novas metas na aba “Todas” para o grupo votar.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {myTasks.map((task) => {
            const done = isTaskDone(task);
            const isAssignedToMe = task.assigned_to === currentUserId;

            return (
              <button
                key={task.id}
                type="button"
                disabled={done}
                onClick={() => onSelectTask(task)}
                className={`w-full rounded-2xl border p-4 text-left transition-all ${
                  done
                    ? 'cursor-default border-emerald-500/25 bg-emerald-500/5 opacity-80'
                    : 'border-zinc-800 bg-zinc-900/90 hover:border-emerald-500/40 active:scale-[0.99]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {done ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <Circle className="h-6 w-6 text-zinc-600" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className={`text-sm font-bold ${
                          done ? 'text-zinc-300 line-through' : 'text-zinc-100'
                        }`}
                      >
                        {task.title}
                      </h3>
                      <span className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
                        +{task.points} pts
                      </span>
                    </div>

                    {task.description && (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        {task.description}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-0.5 text-zinc-300">
                        <Clock className="h-3 w-3 text-zinc-400" />
                        {formatRecurrence(task.recurrence)}
                      </span>

                      {isAssignedToMe ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                          <UserCheck className="h-3 w-3" />
                          Sua meta individual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-0.5 text-zinc-400">
                          <Users className="h-3 w-3" />
                          Diária do grupo
                        </span>
                      )}

                      {done && (
                        <span className="ml-auto font-semibold text-emerald-400">
                          {task.recurrence === 'once'
                            ? 'Concluída'
                            : 'Concluída hoje'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
