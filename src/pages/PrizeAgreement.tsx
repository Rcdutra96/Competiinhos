import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Group } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/Avatar';

interface PrizeAgreementProps {
  group: Group;
  onAccepted: (acceptedAt: string) => void;
}

export function PrizeAgreement({ group, onAccepted }: PrizeAgreementProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('group_members')
        .update({ prize_accepted_at: nowIso })
        .eq('group_id', group.id)
        .eq('user_id', user.id);

      if (error) {
        showToast(`Não foi possível registrar o aceite: ${error.message}`, 'error');
        return;
      }

      showToast('Prêmio aceito! Bem-vindo ao grupo.', 'success');
      onAccepted(nowIso);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-safe-header pb-safe flex min-h-dvh flex-col bg-zinc-950 px-4 py-6">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar aos grupos
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <Avatar src={group.avatar_url} name={group.name} size="xl" />
              <h1 className="mt-4 text-xl font-bold text-zinc-100">
                {group.name}
              </h1>
              {group.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  {group.description}
                </p>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-zinc-950 p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                <Trophy className="h-4 w-4 text-amber-400" />
                Prêmio do Grupo
              </div>
              <p className="text-base font-semibold leading-relaxed text-zinc-100">
                {group.prize_text}
              </p>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 text-xs leading-relaxed text-zinc-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p>
                Para acessar as metas, enviar provas e participar das votações
                deste grupo, você precisa concordar com o prêmio combinado acima.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={submitting}
              className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/15 transition-colors hover:bg-emerald-400 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              Concordo com o prêmio e entrar no grupo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
