import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Trophy, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile, TaskChangeRequestWithVotes } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SuggestionReviewBanner } from './SuggestionReviewBanner';

interface PrizeProposalModalProps {
  open: boolean;
  groupId: string;
  currentPrizeText: string;
  resubmitRequest?: TaskChangeRequestWithVotes | null;
  membersById?: Record<string, Profile>;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function PrizeProposalModal({
  open,
  groupId,
  currentPrizeText,
  resubmitRequest = null,
  membersById = {},
  onClose,
  onSubmitted,
}: PrizeProposalModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [prizeText, setPrizeText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (resubmitRequest) {
      const p = resubmitRequest.proposed_data ?? {};
      setPrizeText(
        typeof p.prize_text === 'string' ? p.prize_text : currentPrizeText
      );
    } else {
      setPrizeText(currentPrizeText);
    }
  }, [currentPrizeText, open, resubmitRequest]);

  if (!open || !user) return null;

  const latestSuggestedVote = resubmitRequest
    ? [...resubmitRequest.votes]
        .reverse()
        .find(
          (v) =>
            v.vote === 'reject_with_suggestion' &&
            v.suggested_data &&
            typeof v.suggested_data.prize_text === 'string'
        )
    : undefined;

  const handleApplySuggestion = () => {
    const suggested = latestSuggestedVote?.suggested_data?.prize_text;
    if (typeof suggested === 'string') {
      setPrizeText(suggested);
      showToast('Sugestão aplicada ao prêmio proposto.', 'info');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = prizeText.trim();
    if (!trimmed) {
      showToast('Digite o texto do novo prêmio sugerido.', 'warning');
      return;
    }

    if (trimmed === currentPrizeText.trim()) {
      showToast('O prêmio sugerido é igual ao prêmio atual.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('task_change_requests').insert({
        group_id: groupId,
        task_id: null,
        parent_request_id: resubmitRequest?.id ?? null,
        request_type: 'prize_update',
        proposed_data: {
          prize_text: trimmed,
        },
        requested_by: user.id,
      });

      if (error) {
        showToast(`Erro ao sugerir prêmio: ${error.message}`, 'error');
        return;
      }

      showToast(
        resubmitRequest
          ? 'Proposta de prêmio corrigida e reenviada para votação!'
          : 'Sugestão de novo prêmio enviada para votação!',
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
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold text-zinc-100">
              {resubmitRequest ? 'Corrigir novo prêmio' : 'Sugerir novo prêmio'}
            </h2>
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

        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Prêmio atual
          </p>
          <p className="mt-1 text-sm text-zinc-200">{currentPrizeText}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="proposed-prize"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Novo prêmio proposto *
            </label>
            <textarea
              id="proposed-prize"
              required
              rows={3}
              maxLength={300}
              value={prizeText}
              onChange={(e) => setPrizeText(e.target.value)}
              placeholder="Descreva o novo prêmio para votação do grupo"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400"
            />
          </div>

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
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
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
