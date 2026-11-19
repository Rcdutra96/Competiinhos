import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, Trophy, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sanitizeFileExt } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateGroupModal({
  open,
  onClose,
  onCreated,
}: CreateGroupModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prizeText, setPrizeText] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  if (!open) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrizeText('');
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const trimmedPrize = prizeText.trim();

    if (!trimmedName || !trimmedPrize) {
      showToast('Preencha o nome do grupo e o prêmio combinado.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      let avatarUrl: string | null = null;

      if (avatarFile) {
        const ext = sanitizeFileExt(avatarFile.name, 'jpg');
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('group-avatars')
          .upload(path, avatarFile, {
            contentType: avatarFile.type || 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Erro ao enviar foto: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('group-avatars')
          .getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }

      const groupId = crypto.randomUUID();

      const { error: groupError } = await supabase.from('groups').insert({
        id: groupId,
        name: trimmedName,
        description: trimmedDesc || null,
        avatar_url: avatarUrl,
        prize_text: trimmedPrize,
        created_by: user.id,
      });

      if (groupError) {
        throw new Error(`Erro ao criar grupo: ${groupError.message}`);
      }

      const nowIso = new Date().toISOString();
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: user.id,
          role: 'admin',
          prize_accepted_at: nowIso,
        });

      if (memberError) {
        if (memberError.code === '23505') {
          const { error: updateErr } = await supabase
            .from('group_members')
            .update({ prize_accepted_at: nowIso })
            .eq('group_id', groupId)
            .eq('user_id', user.id);
          if (updateErr) {
            throw new Error(
              `Erro ao registrar participação: ${updateErr.message}`
            );
          }
        } else {
          throw new Error(
            `Erro ao registrar participação: ${memberError.message}`
          );
        }
      }

      showToast('Grupo criado com sucesso!', 'success');
      resetForm();
      onCreated?.();
      onClose();
      navigate(`/groups/${groupId}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível criar o grupo.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="pb-safe max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-100">Criar novo grupo</h2>
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
          <div className="flex items-center gap-4">
            <label className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 text-zinc-400 transition-colors hover:border-emerald-500/60 hover:text-emerald-400">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Pré-visualização do grupo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-center">
                  <Camera className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Foto</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
            <div className="flex-1 text-xs text-zinc-400">
              <p className="font-medium text-zinc-200">Foto do grupo</p>
              <p className="mt-0.5">
                Opcional. Toque no quadrado para escolher uma imagem.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="group-name"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Nome do grupo *
            </label>
            <input
              id="group-name"
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Projeto Verão 2026"
              className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="group-description"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Descrição
            </label>
            <textarea
              id="group-description"
              rows={2}
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Regras gerais ou objetivo do desafio"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5">
            <label
              htmlFor="group-prize"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300"
            >
              <Trophy className="h-3.5 w-3.5" />
              Prêmio combinado *
            </label>
            <textarea
              id="group-prize"
              required
              rows={2}
              maxLength={300}
              value={prizeText}
              onChange={(e) => setPrizeText(e.target.value)}
              placeholder="Ex.: Quem ficar em último paga um rodízio para o vencedor"
              className="w-full rounded-xl border border-amber-500/20 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400"
            />
            <p className="mt-1.5 text-[11px] text-zinc-400">
              Todos os novos membros precisam concordar com este prêmio antes de
              entrar.
            </p>
          </div>

          <div className="flex gap-2.5 pt-1">
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
              Criar grupo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
