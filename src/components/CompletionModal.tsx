import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import exifr from 'exifr';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Mic,
  RotateCcw,
  Square,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Group, Task, ValidationStatus } from '../lib/types';
import { getTodayLocalDate, sanitizeFileExt } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface CompletionModalProps {
  open: boolean;
  group: Group;
  task: Task | null;
  onClose: () => void;
  onCompleted?: () => void;
}

type EvidenceMode = 'camera' | 'gallery' | 'audio';

const MAX_AUDIO_SECONDS = 60;

function pickSupportedAudioMimeType(): { mimeType: string; ext: string } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: '', ext: 'webm' };
  }

  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
    { mimeType: 'audio/webm', ext: 'webm' },
    { mimeType: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' },
    { mimeType: 'audio/mp4', ext: 'm4a' },
    { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg' },
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return { mimeType: '', ext: 'webm' };
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function CompletionModal({
  open,
  group,
  task,
  onClose,
  onCompleted,
}: CompletionModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<EvidenceMode>('camera');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [exifTimestamp, setExifTimestamp] = useState<string | null>(null);
  const [exifNotice, setExifNotice] = useState<{
    status: ValidationStatus;
    message: string;
  } | null>(null);
  const [parsingExif, setParsingExif] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioMimeInfo, setAudioMimeInfo] = useState<{
    mimeType: string;
    ext: string;
  }>({ mimeType: 'audio/webm', ext: 'webm' });

  const [submitting, setSubmitting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  const cleanupMedia = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const resetAll = useCallback(() => {
    cleanupMedia();
    setPhotoFile(null);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setExifTimestamp(null);
    setExifNotice(null);
    setParsingExif(false);
    setAudioBlob(null);
    setAudioPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRecordingSeconds(0);
  }, [cleanupMedia]);

  useEffect(() => {
    if (!open) {
      resetAll();
      setMode('camera');
    }
  }, [open, resetAll]);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  if (!open || !task || !user) return null;

  const handleModeSwitch = (nextMode: EvidenceMode) => {
    if (submitting || nextMode === mode) return;
    resetAll();
    setMode(nextMode);
  };

  const handleCameraChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setExifTimestamp(new Date().toISOString());
    setExifNotice({
      status: 'valid',
      message: 'Foto capturada na câmera ao vivo — validada automaticamente.',
    });
  };

  const handleGalleryChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setParsingExif(true);
    setExifNotice(null);
    setExifTimestamp(null);

    try {
      const exifData = (await exifr.parse(file, ['DateTimeOriginal'])) as
        | { DateTimeOriginal?: unknown }
        | undefined;
      const rawDto = exifData?.DateTimeOriginal;

      if (!rawDto) {
        setExifTimestamp(null);
        setExifNotice({
          status: 'pending_review',
          message:
            'Foto sem metadados EXIF (DateTimeOriginal). Será enviada para revisão (pending_review) e não somará pontos imediatamente.',
        });
        return;
      }

      const dtoDate =
        rawDto instanceof Date ? rawDto : new Date(String(rawDto));

      if (Number.isNaN(dtoDate.getTime())) {
        setExifTimestamp(null);
        setExifNotice({
          status: 'pending_review',
          message:
            'Data EXIF inválida nesta foto. Será enviada para revisão (pending_review).',
        });
        return;
      }

      const isoDto = dtoDate.toISOString();
      setExifTimestamp(isoDto);

      const diffMs = Math.abs(Date.now() - dtoDate.getTime());
      const diffMinutes = Math.round(diffMs / 60_000);
      const toleranceMinutes = group.exif_tolerance_minutes;

      if (diffMs <= toleranceMinutes * 60_000) {
        setExifNotice({
          status: 'valid',
          message: `EXIF válido (${diffMinutes} min de diferença; limite de ${toleranceMinutes} min).`,
        });
      } else {
        setExifNotice({
          status: 'pending_review',
          message: `Foto tirada há ${diffMinutes} min (limite do grupo: ${toleranceMinutes} min). Será salva como pendente de revisão.`,
        });
      }
    } catch {
      setExifTimestamp(null);
      setExifNotice({
        status: 'pending_review',
        message:
          'Não foi possível ler os dados EXIF desta foto. Será enviada como pendente de revisão.',
      });
    } finally {
      setParsingExif(false);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const startRecording = async () => {
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      showToast(
        'Gravação de áudio não é suportada neste navegador.',
        'error'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const picked = pickSupportedAudioMimeType();
      const recorder = picked.mimeType
        ? new MediaRecorder(stream, { mimeType: picked.mimeType })
        : new MediaRecorder(stream);

      const actualMime =
        recorder.mimeType || picked.mimeType || 'audio/webm';
      const actualExt = actualMime.includes('mp4')
        ? 'm4a'
        : actualMime.includes('ogg')
          ? 'ogg'
          : picked.ext;

      setAudioMimeInfo({ mimeType: actualMime, ext: actualExt });
      chunksRef.current = [];
      setAudioBlob(null);
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: actualMime });
        if (blob.size > 0) {
          setAudioBlob(blob);
          setAudioPreviewUrl(URL.createObjectURL(blob));
        }
        if (mediaStreamRef.current) {
          for (const track of mediaStreamRef.current.getTracks()) {
            track.stop();
          }
          mediaStreamRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_AUDIO_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      showToast(
        'Permissão de microfone negada ou dispositivo indisponível.',
        'error'
      );
    }
  };

  const handleSubmit = async () => {
    if (mode !== 'audio' && !photoFile) {
      showToast('Selecione ou tire uma foto como evidência.', 'warning');
      return;
    }
    if (mode === 'audio' && !audioBlob) {
      showToast('Grave um áudio antes de concluir a tarefa.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const rand = Math.random().toString(36).slice(2, 8);
      const timestamp = Date.now();
      let storagePath = '';
      let uploadBody: File | Blob;
      let contentType = '';

      if (mode === 'audio' && audioBlob) {
        storagePath = `${user.id}/${group.id}/${timestamp}-${rand}.${audioMimeInfo.ext}`;
        uploadBody = audioBlob;
        contentType = audioMimeInfo.mimeType || 'audio/webm';
      } else if (photoFile) {
        const ext = sanitizeFileExt(photoFile.name, 'jpg');
        storagePath = `${user.id}/${group.id}/${timestamp}-${rand}.${ext}`;
        uploadBody = photoFile;
        contentType = photoFile.type || 'image/jpeg';
      } else {
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from('evidences')
        .upload(storagePath, uploadBody, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        showToast(`Falha ao enviar prova: ${uploadError.message}`, 'error');
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('evidences')
        .getPublicUrl(storagePath);

      const validationStatus: ValidationStatus =
        mode === 'gallery'
          ? (exifNotice?.status ?? 'pending_review')
          : 'valid';

      const { error: insertError } = await supabase
        .from('task_completions')
        .insert({
          group_id: group.id,
          task_id: task.id,
          user_id: user.id,
          completion_date: getTodayLocalDate(),
          evidence_type: mode === 'audio' ? 'audio' : 'photo',
          evidence_url: publicUrlData.publicUrl,
          exif_timestamp: mode === 'audio' ? null : exifTimestamp,
          validation_status: validationStatus,
          points_awarded: validationStatus === 'valid' ? task.points : 0,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          showToast('Você já concluiu esta tarefa hoje!', 'warning');
        } else {
          showToast(
            `Erro ao registrar conclusão: ${insertError.message}`,
            'error'
          );
        }
        return;
      }

      if (validationStatus === 'valid') {
        showToast(
          `Tarefa concluída! +${task.points} pts adicionados.`,
          'success'
        );
      } else {
        showToast(
          'Prova enviada para revisão (sem pontuação imediata).',
          'warning'
        );
      }

      onCompleted?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    !parsingExif &&
    !isRecording &&
    ((mode !== 'audio' && photoFile !== null) ||
      (mode === 'audio' && audioBlob !== null));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="pb-safe max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
              +{task.points} pts
            </span>
            <h2 className="mt-1.5 text-lg font-bold text-zinc-100">
              {task.title}
            </h2>
            {task.description && (
              <p className="mt-0.5 text-xs text-zinc-400">{task.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!submitting) onClose();
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => handleModeSwitch('camera')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
              mode === 'camera'
                ? 'bg-zinc-800 text-emerald-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Camera className="h-4 w-4" />
            Câmera
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('gallery')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
              mode === 'gallery'
                ? 'bg-zinc-800 text-amber-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Galeria
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('audio')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
              mode === 'audio'
                ? 'bg-zinc-800 text-emerald-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mic className="h-4 w-4" />
            Áudio
          </button>
        </div>

        {mode === 'camera' && (
          <div className="space-y-3">
            <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-center transition-colors hover:border-emerald-500/60">
              {photoPreviewUrl ? (
                <img
                  src={photoPreviewUrl}
                  alt="Prévia da foto"
                  className="max-h-64 w-full rounded-xl object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-400">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                    <Camera className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-200">
                    Abrir câmera e tirar foto
                  </p>
                  <p className="text-xs text-zinc-500">
                    Fotos tiradas na hora são validadas automaticamente
                  </p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraChange}
                className="sr-only"
              />
            </label>
          </div>
        )}

        {mode === 'gallery' && (
          <div className="space-y-3">
            <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-center transition-colors hover:border-amber-500/60">
              {photoPreviewUrl ? (
                <img
                  src={photoPreviewUrl}
                  alt="Prévia da galeria"
                  className="max-h-64 w-full rounded-xl object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-400">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-200">
                    Escolher foto da galeria
                  </p>
                  <p className="text-xs text-zinc-500">
                    Tolerância EXIF do grupo: {group.exif_tolerance_minutes}{' '}
                    minutos
                  </p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void handleGalleryChange(e)}
                className="sr-only"
              />
            </label>

            {parsingExif && (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-300">
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                Verificando data original (EXIF) da imagem...
              </div>
            )}
          </div>
        )}

        {mode === 'audio' && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-center">
            <div className="mb-3 flex items-center justify-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isRecording
                    ? 'animate-pulse bg-rose-500'
                    : audioBlob
                      ? 'bg-emerald-400'
                      : 'bg-zinc-600'
                }`}
              />
              <span className="font-mono text-xl font-bold text-zinc-100">
                {formatTimer(recordingSeconds)} / {formatTimer(MAX_AUDIO_SECONDS)}
              </span>
            </div>

            {!isRecording && !audioPreviewUrl && (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="mx-auto flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
              >
                <Mic className="h-4 w-4" />
                Iniciar gravação
              </button>
            )}

            {isRecording && (
              <button
                type="button"
                onClick={stopRecording}
                className="mx-auto flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 text-sm font-semibold text-white hover:bg-rose-400"
              >
                <Square className="h-4 w-4 fill-current" />
                Parar gravação
              </button>
            )}

            {audioPreviewUrl && !isRecording && (
              <div className="space-y-3">
                <audio
                  controls
                  src={audioPreviewUrl}
                  className="w-full"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
                    setAudioPreviewUrl(null);
                    setAudioBlob(null);
                    setRecordingSeconds(0);
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Regravar áudio
                </button>
              </div>
            )}

            <p className="mt-3 text-[11px] text-zinc-500">
              Áudios ao vivo de até {MAX_AUDIO_SECONDS}s são salvos como prova
              válida.
            </p>
          </div>
        )}

        {exifNotice && (
          <div
            className={`mt-3 flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed ${
              exifNotice.status === 'valid'
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            }`}
          >
            {exifNotice.status === 'valid' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            )}
            <p>{exifNotice.message}</p>
          </div>
        )}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[48px] flex-1 rounded-xl border border-zinc-700 bg-zinc-800/70 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Concluir tarefa
          </button>
        </div>
      </div>
    </div>
  );
}
