import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  GroupMemberWithProfile,
  Profile,
  Task,
  TaskChangeRequestWithVotes,
  TaskRecurrence,
} from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SuggestionReviewBanner } from './SuggestionReviewBanner';

interface TaskProposalModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  groupId: string;
  members: GroupMemberWithProfile[];
  membersById?: Record<string, Profile>;
  task?: Task | null;
  resubmitRequest?: TaskChangeRequestWithVotes | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

const KEEP_SELF_ASSIGNED = '__KEEP_EXISTING_SELF__';

function toValidRecurrence(value: unknown, fallback: TaskRecurrence = 'daily'): TaskRecurrence {
  if (value === 'daily' || value === 'weekly' || value === 'once') {
    return value;
  }
  return fallback;
}

export function TaskProposalModal({
  open,
  mode,
  groupId,
  members,
  membersById = {},
  task,
  resubmitRequest = null,
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

  const effectiveAssignedTo = resubmitRequest
    ? typeof resubmitRequest.proposed_data?.assigned_to === 'string'
      ? resubmitRequest.proposed_data.assigned_to
      : resubmitRequest.proposed_data?.assigned_to === null
        ? null
        : task?.assigned_to ?? null
    : task?.assigned_to ?? null;

  const isExistingAssignedToSelf =
    (mode === 'edit' || Boolean(resubmitRequest)) &&
    Boolean(effectiveAssignedTo) &&
    effectiveAssignedTo === user?.id;

  useEffect(() => {
    if (!open) return;

    if (resubmitRequest) {
      const p = resubmitRequest.proposed_data ?? {};
      setTitle(typeof p.title === 'string' ? p.title : task?.title ?? '');
      setDescription(
        typeof p.description === 'string'
          ? p.description
          : p.description === null
            ? ''
            : task?.description ?? ''
      );
      setPoints(
        typeof p.points === 'number'
          ? String(p.points)
          : task
            ? String(task.points)
            : '10'
      );
      setRecurrence(
        toValidRecurrence(p.recurrence, task?.recurrence ?? 'daily')
      );

      const pAssigned =
        typeof p.assigned_to === 'string'
          ? p.assigned_to
          : p.assigned_to === null
            ? null
            : task?.assigned_to ?? null;

      if (pAssigned && pAssigned === user?.id) {
        setAssignedTo(KEEP_SELF_ASSIGNED);
      } else {
        setAssignedTo(pAssigned ?? '');
      }
      return;
    }

    if (mode === 'edit' && task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setPoints(String(task.points));
      setRecurrence(toValidRecurrence(task.recurrence));
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
  }, [mode, open, resubmitRequest, task, user?.id]);

  if (!open || !user) return null;

  const otherMembers = members.filter((m) => m.user_id !== user.id);

  const latestSuggestedVote = resubmitRequest
    ? [...resubmitRequest.votes]
        .reverse()
        .find(
          (v) =>
            v.vote === 'reject_with_suggestion' &&
            v.suggested_data &&
            (typeof v.suggested_data.title === 'string' ||
              typeof v.suggested_data.description === 'string' ||
              typeof v.suggested_data.points === 'number' ||
              typeof v.suggested_data.recurrence === 'string')
        )
    : undefined;

  const handleApplySuggestion = () => {
    const sData = latestSuggestedVote?.suggested_data;
    if (!sData) return;

    if (typeof sData.title === 'string') {
      setTitle(sData.title);
    }
    if (typeof sData.description === 'string') {
      setDescription(sData.description);
    }
    if (typeof sData.points === 'number') {
      setPoints(String(sData.points));
    }
    if (typeof sData.recurrence === 'string') {
      setRecurrence(toValidRecurrence(sData.recurrence, recurrence));
    }
    showToast('Sugestão aplicada ao formulário.', 'info');
  };

  const resolvePayload = (): {
    title: string;
    description: string | null;
    points: number;
    recurrence: TaskRecurrence;
    assigned_to: string | null;
  } | null => {
    const trimmedTitle = title.trim();
    const parsedPoints = Number.parseInt(points, 10);

    if (!trimmedTitle) {
      showToast('Informe o título da tarefa.', 'warning');
      return null;
    }

    if (!Number.isFinite(parsedPoints) || parsedPoints < 1) {
      showToast(
        'A pontuação precisa ser um número inteiro maior que zero.',
        'warning'
      );
      return null;
    }

    let resolvedAssignedTo: string | null = null;
    if (assignedTo === KEEP_SELF_ASSIGNED) {
      resolvedAssignedTo = effectiveAssignedTo;
    } else if (assignedTo) {
      if (assignedTo === user.id) {
        showToast(
          'Você não pode criar ou atribuir uma tarefa diretamente para si mesmo.',
          'error'
        );
        return null;
      }
      resolvedAssignedTo = assignedTo;
    }

    const effectiveType = resubmitRequest
      ? resubmitRequest.request_type === 'delete'
        ? 'edit'
        : resubmitRequest.request_type
      : mode;

    if (effectiveType === 'create' && resolvedAssignedTo === user.id) {
      showToast(
        'Você não pode criar uma tarefa atribuída a você mesmo.',
        'error'
      );
      return null;
    }

    return {
      title: trimmedTitle,
      description: description.trim() || null,
      points: parsedPoints,
      recurrence,
      assigned_to: resolvedAssignedTo,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const proposedData = resolvePayload();
    if (!proposedData) return;

    const targetRequestType = resubmitRequest
      ? resubmitRequest.request_type === 'delete'
        ? 'edit'
        : resubmitRequest.request_type
      : mode;

    const targetTaskId = resubmitRequest
      ? resubmitRequest.task_id ?? task?.id ?? null
      : mode === 'edit' && task
        ? task.id
        : null;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('task_change_requests').insert({
        group_id: groupId,
        task_id: targetTaskId,
        parent_request_id: resubmitRequest?.id ?? null,
        request_type: targetRequestType,
        proposed_data: proposedData,
        requested_by: user.id,
      });

      if (error) {
        showToast(`Erro ao enviar proposta: ${error.message}`, 'error');
        return;
      }

      showToast(
        resubmitRequest
          ? 'Proposta corrigida e reenviada para votação!'
          : mode === 'create'
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

  const handleResubmitDelete = async () => {
    if (!resubmitRequest || resubmitRequest.request_type !== 'delete') return;
    const proposedData = resolvePayload();
    if (!proposedData) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('task_change_requests').insert({
        group_id: groupId,
        task_id: resubmitRequest.task_id ?? task?.id ?? null,
        parent_request_id: resubmitRequest.id,
        request_type: 'delete',
        proposed_data: proposedData,
        requested_by: user.id,
      });

      if (error) {
        showToast(`Erro ao reenviar exclusão: ${error.message}`, 'error');
        return;
      }

      showToast('Pedido de exclusão reenviado para votação!', 'success');
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
              {resubmitRequest
                ? resubmitRequest.request_type === 'delete'
                  ? 'Ajustar tarefa ou reenviar exclusão'
                  : 'Corrigir e reenviar proposta'
                : mode === 'create'
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

        {resubmitRequest && (
          <SuggestionReviewBanner
            request={resubmitRequest}
            membersById={membersById}
            hasSuggestedData={Boolean(latestSuggestedVote)}
            onApplySuggestion={handleApplySuggestion}
          />
        )}

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

          <div className="space-y-2 pt-1">
            <div className="flex gap-2.5">
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
                {resubmitRequest
                  ? resubmitRequest.request_type === 'delete'
                    ? 'Enviar como edição'
                    : 'Reenviar proposta'
                  : 'Enviar para votação'}
              </button>
            </div>

            {resubmitRequest?.request_type === 'delete' && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleResubmitDelete()}
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 text-xs font-bold text-rose-300 hover:bg-rose-500/25 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Reenviar pedido de exclusão
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
