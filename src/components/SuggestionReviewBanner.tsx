import { MessageSquareWarning, Sparkles } from 'lucide-react';
import type { Profile, TaskChangeRequestWithVotes } from '../lib/types';
import { formatDateTimeBR, formatRecurrence } from '../lib/utils';

interface SuggestionReviewBannerProps {
  request: TaskChangeRequestWithVotes;
  membersById?: Record<string, Profile>;
  hasSuggestedData: boolean;
  onApplySuggestion?: () => void;
}

export function SuggestionReviewBanner({
  request,
  membersById = {},
  hasSuggestedData,
  onApplySuggestion,
}: SuggestionReviewBannerProps) {
  const suggestionVotes = request.votes.filter(
    (v) => v.vote === 'reject_with_suggestion'
  );

  if (suggestionVotes.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
          <MessageSquareWarning className="h-4 w-4 shrink-0 text-amber-400" />
          Sugestões recebidas ({suggestionVotes.length})
        </div>

        {hasSuggestedData && onApplySuggestion && (
          <button
            type="button"
            onClick={onApplySuggestion}
            className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg bg-amber-400 px-2.5 text-[11px] font-bold text-zinc-950 hover:bg-amber-300"
          >
            <Sparkles className="h-3 w-3" />
            Aplicar sugestão
          </button>
        )}
      </div>

      <div className="mt-2.5 space-y-2">
        {suggestionVotes.map((vote) => {
          const authorName =
            membersById[vote.user_id]?.display_name ?? 'Membro';
          const sData = vote.suggested_data ?? {};
          const parts: string[] = [];

          if (typeof sData.title === 'string') {
            parts.push(`Título: ${sData.title}`);
          }
          if (typeof sData.points === 'number') {
            parts.push(`${sData.points} pts`);
          }
          if (typeof sData.recurrence === 'string') {
            parts.push(formatRecurrence(sData.recurrence));
          }
          if (typeof sData.prize_text === 'string') {
            parts.push(`Prêmio: ${sData.prize_text}`);
          }
          if (typeof sData.evaluation_start_at === 'string') {
            parts.push(`Início: ${formatDateTimeBR(sData.evaluation_start_at)}`);
          }
          if (typeof sData.evaluation_end_at === 'string') {
            parts.push(`Fim: ${formatDateTimeBR(sData.evaluation_end_at)}`);
          }

          return (
            <div
              key={vote.id}
              className="rounded-xl border border-amber-500/20 bg-zinc-950/70 p-2.5 text-xs"
            >
              <p className="font-semibold text-zinc-200">{authorName}:</p>
              {vote.suggestion_note && (
                <p className="mt-0.5 text-zinc-300">“{vote.suggestion_note}”</p>
              )}
              {parts.length > 0 && (
                <p className="mt-1 text-[11px] font-medium text-amber-300">
                  Alterações sugeridas: {parts.join(' • ')}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
