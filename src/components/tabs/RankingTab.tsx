import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  CalendarClock,
  Check,
  Copy,
  KeyRound,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { Group, GroupRankingRow } from '../../lib/types';
import {
  copyToClipboard,
  formatDateTimeBR,
  isEvaluationPeriodEnded,
} from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';

interface RankingTabProps {
  group: Group;
  ranking: GroupRankingRow[];
  onSuggestPrize: () => void;
  onProposeEvaluationPeriod: () => void;
}

export function RankingTab({
  group,
  ranking,
  onSuggestPrize,
  onProposeEvaluationPeriod,
}: RankingTabProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const chartData = ranking.map((row, idx) => ({
    userId: row.user_id,
    displayName: row.display_name,
    shortName:
      row.display_name.length > 13
        ? `${row.display_name.slice(0, 11)}…`
        : row.display_name,
    total_points: row.total_points,
    completed_count: row.completed_count,
    position: idx + 1,
  }));

  const chartHeight = Math.max(180, chartData.length * 48);
  const evaluationEnded = isEvaluationPeriodEnded(group.evaluation_end_at);

  const handleCopyInvite = async () => {
    const ok = await copyToClipboard(group.invite_code);
    if (ok) {
      setCopied(true);
      showToast('Código de convite copiado!', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      showToast('Não foi possível copiar automaticamente.', 'warning');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <section className="flex flex-col justify-between rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-zinc-900 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
              <Trophy className="h-4 w-4 text-amber-400" />
              Prêmio do Grupo
            </div>
            <p className="mt-1.5 text-sm font-medium leading-relaxed text-zinc-100">
              {group.prize_text}
            </p>
          </div>

          <button
            type="button"
            onClick={onSuggestPrize}
            className="mt-3.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/25"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            Sugerir novo prêmio
          </button>
        </section>

        <section className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                <CalendarClock className="h-4 w-4 text-emerald-400" />
                Período de Avaliação
              </div>
              {group.evaluation_end_at && (
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                    evaluationEnded
                      ? 'bg-rose-500/15 text-rose-300'
                      : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {evaluationEnded ? 'Encerrado' : 'Em andamento'}
                </span>
              )}
            </div>

            {group.evaluation_end_at ? (
              <div className="mt-1.5 space-y-0.5">
                <p className="text-sm font-medium text-zinc-100">
                  Encerramento: {formatDateTimeBR(group.evaluation_end_at)}
                </p>
                {group.evaluation_start_at && (
                  <p className="text-xs text-zinc-400">
                    Início: {formatDateTimeBR(group.evaluation_start_at)}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-zinc-400">
                Sem data de fechamento definida
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onProposeEvaluationPeriod}
            className="mt-3.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
          >
            <CalendarClock className="h-4 w-4 text-emerald-400" />
            Definir / Alterar período
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-100">
              Placar de Pontos
            </h2>
            <p className="text-xs text-zinc-400">
              Atualizado em tempo real por conclusões validadas
            </p>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-400">
            Ainda não há membros no ranking deste grupo.
          </div>
        ) : (
          <div style={{ width: '100%', height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 44, left: 4, bottom: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={92}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#e4e4e7', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as (typeof chartData)[0];
                    return (
                      <div className="rounded-xl border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-xs shadow-xl">
                        <p className="font-semibold text-zinc-100">
                          #{item.position} {item.displayName}
                        </p>
                        <p className="mt-0.5 text-emerald-400">
                          {item.total_points} pts • {item.completed_count}{' '}
                          conclusões
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="total_points"
                  radius={[0, 8, 8, 0]}
                  barSize={24}
                  minPointSize={6}
                >
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={entry.userId}
                      fill={idx === 0 ? '#f59e0b' : '#10b981'}
                    />
                  ))}
                  <LabelList
                    dataKey="total_points"
                    position="right"
                    formatter={(val: unknown) => `${val ?? 0} pts`}
                    style={{ fill: '#d4d4d8', fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <Link
          to={`/groups/${group.id}/ranking`}
          className="mt-3 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
        >
          Ver Ranking Detalhado e Histórico
          <ArrowRight className="h-4 w-4 text-emerald-400" />
        </Link>
      </section>

      <section className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
            Código de convite
          </div>
          <p className="mt-0.5 font-mono text-base font-bold tracking-wider text-zinc-100">
            {group.invite_code}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleCopyInvite()}
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-400" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 text-zinc-300" />
              Copiar
            </>
          )}
        </button>
      </section>
    </div>
  );
}
