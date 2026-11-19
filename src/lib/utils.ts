export function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna a segunda-feira da semana da data local no formato YYYY-MM-DD
 * (mesma lógica do date_trunc('week') do PostgreSQL, semana de segunda a domingo).
 */
export function getStartOfWeekLocalDate(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // 0 para segunda, 6 para domingo
  date.setDate(date.getDate() - diff);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayStr = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayStr}`;
}

/**
 * Retorna o domingo da semana da data local no formato YYYY-MM-DD.
 */
export function getEndOfWeekLocalDate(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff + 6);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayStr = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayStr}`;
}

/**
 * Verifica se a data de conclusão está dentro da semana atual (segunda a domingo).
 */
export function isDateInCurrentWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  const dateOnly = dateStr.slice(0, 10);
  const startOfWeek = getStartOfWeekLocalDate();
  const endOfWeek = getEndOfWeekLocalDate();
  return dateOnly >= startOfWeek && dateOnly <= endOfWeek;
}

export function formatDateTimeBR(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const datePart = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} às ${timePart}`;
}

export function formatRelativeTimeBR(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - parsed) / 1000));

  if (diffSec < 60) return 'agora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `há ${diffHour} h`;
  const diffDay = Math.floor(diffHour / 24);
  return `há ${diffDay} d`;
}

export function formatRecurrence(recurrence: string): string {
  switch (recurrence) {
    case 'daily':
      return 'Diária';
    case 'weekly':
      return 'Semanal';
    case 'once':
      return 'Única';
    default:
      return recurrence;
  }
}

export function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function sanitizeFileExt(fileName: string, fallback: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return fallback;
  const raw = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
  return raw || fallback;
}

export function toDateTimeLocalInputValue(
  iso: string | null | undefined
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromDateTimeLocalInputValue(localStr: string): string | null {
  const trimmed = localStr.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function isEvaluationPeriodEnded(
  evaluationEndAt: string | null | undefined
): boolean {
  if (!evaluationEndAt) return false;
  const endMs = Date.parse(evaluationEndAt);
  return !Number.isNaN(endMs) && endMs < Date.now();
}
