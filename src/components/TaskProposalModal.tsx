import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { GroupMemberWithProfile, Task, TaskRecurrence } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface TaskProposalModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  groupId: string;
  members: GroupMemberWithProfile[];
  task?: Task | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

const KEEP_SELF_ASSIGNED = '__KEEP_EXISTING_SELF__';

export function TaskProposalModal({
  open,
  mode,
  groupId,
  members,
  task,
  onClose,
  onSubmitted,
}: TaskProposalModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('10');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('daily');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const isExistingAssignedToSelf =
    mode === 'edit' && Boolean(task?.assigned_to) && task?.assigned_to === user?.id;

  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setPoints(String(task.points));
      const validRecurrence: TaskRecurrence =
        task.recurrence === 'weekly' || task.recurrence === 'once'
          ? task.recurrence
          : 'daily';
      setRecurrence(validRecurrence);
      if (task.assigned_to && task.assigned_to === user?.id) {
        setAssignedTo(KEEP_SELF_ASSIGNED);
      } else {
        setAssignedTo(task.assigned_to ?? '');
      }
    } else {
      setTitle('');
      setDescription('');
      setPoints('10');
      setRecurrence('daily');
      setAssignedTo('');
    }
  }, [mode, open, task, user?.id]);

  if (!open || !user) return null;

  const otherMembers = members.filter((m) => m.user_id !== user.id);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const parsedPoints = Number.parseInt(points, 10);

    if (!trimmedTitle) {
      showToast('Informe o título da tarefa.', 'warning');
      return;
    }

    if (!Number.isFinite(parsedPoints) || parsedPoints < 1) {
      showToast('A pontuação precisa ser um número inteiro maior que zero.', 'warning');
      return;
    }

    let resolvedAssignedTo: string | null = null;
    if (assignedTo === KEEP_SELF_ASSIGNED) {
      resolvedAssignedTo = task?.assigned_to ?? null;
    } else if (assignedTo) {
      if (assignedTo === user.id) {
        showToast(
          'Você não pode criar ou atribuir uma tarefa diretamente para si mesmo.',
          'error'
        );
        return;
      }
      resolvedAssignedTo = assignedTo;
    }

    if (mode === 'create' && resolvedAssignedTo === user.id) {
      showToast(
        'Você não pode criar uma tarefa atribuída a você mesmo.',
        'error'
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('task_change_requests').insert({
        group_id: groupId,
        task_id: mode === 'edit' && task ? task.id : null,
        request_type: mode,
        proposed_data: {
          title: trimmedTitle,
          description: description.trim() || null,
          points: parsedPoints,
          recurrence,
          assigned_to: resolvedAssignedTo,
        },
        requested_by: user.id,
      });

      if (error) {
        showToast(`Erro ao enviar proposta: ${error.message}`, 'error');
        return;
      }

      showToast(
        mode === 'create'
          ? 'Proposta de nova tarefa enviada para votação!'
          : 'Proposta de edição enviada para votação!',
        'success'
      );
      onSubmitted?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="pb-safe max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">
              {mode === 'create'
                ? 'Propor nova tarefa'
                : 'Propor edição de tarefa'}
            </h2>
            <p className="text-xs text-zinc-400">
              Toda alteração precisa atingir o quórum do grupo em Votações.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="task-title"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Título *
            </label>
            <input
              id="task-title"
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Treinar 45 minutos"
              className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="task-desc"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Descrição (opcional)
            </label>
            <textarea
              id="task-desc"
              rows={2}
              maxLength={280}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Critérios do que vale como prova"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="task-points"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
              >
                Pontos *
              </label>
              <input
                id="task-points"
                type="number"
                required
                min={1}
                max={10000}
                step={1}
                inputMode="numeric"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="task-recurrence"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
              >
                Recorrência
              </label>
              <select
                id="task-recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as TaskRecurrence)}
                className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              >
                <option value="daily">Diária</option>
                <option value="weekly">Semanal</option>
                <option value="once">Única</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="task-assignee"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Atribuir para
            </label>
            <select
              id="task-assignee"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            >
              {isExistingAssignedToSelf && (
                <option value={KEEP_SELF_ASSIGNED}>
                  Manter atribuição atual (atribuída a você)
                </option>
              )}
              <option value="">Todos do grupo (coletiva)</option>
              {otherMembers.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.profiles?.display_name ?? 'Membro do grupo'}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-zinc-400">
              Para evitar conflitos, você não pode atribuir tarefas a si mesmo.
            </p>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-[48px] flex-1 rounded-xl border border-zinc-700 bg-zinc-800/70 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar para votação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
