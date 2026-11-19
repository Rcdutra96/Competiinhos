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
import {
  compressImageFile,
  compressVideoFrame,
  type CompressedImageResult,
} from '../lib/imageCompression';
import type { EvidenceType, Group, Task, ValidationStatus } from '../lib/types';
import { getTodayLocalDate } from '../lib/utils';
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

const AUDIO_MIME_CANDIDATES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg',
] as const;

function pickSupportedAudioMimeType(): string {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return '';
  }

  for (const candidate of AUDIO_MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // Ignora erro de verificação em navegadores restritos
    }
  }

  return '';
}

function resolveAudioFileMeta(rawMime: string): {
  ext: string;
  contentType: string;
} {
  const lower = rawMime.toLowerCase();
  const baseMime = lower.split(';')[0]?.trim() || '';

  if (lower.includes('mp4') || lower.includes('aac') || lower.includes('m4a')) {
    return { ext: 'm4a', contentType: baseMime || 'audio/mp4' };
  }
  if (lower.includes('ogg')) {
    return { ext: 'ogg', contentType: baseMime || 'audio/ogg' };
  }
  return { ext: 'webm', contentType: baseMime || 'audio/webm' };
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function describeMediaError(
  err: unknown,
  deviceLabel: 'câmera' | 'microfone'
): string {
  const name = err instanceof Error ? err.name : '';
  const msg = err instanceof Error ? err.message.toLowerCase() : '';

  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    msg.includes('permission') ||
    msg.includes('denied')
  ) {
    return `Permissão de ${deviceLabel} bloqueada. Libere o acesso nas configurações do navegador (ícone de cadeado na barra de endereço ou Ajustes do sistema).`;
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return `Nenhum(a) ${deviceLabel} foi encontrado(a) neste aparelho.`;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return `O(a) ${deviceLabel} está em uso por outro aplicativo. Feche outros apps e tente novamente.`;
  }
  return `Não foi possível iniciar o(a) ${deviceLabel}. Verifique as permissões do navegador.`;
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

  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturingFrame, setCapturingFrame] = useState(false);

  const [capturedImage, setCapturedImage] =
    useState<CompressedImageResult | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [exifTimestamp, setExifTimestamp] = useState<string | null>(null);
  const [exifNotice, setExifNotice] = useState<{
    status: ValidationStatus;
    message: string;
  } | null>(null);
  const [processingGallery, setProcessingGallery] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioMimeInfo, setAudioMimeInfo] = useState<{
    contentType: string;
    ext: string;
  }>({ contentType: 'audio/webm', ext: 'webm' });

  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  const mountedRef = useRef(true);
  const openRef = useRef(open);
  const prevOpenRef = useRef(open);
  const prevTaskIdRef = useRef<string | null>(task?.id ?? null);

  openRef.current = open;

  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      for (const track of cameraStreamRef.current.getTracks()) {
        track.stop();
      }
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  const stopAudioMedia = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignora erro se recorder já encerrou
      }
    }
    mediaRecorderRef.current = null;
    if (audioStreamRef.current) {
      for (const track of audioStreamRef.current.getTracks()) {
        track.stop();
      }
      audioStreamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const resetEvidenceState = useCallback(() => {
    stopCameraStream();
    stopAudioMedia();
    setCameraError(null);
    setCapturingFrame(false);
    setCapturedImage(null);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setExifTimestamp(null);
    setExifNotice(null);
    setProcessingGallery(false);
    setAudioBlob(null);
    setAudioPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRecordingSeconds(0);
  }, [stopAudioMedia, stopCameraStream]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCameraStream();
      stopAudioMedia();
    };
  }, [stopAudioMedia, stopCameraStream]);

  // Só limpa o estado interno quando o modal realmente fecha ou troca de tarefa.
  // Atualizações de objeto via Realtime ou foco não limpam o formulário.
  useEffect(() => {
    const currentTaskId = task?.id ?? null;
    const wasOpen = prevOpenRef.current;
    const prevTaskId = prevTaskIdRef.current;

    if ((wasOpen && !open) || (open && currentTaskId !== prevTaskId)) {
      resetEvidenceState();
      if (!open) {
        setMode('camera');
      }
    }

    prevOpenRef.current = open;
    prevTaskIdRef.current = currentTaskId;
  }, [open, resetEvidenceState, task?.id]);

  // Vincula o MediaStream ao <video> assim que o viewfinder é montado
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !cameraStreamRef.current) return;
    const videoEl = videoRef.current;
    videoEl.srcObject = cameraStreamRef.current;
    void videoEl.play().catch(() => {
      // Alguns navegadores já iniciam com autoPlay/playsInline
    });
  }, [cameraActive]);

  if (!open || !task || !user) return null;

  const handleModeSwitch = (nextMode: EvidenceMode) => {
    if (submitting || nextMode === mode) return;
    resetEvidenceState();
    setMode(nextMode);
  };

  // Chamada síncrona dentro do gesto do usuário para compatibilidade mobile
  const handleStartCamera = () => {
    if (cameraStarting || cameraActive || submitting) return;
    setCameraError(null);

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      const msg =
        'Câmera ao vivo indisponível neste navegador ou contexto sem HTTPS. Use a aba Galeria.';
      setCameraError(msg);
      showToast(msg, 'error');
      return;
    }

    setCameraStarting(true);

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      .then((stream) => {
        if (!mountedRef.current || !openRef.current) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }
        cameraStreamRef.current = stream;
        setCameraStarting(false);
        setCameraActive(true);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setCameraStarting(false);
        setCameraActive(false);
        const msg = describeMediaError(err, 'câmera');
        setCameraError(msg);
        showToast(msg, 'error');
      });
  };

  const handleCapturePhoto = async () => {
    const videoEl = videoRef.current;
    if (!videoEl || capturingFrame) return;

    setCapturingFrame(true);
    try {
      const compressed = await compressVideoFrame(videoEl, 1080);
      stopCameraStream();

      setPhotoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressed.blob);
      });
      setCapturedImage(compressed);
      setExifTimestamp(new Date().toISOString());
      setExifNotice({
        status: 'valid',
        message: 'Foto capturada na câmera ao vivo — validada automaticamente.',
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível capturar a foto.';
      showToast(msg, 'error');
    } finally {
      setCapturingFrame(false);
    }
  };

  const handleGalleryChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingGallery(true);
    setExifNotice(null);
    setExifTimestamp(null);

    let nextExifTimestamp: string | null = null;
    let nextNotice: { status: ValidationStatus; message: string };

    // Ordem obrigatória: ler EXIF no arquivo original ANTES da compressão em canvas
    try {
      const exifData = (await exifr.parse(file, ['DateTimeOriginal'])) as
        | { DateTimeOriginal?: unknown }
        | undefined;
      const rawDto = exifData?.DateTimeOriginal;

      if (!rawDto) {
        nextNotice = {
          status: 'pending_review',
          message:
            'Foto sem metadados EXIF (DateTimeOriginal). Será enviada para revisão (pending_review) e não somará pontos imediatamente.',
        };
      } else {
        const dtoDate =
          rawDto instanceof Date ? rawDto : new Date(String(rawDto));

        if (Number.isNaN(dtoDate.getTime())) {
          nextNotice = {
            status: 'pending_review',
            message:
              'Data EXIF inválida nesta foto. Será enviada para revisão (pending_review).',
          };
        } else {
          nextExifTimestamp = dtoDate.toISOString();
          const diffMs = Math.abs(Date.now() - dtoDate.getTime());
          const diffMinutes = Math.round(diffMs / 60_000);
          const toleranceMinutes = group.exif_tolerance_minutes;

          if (diffMs <= toleranceMinutes * 60_000) {
            nextNotice = {
              status: 'valid',
              message: `EXIF válido (${diffMinutes} min de diferença; limite de ${toleranceMinutes} min).`,
            };
          } else {
            nextNotice = {
              status: 'pending_review',
              message: `Foto tirada há ${diffMinutes} min (limite do grupo: ${toleranceMinutes} min). Será salva como pendente de revisão.`,
            };
          }
        }
      }
    } catch {
      nextNotice = {
        status: 'pending_review',
        message:
          'Não foi possível ler os dados EXIF desta foto. Será enviada como pendente de revisão.',
      };
    }

    try {
      const compressed = await compressImageFile(file, 1080);
      setPhotoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressed.blob);
      });
      setCapturedImage(compressed);
      setExifTimestamp(nextExifTimestamp);
      setExifNotice(nextNotice);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível processar a imagem da galeria.';
      showToast(msg, 'error');
    } finally {
      setProcessingGallery(false);
      e.target.value = '';
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
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignora erro caso já parado
      }
    }
    setIsRecording(false);
  };

  // Handler NÃO-async: getUserMedia precisa ser a primeira chamada síncrona no gesto do iOS Safari
  const handleStartRecording = () => {
    if (isRecording || submitting) return;

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      showToast(
        'Gravação de áudio não é suportada neste navegador ou requer conexão HTTPS.',
        'error'
      );
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (!mountedRef.current || !openRef.current) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        audioStreamRef.current = stream;

        const preferredMime = pickSupportedAudioMimeType();
        let recorder: MediaRecorder;
        if (preferredMime) {
          try {
            recorder = new MediaRecorder(stream, { mimeType: preferredMime });
          } catch {
            recorder = new MediaRecorder(stream);
          }
        } else {
          recorder = new MediaRecorder(stream);
        }

        chunksRef.current = [];
        setAudioBlob(null);
        setAudioPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const firstChunkType =
            chunksRef.current[0] instanceof Blob
              ? chunksRef.current[0].type
              : '';
          const resolvedMime =
            recorder.mimeType || firstChunkType || preferredMime || '';
          const meta = resolveAudioFileMeta(resolvedMime);
          const blob = new Blob(chunksRef.current, { type: meta.contentType });

          if (audioStreamRef.current) {
            for (const track of audioStreamRef.current.getTracks()) {
              track.stop();
            }
            audioStreamRef.current = null;
          }

          if (!mountedRef.current) return;

          if (blob.size > 0) {
            setAudioMimeInfo(meta);
            setAudioBlob(blob);
            setAudioPreviewUrl(URL.createObjectURL(blob));
          } else {
            showToast(
              'O áudio gravado ficou vazio. Tente gravar novamente.',
              'warning'
            );
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
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
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        showToast(describeMediaError(err, 'microfone'), 'error');
      });
  };

  const handleSubmit = async () => {
    if (mode !== 'audio' && !capturedImage) {
      showToast('Tire uma foto ou escolha da galeria como evidência.', 'warning');
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
      let uploadBody: Blob;
      let contentType = '';

      if (mode === 'audio' && audioBlob) {
        storagePath = `${user.id}/${group.id}/${timestamp}-${rand}.${audioMimeInfo.ext}`;
        uploadBody = audioBlob;
        contentType = audioMimeInfo.contentType;
      } else if (capturedImage) {
        storagePath = `${user.id}/${group.id}/${timestamp}-${rand}.${capturedImage.extension}`;
        uploadBody = capturedImage.blob;
        contentType = capturedImage.contentType;
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

      const evidenceType: EvidenceType = mode === 'audio' ? 'audio' : 'image';

      const { error: insertError } = await supabase
        .from('task_completions')
        .insert({
          group_id: group.id,
          task_id: task.id,
          user_id: user.id,
          completion_date: getTodayLocalDate(),
          evidence_type: evidenceType,
          evidence_url: publicUrlData.publicUrl,
          exif_timestamp: mode === 'audio' ? null : exifTimestamp,
          validation_status: validationStatus,
          points_awarded: validationStatus === 'valid' ? task.points : 0,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          showToast('Você já concluiu esta tarefa neste período!', 'warning');
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
    !processingGallery &&
    !capturingFrame &&
    !cameraActive &&
    !isRecording &&
    ((mode !== 'audio' && capturedImage !== null) ||
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
              if (!submitting) {
                stopCameraStream();
                stopAudioMedia();
                onClose();
              }
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
            {cameraActive ? (
              <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black p-2.5">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="aspect-[3/4] max-h-72 w-full rounded-xl bg-black object-cover"
                />
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    disabled={capturingFrame}
                    onClick={stopCameraStream}
                    className="min-h-[46px] flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={capturingFrame}
                    onClick={() => void handleCapturePhoto()}
                    className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {capturingFrame ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    Capturar
                  </button>
                </div>
              </div>
            ) : photoPreviewUrl && capturedImage ? (
              <div className="space-y-2.5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                <img
                  src={photoPreviewUrl}
                  alt="Prévia da foto capturada"
                  className="max-h-64 w-full rounded-xl object-contain"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                    Foto otimizada: {capturedImage.formattedSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCapturedImage(null);
                      setExifTimestamp(null);
                      setExifNotice(null);
                      setPhotoPreviewUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return null;
                      });
                      handleStartCamera();
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Tirar outra foto
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-center">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  {cameraStarting ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6" />
                  )}
                </div>
                <p className="text-sm font-semibold text-zinc-200">
                  Câmera integrada no app
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Fotos tiradas ao vivo são otimizadas e validadas
                  automaticamente
                </p>
                <button
                  type="button"
                  disabled={cameraStarting}
                  onClick={handleStartCamera}
                  className="mt-3.5 flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  <Camera className="h-4 w-4" />
                  {cameraStarting ? 'Abrindo câmera...' : 'Tirar Foto'}
                </button>
              </div>
            )}

            {cameraError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <p>{cameraError}</p>
              </div>
            )}
          </div>
        )}

        {mode === 'gallery' && (
          <div className="space-y-3">
            <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-center transition-colors hover:border-amber-500/60">
              {photoPreviewUrl && capturedImage ? (
                <div className="w-full space-y-2.5">
                  <img
                    src={photoPreviewUrl}
                    alt="Prévia da galeria"
                    className="max-h-64 w-full rounded-xl object-contain"
                  />
                  <div className="flex justify-center">
                    <span className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                      Foto otimizada: {capturedImage.formattedSize}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-400">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-200">
                    Escolher da Galeria
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

            {processingGallery && (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-300">
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                Lendo metadados EXIF e otimizando imagem...
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
                {formatTimer(recordingSeconds)} /{' '}
                {formatTimer(MAX_AUDIO_SECONDS)}
              </span>
            </div>

            {!isRecording && !audioPreviewUrl && (
              <button
                type="button"
                onClick={handleStartRecording}
                className="mx-auto flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
              >
                <Mic className="h-4 w-4" />
                Gravar Áudio
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
                <audio controls src={audioPreviewUrl} className="w-full" />
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
            onClick={() => {
              stopCameraStream();
              stopAudioMedia();
              onClose();
            }}
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
