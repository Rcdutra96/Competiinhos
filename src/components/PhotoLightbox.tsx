import { useEffect } from 'react';
import { X } from 'lucide-react';
import { formatDateTimeBR } from '../lib/utils';

export interface LightboxPhoto {
  url: string;
  memberName: string;
  taskTitle: string;
  completedAt: string;
  validationStatus: string;
}

interface PhotoLightboxProps {
  photo: LightboxPhoto | null;
  onClose: () => void;
}

export function PhotoLightbox({ photo, onClose }: PhotoLightboxProps) {
  useEffect(() => {
    if (!photo) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, photo]);

  if (!photo) return null;

  return (
    <div
      onClick={onClose}
      className="pt-safe pb-safe fixed inset-0 z-50 flex flex-col justify-between bg-black/95 p-4 backdrop-blur-sm"
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-100 hover:bg-zinc-800"
          aria-label="Fechar imagem"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-1 items-center justify-center py-3"
      >
        <img
          src={photo.url}
          alt={`Prova de ${photo.memberName}: ${photo.taskTitle}`}
          className="max-h-[72dvh] max-w-full rounded-2xl border border-zinc-800 object-contain shadow-2xl"
        />
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/95 p-3.5 text-xs"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-zinc-100">{photo.memberName}</span>
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              photo.validationStatus === 'valid'
                ? 'bg-emerald-500/15 text-emerald-300'
                : photo.validationStatus === 'rejected'
                  ? 'bg-rose-500/15 text-rose-300'
                  : 'bg-amber-500/15 text-amber-300'
            }`}
          >
            {photo.validationStatus === 'valid'
              ? 'Validada'
              : photo.validationStatus === 'rejected'
                ? 'Recusada'
                : 'Em revisão'}
          </span>
        </div>
        <p className="mt-1 text-zinc-300">{photo.taskTitle}</p>
        <p className="mt-0.5 text-zinc-500">
          {formatDateTimeBR(photo.completedAt)}
        </p>
      </div>
    </div>
  );
}
