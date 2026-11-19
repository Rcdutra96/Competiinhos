import { useEffect, useState, type FormEvent } from 'react';
import { CalendarClock, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile, TaskChangeRequestWithVotes } from '../lib/types';
import {
  formatDateTimeBR,
  fromDateTimeLocalInputValue,
  toDateTimeLocalInputValue,
} from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SuggestionReviewBanner } from './SuggestionReviewBanner';

interface EvaluationPeriodModalProps {
  open: boolean;
  groupId: string;
  currentStartAt: string | null;
  currentEndAt: string | null;
  resubmitRequest?: TaskChangeRequestWithVotes | null;
  membersById?: Record<string, Profile>;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function EvaluationPeriodModal({
  open,
  groupId,
  currentStartAt,
  currentEndAt,
  resubmitRequest = null,
  membersById = {},
  onClose,
  onSubmitted,
}: EvaluationPeriodModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (resubmitRequest) {
      const p = resubmitRequest.proposed_data ?? {};
      const proposedStart =
        typeof p.evaluation_start_at === 'string'
          ? p.evaluation_start_at
          : null;
      const proposedEnd =
        typeof p.evaluation_end_at === 'string' ? p.evaluation_end_at : null;
      setStartAt(toDateTimeLocalInputValue(proposedStart));
      setEndAt(toDateTimeLocalInputValue(proposedEnd));
    } else {
      setStartAt(toDateTimeLocalInputValue(currentStartAt));
      setEndAt(toDateTimeLocalInputValue(currentEndAt));
    }
  }, [currentEndAt, currentStartAt, open, resubmitRequest]);

  if (!open || !user) return null;

  const latestSuggestedVote = resubmitRequest
    ? [...resubmitRequest.votes]
        .reverse()
        .find(
          (v) =>
            v.vote === 'reject_with_suggestion' &&
            v.suggested_data &&
            (typeof v.suggested_data.evaluation_start_at === 'string' ||
              typeof v.suggested_data.evaluation_end_at === 'string')
        )
    : undefined;

  const handleApplySuggestion = () => {
    const sData = latestSuggestedVote?.suggested_data;
    if (!sData) return;

    if (typeof sData.evaluation_start_at === 'string') {
      setStartAt(toDateTimeLocalInputValue(sData.evaluation_start_at));
    }
    if (typeof sData.evaluation_end_at === 'string') {
      setEndAt(toDateTimeLocalInputValue(sData.evaluation_end_at));
    }
    showToast('Sugestão aplicada ao formulário.', 'info');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const startIso = fromDateTimeLocalInputValue(startAt);
    const endIso = fromDateTimeLocalInputValue(endAt);

    if (!endIso) {
      showToast(
        'Informe a data e hora de encerramento do período de avaliação.',
        'warning'
      );
      return;
    }

    if (startIso && Date.parse(endIso) <= Date.parse(startIso)) {
      showToast(
        'O encerramento precisa ser posterior ao início do período.',
        'warning'
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('task_change_requests').insert({
        group_id: groupId,
        task_id: null,
        parent_request_id: resubmitRequest?.id ?? null,
        request_type: 'evaluation_period_update',
        proposed_data: {
          evaluation_start_at: startIso,
          evaluation_end_at: endIso,
        },
        requested_by: user.id,
      });

      if (error) {
        showToast(`Erro ao enviar proposta: ${error.message}`, 'error');
        return;
      }

      showToast(
        resubmitRequest
          ? 'Proposta corrigida e reenviada para votação!'
          : 'Proposta de período de avaliação enviada para votação!',
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
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-zinc-100">
                {resubmitRequest
                  ? 'Corrigir período de avaliação'
                  : 'Período de avaliação'}
              </h2>
              <p className="text-xs text-zinc-400">
                Mudanças no prazo precisam ser aprovadas pelo grupo.
              </p>
            </div>
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

        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Período atual
          </p>
          <p className="mt-1 text-zinc-200">
            {currentEndAt
              ? `Encerra em ${formatDateTimeBR(currentEndAt)}`
              : 'Sem data de fechamento definida'}
          </p>
          {currentStartAt && (
            <p className="mt-0.5 text-zinc-400">
              Início: {formatDateTimeBR(currentStartAt)}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="eval-start-at"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Início (opcional)
            </label>
            <input
              id="eval-start-at"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="eval-end-at"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Encerramento *
            </label>
            <input
              id="eval-end-at"
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
            <p className="mt-1.5 text-[11px] text-zinc-500">
              Após o encerramento, novos check-ins são bloqueados e o placar
              permanece visível.
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
              {resubmitRequest ? 'Reenviar proposta' : 'Enviar proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
