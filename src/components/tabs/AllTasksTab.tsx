import { useState } from 'react';
import {
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Profile, Task } from '../../lib/types';
import { formatRecurrence } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';

interface AllTasksTabProps {
  groupId: string;
  currentUserId: string;
  tasks: Task[];
  membersById: Record<string, Profile>;
  onCreateTask: () => void;
  onEditTask: (task: Task) => void;
  onRequestSubmitted?: () => void;
}

export function AllTasksTab({
  groupId,
  currentUserId,
  tasks,
  membersById,
  onCreateTask,
  onEditTask,
  onRequestSubmitted,
}: AllTasksTabProps) {
  const { showToast } = useToast();
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTask) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('task_change_requests').insert({
        group_id: groupId,
        task_id: confirmDeleteTask.id,
        request_type: 'delete',
        proposed_data: {
          title: confirmDeleteTask.title,
          points: confirmDeleteTask.points,
          recurrence: confirmDeleteTask.recurrence,
          assigned_to: confirmDeleteTask.assigned_to,
        },
        requested_by: currentUserId,
      });

      if (error) {
        showToast(
          `Erro ao solicitar exclusão: ${error.message}`,
          'error'
        );
        return;
      }

      showToast(
        'Solicitação de exclusão enviada para votação!',
        'success'
      );
      setConfirmDeleteTask(null);
      onRequestSubmitted?.();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-zinc-100">
            Todas as tarefas ({tasks.length})
          </h2>
          <p className="text-xs text-zinc-400">
            Criações, edições e exclusões passam por votação
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateTask}
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          Nova Tarefa
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-zinc-200">
            Nenhuma tarefa ativa ainda
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Toque em “Nova Tarefa” para propor a primeira meta do grupo.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const assigneeName = task.assigned_to
              ? membersById[task.assigned_to]?.display_name ?? 'Membro'
              : 'Todos do grupo';

            return (
              <article
                key={task.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-zinc-100">
                    {task.title}
                  </h3>
                  <span className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-300">
                    +{task.points} pts
                  </span>
                </div>

                {task.description && (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {task.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
                    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5">
                      {task.assigned_to ? (
                        <User className="h-3 w-3 text-amber-400" />
                      ) : (
                        <Users className="h-3 w-3 text-emerald-400" />
                      )}
                      {assigneeName}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5">
                      <Clock className="h-3 w-3 text-zinc-400" />
                      {formatRecurrence(task.recurrence)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEditTask(task)}
                      className="flex min-h-[38px] items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTask(task)}
                      className="flex min-h-[38px] items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {confirmDeleteTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="pb-safe w-full max-w-md rounded-t-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:rounded-3xl">
            <h3 className="text-base font-bold text-zinc-100">
              Solicitar exclusão da tarefa?
            </h3>
            <p className="mt-1.5 text-sm text-zinc-400">
              Será aberta uma votação para excluir{' '}
              <strong className="text-zinc-200">
                {confirmDeleteTask.title}
              </strong>
              . A tarefa continua ativa até o grupo aprovar.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteTask(null)}
                className="min-h-[46px] flex-1 rounded-xl border border-zinc-700 bg-zinc-800 text-sm font-medium text-zinc-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 text-sm font-bold text-white hover:bg-rose-400 disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar votação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
