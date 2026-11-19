import { useState, type FormEvent } from 'react';
import {
  CalendarClock,
  Check,
  Loader2,
  MessageSquarePlus,
  Pencil,
  PlusCircle,
  RotateCcw,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateQuorum } from '../lib/quorum';
import type {
  ChangeRequestStatus,
  ChangeRequestType,
  Group,
  GroupMemberWithProfile,
  Profile,
  Task,
  TaskChangeRequestWithVotes,
  VoteType,
} from '../lib/types';
import {
  formatDateTimeBR,
  formatRecurrence,
  formatRelativeTimeBR,
  fromDateTimeLocalInputValue,
} from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from './Avatar';

interface VoteCardProps {
  request: TaskChangeRequestWithVotes;
  group: Group;
  members: GroupMemberWithProfile[];
  membersById: Record<string, Profile>;
  tasksById: Record<string, Task>;
  onVoted?: () => void;
  onResubmit?: (request: TaskChangeRequestWithVotes) => void;
}

const REQUEST_TYPE_META: Record<
  ChangeRequestType,
  { label: string; colorClass: string; Icon: typeof PlusCircle }
> = {
  create: {
    label: 'Nova Tarefa',
    colorClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    Icon: PlusCircle,
  },
  edit: {
    label: 'Editar Tarefa',
    colorClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    Icon: Pencil,
  },
  delete: {
    label: 'Excluir Tarefa',
    colorClass: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    Icon: Trash2,
  },
  prize_update: {
    label: 'Novo Prêmio',
    colorClass: 'border-amber-500/35 bg-amber-500/15 text-amber-200',
    Icon: Trophy,
  },
  evaluation_period_update: {
    label: 'Período de Avaliação',
    colorClass: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200',
    Icon: CalendarClock,
  },
};

const STATUS_BADGE: Record<
  ChangeRequestStatus,
  { label: string; classes: string }
> = {
  pending: {
    label: 'Em votação',
    classes: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
  },
  approved: {
    label: 'Aprovada',
    classes: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
  },
  rejected: {
    label: 'Recusada',
    classes: 'border-rose-500/35 bg-rose-500/10 text-rose-300',
  },
  counter_proposed: {
    label: 'Devolvida com sugestão',
    classes: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  },
  superseded: {
    label: 'Substituída',
    classes: 'border-zinc-700 bg-zinc-800 text-zinc-400',
  },
};

