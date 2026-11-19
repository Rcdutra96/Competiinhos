import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ChevronRight,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  Trophy,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Group, GroupMembershipWithGroup } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/Avatar';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { JoinGroupModal } from '../components/JoinGroupModal';

export function GroupHub() {
  const { user, profile, signOut } = useAuth();
  const { showToast } = useToast();

  const [memberships, setMemberships] = useState<GroupMembershipWithGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, user_id, role, prize_accepted_at, joined_at, groups(*)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      if (error) {
        showToast(`Erro ao carregar grupos: ${error.message}`, 'error');
        return;
      }

      const normalized: GroupMembershipWithGroup[] = (data ?? []).map((row) => {
        const rawGroup = row.groups as unknown;
        const groupObj = Array.isArray(rawGroup)
          ? ((rawGroup[0] as Group | undefined) ?? null)
          : ((rawGroup as Group | null) ?? null);
        return {
          group_id: row.group_id,
          user_id: row.user_id,
          role: row.role,
          prize_accepted_at: row.prize_accepted_at,
          joined_at: row.joined_at,
          groups: groupObj,
        };
      });

      setMemberships(normalized.filter((m) => m.groups !== null));
    } finally {
      setLoading(false);
    }
  }, [showToast, user]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const displayName =
    profile?.display_name ||
    (user?.user_metadata?.display_name as string | undefined) ||
    'Participante';

  return (
    <div className="pb-safe min-h-dvh bg-zinc-950">
      <header className="pt-safe-header sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 px-4 pb-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={profile?.avatar_url} name={displayName} size="md" />
            <div className="min-w-0">
              <p className="text-xs text-zinc-400">Olá,</p>
              <h1 className="truncate text-base font-bold text-zinc-100">
                {displayName}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            <LogOut className="h-4 w-4 text-zinc-400" />
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4 py-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/15 transition-colors hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Criar Grupo
          </button>

          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
          >
            <KeyRound className="h-4 w-4 text-amber-400" />
            Entrar por Código
          </button>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Meus grupos ({memberships.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 py-14 text-zinc-400">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
              <p className="mt-2.5 text-sm">Buscando seus grupos...</p>
            </div>
          ) : memberships.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400">
                <Users className="h-6 w-6" />
              </div>
              <p className="font-semibold text-zinc-200">
                Você ainda não participa de nenhum grupo
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Crie um grupo com seus amigos ou entre usando um código de
                convite.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {memberships.map((membership) => {
                const group = membership.groups;
                if (!group) return null;
                const needsPrizeAcceptance =
                  membership.prize_accepted_at === null;

                return (
                  <Link
                    key={group.id}
                    to={`/groups/${group.id}`}
                    className="block rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 transition-colors hover:border-zinc-700 active:bg-zinc-900"
                  >
                    <div className="flex items-start gap-3.5">
                      <Avatar
                        src={group.avatar_url}
                        name={group.name}
                        size="lg"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate text-base font-bold text-zinc-100">
                            {group.name}
                          </h3>
                          <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                        </div>

                        {group.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
                            {group.description}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                            <Trophy className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{group.prize_text}</span>
                          </div>

                          {needsPrizeAcceptance && (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-300">
                              <AlertCircle className="h-3 w-3" />
                              Aceitar prêmio
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void loadGroups()}
      />

      <JoinGroupModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}
