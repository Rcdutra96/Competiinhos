import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Group, GroupMember } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { PrizeAgreement } from '../pages/PrizeAgreement';

export function GroupGuard({ children }: { children: ReactNode }) {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<GroupMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    const loadMembership = async () => {
      if (!groupId || !user) {
        if (active) {
          setNotAllowed(true);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setNotAllowed(false);

      const [memberRes, groupRes] = await Promise.all([
        supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
      ]);

      if (!active) return;

      if (
        memberRes.error ||
        groupRes.error ||
        !memberRes.data ||
        !groupRes.data
      ) {
        setNotAllowed(true);
        setLoading(false);
        return;
      }

      setMembership(memberRes.data as GroupMember);
      setGroup(groupRes.data as Group);
      setLoading(false);
    };

    void loadMembership();

    return () => {
      active = false;
    };
  }, [groupId, user]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="text-sm">Verificando acesso ao grupo...</span>
        </div>
      </div>
    );
  }

  if (notAllowed || !group || !membership) {
    return (
      <div className="pt-safe-header pb-safe flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-zinc-100">
            Grupo não encontrado
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Este grupo não existe ou você não é membro dele.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-zinc-800 px-5 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  if (membership.prize_accepted_at === null) {
    return (
      <PrizeAgreement
        group={group}
        onAccepted={(acceptedAt) =>
          setMembership((prev) =>
            prev ? { ...prev, prize_accepted_at: acceptedAt } : prev
          )
        }
      />
    );
  }

  return <>{children}</>;
}
