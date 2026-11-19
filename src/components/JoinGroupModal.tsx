import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

interface JoinGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export function JoinGroupModal({ open, onClose }: JoinGroupModalProps) {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    if (submitting) return;
    setInviteCode('');
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = inviteCode.trim().toLowerCase();
    if (!cleaned) {
      showToast('Digite o código de convite do grupo.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('join_group_by_code', {
        p_invite_code: cleaned,
      });

      if (error) {
        const lower = error.message.toLowerCase();
        if (lower.includes('not found') || lower.includes('invalid')) {
          showToast('Código de convite inválido ou não encontrado.', 'error');
        } else {
          showToast(`Erro ao entrar no grupo: ${error.message}`, 'error');
        }
        return;
      }

      const groupId =
        typeof data === 'string'
          ? data
          : Array.isArray(data)
            ? (data[0] as { group_id?: string } | string | undefined)
            : (data as { group_id?: string } | null)?.group_id;

      const resolvedId =
        typeof groupId === 'string' ? groupId : groupId?.group_id;

      if (!resolvedId) {
        showToast('Grupo não retornado pelo servidor.', 'error');
        return;
      }

      showToast('Você entrou no grupo!', 'success');
      setInviteCode('');
      onClose();
      navigate(`/groups/${resolvedId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="pb-safe w-full max-w-lg rounded-t-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-100">Entrar por código</h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="invite-code"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
              Código de convite
            </label>
            <input
              id="invite-code"
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Ex.: a1b2c3d4"
              className="min-h-[48px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 font-mono text-base tracking-wider text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleClose}
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
              Entrar no grupo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