export function VoteCard({
  request,
  group,
  members,
  membersById,
  tasksById,
  onVoted,
  onResubmit,
}: VoteCardProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [submittingVote, setSubmittingVote] = useState<VoteType | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestionNote, setSuggestionNote] = useState('');
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [suggestedPoints, setSuggestedPoints] = useState('');
  const [suggestedPrize, setSuggestedPrize] = useState('');
  const [suggestedEvalStart, setSuggestedEvalStart] = useState('');
  const [suggestedEvalEnd, setSuggestedEvalEnd] = useState('');

  if (!user) return null;

  const requester = membersById[request.requested_by];
  const requesterName = requester?.display_name ?? 'Membro';
  const typeMeta =
    REQUEST_TYPE_META[request.request_type] ?? REQUEST_TYPE_META.edit;
  const TypeIcon = typeMeta.Icon;
  const statusBadge = STATUS_BADGE[request.status] ?? STATUS_BADGE.pending;

  const quorum = calculateQuorum(group, members);
  const approveCount = request.votes.filter((v) => v.vote === 'approve').length;
  const progressPct = Math.min(
    100,
    Math.round((approveCount / quorum.requiredVotes) * 100)
  );

  const userVote = request.votes.find((v) => v.user_id === user.id);
  const canVote = request.status === 'pending' && !userVote;
  const canResubmit =
    request.status === 'counter_proposed' &&
    request.requested_by === user.id &&
    Boolean(onResubmit);

  const proposed = request.proposed_data ?? {};
  const existingTask = request.task_id ? tasksById[request.task_id] : undefined;

  const proposedTitle =
    typeof proposed.title === 'string'
      ? proposed.title
      : existingTask?.title ?? '';
  const proposedDesc =
    typeof proposed.description === 'string' ? proposed.description : null;
  const proposedPoints =
    typeof proposed.points === 'number'
      ? proposed.points
      : existingTask?.points;
  const proposedRecurrence =
    typeof proposed.recurrence === 'string'
      ? proposed.recurrence
      : existingTask?.recurrence;
  const proposedAssignedTo =
    typeof proposed.assigned_to === 'string'
      ? proposed.assigned_to
      : proposed.assigned_to === null
        ? null
        : existingTask?.assigned_to ?? null;
  const proposedPrize =
    typeof proposed.prize_text === 'string' ? proposed.prize_text : '';
  const proposedEvalStart =
    typeof proposed.evaluation_start_at === 'string'
      ? proposed.evaluation_start_at
      : null;
  const proposedEvalEnd =
    typeof proposed.evaluation_end_at === 'string'
      ? proposed.evaluation_end_at
      : null;

  const submitVote = async (
    voteType: VoteType,
    extra?: {
      suggestionNote: string;
      suggestedData: Record<string, unknown> | null;
    }
  ) => {
    setSubmittingVote(voteType);
    try {
      const { error } = await supabase.from('task_change_votes').insert({
        request_id: request.id,
        user_id: user.id,
        vote: voteType,
        suggestion_note: extra?.suggestionNote ?? null,
        suggested_data: extra?.suggestedData ?? null,
      });

      if (error) {
        if (error.code === '23505') {
          showToast('Você já registrou seu voto nesta solicitação.', 'warning');
        } else {
          showToast(`Erro ao votar: ${error.message}`, 'error');
        }
        return;
      }

      showToast('Voto registrado!', 'success');
      setSuggestOpen(false);
      setSuggestionNote('');
      setSuggestedTitle('');
      setSuggestedPoints('');
      setSuggestedPrize('');
      setSuggestedEvalStart('');
      setSuggestedEvalEnd('');
      onVoted?.();
    } finally {
      setSubmittingVote(null);
    }
  };

  const handleSuggestionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const note = suggestionNote.trim();
    if (!note) {
      showToast('Escreva uma justificativa ou sugestão.', 'warning');
      return;
    }

    const suggestedData: Record<string, unknown> = {};
    if (request.request_type === 'prize_update') {
      if (suggestedPrize.trim()) {
        suggestedData.prize_text = suggestedPrize.trim();
      }
    } else if (request.request_type === 'evaluation_period_update') {
      const startIso = fromDateTimeLocalInputValue(suggestedEvalStart);
      const endIso = fromDateTimeLocalInputValue(suggestedEvalEnd);
      if (startIso) {
        suggestedData.evaluation_start_at = startIso;
      }
      if (endIso) {
        suggestedData.evaluation_end_at = endIso;
      }
      if (startIso && endIso && Date.parse(endIso) <= Date.parse(startIso)) {
        showToast(
          'O encerramento sugerido precisa ser posterior ao início.',
          'warning'
        );
        return;
      }
    } else {
      if (suggestedTitle.trim()) {
        suggestedData.title = suggestedTitle.trim();
      }
      if (suggestedPoints.trim()) {
        const parsed = Number.parseInt(suggestedPoints, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          showToast('Pontos sugeridos precisam ser maior que zero.', 'warning');
          return;
        }
        suggestedData.points = parsed;
      }
    }

    await submitVote('reject_with_suggestion', {
      suggestionNote: note,
      suggestedData:
        Object.keys(suggestedData).length > 0 ? suggestedData : null,
    });
  };

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        canResubmit
          ? 'border-amber-500/45 bg-zinc-900'
          : 'border-zinc-800 bg-zinc-900/90'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${typeMeta.colorClass}`}
        >
          <TypeIcon className="h-3.5 w-3.5" />
          {typeMeta.label}
        </span>

        <span
          className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-medium ${statusBadge.classes}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
        <Avatar src={requester?.avatar_url} name={requesterName} size="xs" />
        <span className="truncate font-medium text-zinc-200">
          {requesterName}
        </span>
        <span>•</span>
        <span>{formatRelativeTimeBR(request.created_at)}</span>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3">
        {request.request_type === 'prize_update' ? (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Prêmio sugerido
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-200">
              {proposedPrize || 'Sem texto'}
            </p>
            {request.status === 'pending' && (
              <p className="mt-2 text-xs text-zinc-500">
                Atual: {group.prize_text}
              </p>
            )}
          </div>
        ) : request.request_type === 'evaluation_period_update' ? (
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Novo período de avaliação
            </p>
            {proposedEvalStart && (
              <p className="text-xs text-zinc-300">
                Início:{' '}
                <strong className="text-zinc-100">
                  {formatDateTimeBR(proposedEvalStart)}
                </strong>
              </p>
            )}
            <p className="text-sm font-semibold text-emerald-300">
              {proposedEvalEnd
                ? `Encerra em ${formatDateTimeBR(proposedEvalEnd)}`
                : 'Sem data de encerramento'}
            </p>
            {request.status === 'pending' && (
              <p className="pt-1 text-xs text-zinc-500">
                Atual:{' '}
                {group.evaluation_end_at
                  ? formatDateTimeBR(group.evaluation_end_at)
                  : 'Sem data de fechamento definida'}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-zinc-100">
                {proposedTitle || 'Tarefa'}
              </h3>
              {proposedPoints !== undefined && (
                <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">
                  +{proposedPoints} pts
                </span>
              )}
            </div>

            {proposedDesc && (
              <p className="text-xs leading-relaxed text-zinc-400">
                {proposedDesc}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-zinc-400">
              {proposedRecurrence && (
                <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5">
                  {formatRecurrence(proposedRecurrence)}
                </span>
              )}
              <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5">
                Para:{' '}
                {proposedAssignedTo
                  ? membersById[proposedAssignedTo]?.display_name ?? 'Membro'
                  : 'Todos do grupo'}
              </span>
            </div>

            {request.request_type === 'edit' && existingTask && (
              <p className="pt-1 text-[11px] text-zinc-500">
                Anterior: {existingTask.title} (+{existingTask.points} pts,{' '}
                {formatRecurrence(existingTask.recurrence)})
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-300">
            Quórum ({quorum.mode === 'unanimity' ? 'unanimidade' : 'maioria'})
          </span>
          <span className="font-semibold text-emerald-300">
            {approveCount} / {quorum.requiredVotes} aprovações
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          Baseado em {quorum.activeCount}{' '}
          {quorum.activeCount === 1 ? 'membro ativo' : 'membros ativos'} nos
          últimos {quorum.activeWindowDays} dias
        </p>
      </div>

      {request.votes.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-zinc-800/80 pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Votos registrados ({request.votes.length})
          </p>
          <div className="space-y-1.5">
            {request.votes.map((voteItem) => {
              const voterName =
                membersById[voteItem.user_id]?.display_name ?? 'Membro';
              const sData = voteItem.suggested_data ?? {};
              const suggestedSummary = [
                typeof sData.title === 'string'
                  ? `Título: ${sData.title}`
                  : null,
                typeof sData.points === 'number'
                  ? `${sData.points} pts`
                  : null,
                typeof sData.recurrence === 'string'
                  ? formatRecurrence(sData.recurrence)
                  : null,
                typeof sData.prize_text === 'string'
                  ? `Prêmio: ${sData.prize_text}`
                  : null,
                typeof sData.evaluation_start_at === 'string'
                  ? `Início: ${formatDateTimeBR(sData.evaluation_start_at)}`
                  : null,
                typeof sData.evaluation_end_at === 'string'
                  ? `Fim: ${formatDateTimeBR(sData.evaluation_end_at)}`
                  : null,
              ].filter(Boolean);

              return (
                <div
                  key={voteItem.id}
                  className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-2.5 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-200">
                      {voterName}
                    </span>
                    <span
                      className={`font-semibold ${
                        voteItem.vote === 'approve'
                          ? 'text-emerald-400'
                          : voteItem.vote === 'reject'
                            ? 'text-rose-400'
                            : 'text-amber-300'
                      }`}
                    >
                      {voteItem.vote === 'approve'
                        ? 'Aprovou'
                        : voteItem.vote === 'reject'
                          ? 'Recusou'
                          : 'Sugeriu ajuste'}
                    </span>
                  </div>
                  {voteItem.suggestion_note && (
                    <p className="mt-1 text-zinc-300">
                      “{voteItem.suggestion_note}”
                    </p>
                  )}
                  {suggestedSummary.length > 0 && (
                    <p className="mt-1 text-[11px] text-amber-300/90">
                      Sugestão: {suggestedSummary.join(' • ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {canResubmit && onResubmit && (
        <button
          type="button"
          onClick={() => onResubmit(request)}
          className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-zinc-950 shadow-sm hover:bg-amber-300"
        >
          <RotateCcw className="h-4 w-4" />
          Corrigir e Reenviar
        </button>
      )}

      {userVote && request.status === 'pending' && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-center text-xs text-zinc-400">
          Você já votou nesta solicitação.
        </div>
      )}

      {canVote && (
        <div className="mt-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={submittingVote !== null}
              onClick={() => void submitVote('approve')}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {submittingVote === 'approve' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 stroke-[2.5]" />
              )}
              Aprovar
            </button>

            <button
              type="button"
              disabled={submittingVote !== null}
              onClick={() => void submitVote('reject')}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-bold text-rose-300 hover:bg-rose-500/25 disabled:opacity-60"
            >
              {submittingVote === 'reject' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4 stroke-[2.5]" />
              )}
              Recusar
            </button>
          </div>

          <button
            type="button"
            disabled={submittingVote !== null}
            onClick={() => setSuggestOpen((prev) => !prev)}
            className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Recusar com sugestão
          </button>

          {suggestOpen && (
            <form
              onSubmit={handleSuggestionSubmit}
              className="space-y-3 rounded-xl border border-amber-500/30 bg-zinc-950 p-3"
            >
              <div>
                <label
                  htmlFor={`note-${request.id}`}
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-amber-300"
                >
                  Sua sugestão / motivo *
                </label>
                <textarea
                  id={`note-${request.id}`}
                  required
                  rows={2}
                  value={suggestionNote}
                  onChange={(e) => setSuggestionNote(e.target.value)}
                  placeholder="Explique o que gostaria de ajustar"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400"
                />
              </div>

              {request.request_type === 'prize_update' ? (
                <div>
                  <label
                    htmlFor={`prize-${request.id}`}
                    className="mb-1 block text-[11px] text-zinc-400"
                  >
                    Novo prêmio sugerido (opcional)
                  </label>
                  <input
                    id={`prize-${request.id}`}
                    type="text"
                    value={suggestedPrize}
                    onChange={(e) => setSuggestedPrize(e.target.value)}
                    placeholder="Sugerir texto alternativo"
                    className="min-h-[40px] w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400"
                  />
                </div>
              ) : request.request_type === 'evaluation_period_update' ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`eval-start-${request.id}`}
                      className="mb-1 block text-[11px] text-zinc-400"
                    >
                      Início sugerido (opc.)
                    </label>
                    <input
                      id={`eval-start-${request.id}`}
                      type="datetime-local"
                      value={suggestedEvalStart}
                      onChange={(e) => setSuggestedEvalStart(e.target.value)}
                      className="min-h-[40px] w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-100 outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`eval-end-${request.id}`}
                      className="mb-1 block text-[11px] text-zinc-400"
                    >
                      Fim sugerido (opc.)
                    </label>
                    <input
                      id={`eval-end-${request.id}`}
                      type="datetime-local"
                      value={suggestedEvalEnd}
                      onChange={(e) => setSuggestedEvalEnd(e.target.value)}
                      className="min-h-[40px] w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-100 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label
                      htmlFor={`title-${request.id}`}
                      className="mb-1 block text-[11px] text-zinc-400"
                    >
                      Título sugerido (opcional)
                    </label>
                    <input
                      id={`title-${request.id}`}
                      type="text"
                      value={suggestedTitle}
                      onChange={(e) => setSuggestedTitle(e.target.value)}
                      placeholder="Outro título"
                      className="min-h-[40px] w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`pts-${request.id}`}
                      className="mb-1 block text-[11px] text-zinc-400"
                    >
                      Pts (opc.)
                    </label>
                    <input
                      id={`pts-${request.id}`}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={suggestedPoints}
                      onChange={(e) => setSuggestedPoints(e.target.value)}
                      placeholder="Ex: 15"
                      className="min-h-[40px] w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSuggestOpen(false)}
                  className="min-h-[40px] flex-1 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingVote !== null}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 text-xs font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
                >
                  {submittingVote === 'reject_with_suggestion' && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Enviar sugestão
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
