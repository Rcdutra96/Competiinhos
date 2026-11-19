import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Loader2,
  Maximize2,
  Mic,
  Trophy,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  Group,
  GroupRankingRow,
  Profile,
  Task,
  TaskCompletionWithDetails,
} from '../lib/types';
import { formatDateTimeBR } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { PhotoLightbox, type LightboxPhoto } from '../components/PhotoLightbox';

const PAGE_SIZE = 20;

export function RankingDetail() {
  const { groupId } = useParams<{ groupId: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [ranking, setRanking] = useState<GroupRankingRow[]>([]);
  const [completions, setCompletions] = useState<TaskCompletionWithDetails[]>(
    []
  );
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<LightboxPhoto | null>(
    null
  );

  const debounceRef = useRef<number | null>(null);

  const normalizeCompletionRow = (
    row: Record<string, unknown>
  ): TaskCompletionWithDetails => {
    const rawProfile = row.profiles as unknown;
    const rawTask = row.tasks as unknown;

    const profileObj = Array.isArray(rawProfile)
      ? ((rawProfile[0] as Pick<Profile, 'display_name' | 'avatar_url'> | undefined) ??
          null)
      : ((rawProfile as Pick<Profile, 'display_name' | 'avatar_url'> | null) ??
          null);

    const taskObj = Array.isArray(rawTask)
      ? ((rawTask[0] as Pick<Task, 'title' | 'points'> | undefined) ?? null)
      : ((rawTask as Pick<Task, 'title' | 'points'> | null) ?? null);

    return {
      ...(row as unknown as TaskCompletionWithDetails),
      profiles: profileObj,
      tasks: taskObj,
    };
  };

  const fetchInitial = useCallback(
    async (silent = false) => {
      if (!groupId) return;
      if (!silent) setLoading(true);

      try {
        const [groupRes, rankingRes, completionsRes] = await Promise.all([
          supabase.from('groups').select('*').eq('id', groupId).single(),
          supabase
            .from('group_ranking')
            .select('*')
            .eq('group_id', groupId)
            .order('total_points', { ascending: false })
            .order('completed_count', { ascending: false }),
          supabase
            .from('task_completions')
            .select(
              '*, profiles(display_name, avatar_url), tasks(title, points)'
            )
            .eq('group_id', groupId)
            .order('completed_at', { ascending: false })
            .range(0, PAGE_SIZE - 1),
        ]);

        if (!groupRes.error && groupRes.data) {
          setGroup(groupRes.data as Group);
        }
        if (!rankingRes.error && rankingRes.data) {
          setRanking(rankingRes.data as GroupRankingRow[]);
        }
        if (!completionsRes.error && completionsRes.data) {
          const normalized = completionsRes.data.map((r) =>
            normalizeCompletionRow(r as Record<string, unknown>)
          );
          setCompletions(normalized);
          setHasMore(normalized.length === PAGE_SIZE);
        }
      } finally {
        setLoading(false);
      }
    },
    [groupId]
  );

  useEffect(() => {
    void fetchInitial(false);
  }, [fetchInitial]);

  useEffect(() => {
    if (!groupId) return;

    const scheduleRefresh = () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        void fetchInitial(true);
      }, 150);
    };

    const channel = supabase
      .channel(`ranking-detail-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_completions',
          filter: `group_id=eq.${groupId}`,
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [fetchInitial, groupId]);

  const handleLoadMore = async () => {
    if (!groupId || loadingMore) return;
    setLoadingMore(true);
    try {
      const start = completions.length;
      const end = start + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('task_completions')
        .select('*, profiles(display_name, avatar_url), tasks(title, points)')
        .eq('group_id', groupId)
        .order('completed_at', { ascending: false })
        .range(start, end);

      if (!error && data) {
        const normalized = data.map((r) =>
          normalizeCompletionRow(r as Record<string, unknown>)
        );
        setCompletions((prev) => [...prev, ...normalized]);
        setHasMore(normalized.length === PAGE_SIZE);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="text-sm">Carregando ranking e histórico...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-safe min-h-dvh bg-zinc-950">
      <header className="pt-safe-header sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 px-4 pb-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            to={`/groups/${groupId}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
            aria-label="Voltar ao grupo"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-zinc-100">
              Ranking Detalhado
            </h1>
            {group && (
              <p className="truncate text-xs text-zinc-400">{group.name}</p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-5">
        <section className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Trophy className="h-4 w-4 text-amber-400" />
            Placar Completo
          </div>

          {ranking.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
              Nenhum membro pontuou ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {ranking.map((row, idx) => {
                const isFirst = idx === 0;
                return (
                  <div
                    key={row.user_id}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
                      isFirst
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-zinc-800 bg-zinc-900/90'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                        isFirst
                          ? 'bg-amber-400 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      #{idx + 1}
                    </div>

                    <Avatar
                      src={row.avatar_url}
                      name={row.display_name}
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-zinc-100">
                        {row.display_name}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {row.completed_count}{' '}
                        {row.completed_count === 1
                          ? 'tarefa concluída'
                          : 'tarefas concluídas'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-base font-extrabold ${
                          isFirst ? 'text-amber-300' : 'text-emerald-400'
                        }`}
                      >
                        {row.total_points}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                        pts
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Award className="h-4 w-4 text-emerald-400" />
            Feed de Conclusões
          </div>

          {completions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center text-sm text-zinc-400">
              Nenhuma conclusão registrada neste grupo ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {completions.map((item) => {
                const memberName = item.profiles?.display_name ?? 'Membro';
                const taskTitle = item.tasks?.title ?? 'Tarefa';
                const isValid = item.validation_status === 'valid';
                const isRejected = item.validation_status === 'rejected';

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar
                          src={item.profiles?.avatar_url}
                          name={memberName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-100">
                            {memberName}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {formatDateTimeBR(item.completed_at)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold ${
                          isValid
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        +{item.points_awarded} pts
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-200">
                        {taskTitle}
                      </p>

                      {isValid ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Validada
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                          <XCircle className="h-3 w-3" />
                          Recusada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                          <AlertTriangle className="h-3 w-3" />
                          Em revisão
                        </span>
                      )}
                    </div>

                    {item.evidence_type === 'audio' ? (
                      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-2.5">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                          <Mic className="h-3.5 w-3.5 text-emerald-400" />
                          Prova em áudio
                        </div>
                        <audio
                          controls
                          preload="metadata"
                          src={item.evidence_url}
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxPhoto({
                            url: item.evidence_url,
                            memberName,
                            taskTitle,
                            completedAt: item.completed_at,
                            validationStatus: item.validation_status,
                          })
                        }
                        className="group relative mt-3 block w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
                      >
                        <img
                          src={item.evidence_url}
                          alt={`Prova de ${memberName}`}
                          loading="lazy"
                          className="max-h-56 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                        <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-medium text-zinc-100 backdrop-blur-sm">
                          <Maximize2 className="h-3 w-3" />
                          Ampliar foto
                        </span>
                      </button>
                    )}
                  </article>
                );
              })}

              {hasMore && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void handleLoadMore()}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  Carregar mais conclusões
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      <PhotoLightbox
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
      />
    </div>
  );
}
