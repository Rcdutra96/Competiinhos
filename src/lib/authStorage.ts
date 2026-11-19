export const LAST_NICK_COOKIE = 'competiinhos_last_nick';

const CHUNK_SIZE = 3500;

function resolveCookiePath(customPath?: string): string {
  if (customPath) return customPath;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/Competiinhos')) {
    return '/Competiinhos/';
  }
  return '/';
}

function isSecureEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  return window.location.protocol === 'https:' && !isLocalhost;
}

export function setCookie(
  name: string,
  value: string,
  maxAgeSeconds = 31536000,
  customPath?: string
): void {
  if (typeof document === 'undefined') return;
  const path = resolveCookiePath(customPath);
  const secureFlag = isSecureEnvironment() ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}; path=${path}; max-age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const target = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split(';');
  for (let c of cookies) {
    c = c.trim();
    if (c.indexOf(target) === 0) {
      return decodeURIComponent(c.substring(target.length));
    }
  }
  return null;
}

export function deleteCookie(name: string, customPath?: string): void {
  if (typeof document === 'undefined') return;
  const path = resolveCookiePath(customPath);
  const secureFlag = isSecureEnvironment() ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(
    name
  )}=; path=${path}; max-age=0; SameSite=Lax${secureFlag}`;
  // Também tenta limpar em / para garantir caso tenha sido salvo com path diferente
  if (path !== '/') {
    document.cookie = `${encodeURIComponent(
      name
    )}=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
  }
}

export function getLastNick(): string {
  return getCookie(LAST_NICK_COOKIE) || '';
}

export function setLastNick(nick: string): void {
  const trimmed = nick.trim();
  if (trimmed) {
    setCookie(LAST_NICK_COOKIE, trimmed);
  }
}

export function clearLastNick(): void {
  deleteCookie(LAST_NICK_COOKIE);
}

/**
 * Normaliza apelido para slug seguro de e-mail interno:
 * - Converte para minúsculas
 * - Remove acentos via NFD
 * - Substitui caracteres não alfanuméricos por underscore
 * - Remove underscores repetidos e das extremidades
 */
export function nicknameToSlug(nickname: string): string {
  return nickname
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function slugToEmail(slug: string): string {
  return `${slug}@competiinhos.app`;
}

export function pinToPassword(pin: string): string {
  return `cp_pin_${pin}`;
}

/**
 * Storage personalizado para o Supabase Auth com suporte a localStorage
 * e fallback/espelhamento em cookies fragmentados (até 3500 bytes por cookie).
 */
export const cookieStorage = {
  getItem: (key: string): string | null => {
    // 1. Tenta localStorage primeiro
    try {
      const val = window.localStorage.getItem(key);
      if (val) return val;
    } catch {
      // localStorage bloqueado ou indisponível
    }

    // 2. Fallback: remonta a partir dos cookies chunked
    try {
      const countStr = getCookie(`${key}_chunks`);
      if (countStr) {
        const count = parseInt(countStr, 10);
        if (!isNaN(count) && count > 0) {
          const parts: string[] = [];
          for (let i = 0; i < count; i++) {
            const part = getCookie(`${key}_chunk_${i}`);
            if (part === null) {
              return null;
            }
            parts.push(part);
          }
          const fullValue = parts.join('');
          // Re-hidrata localStorage se possível
          try {
            window.localStorage.setItem(key, fullValue);
          } catch {}
          return fullValue;
        }
      }

      // Tenta leitura direta do cookie sem chunk
      const direct = getCookie(key);
      if (direct) return direct;
    } catch {}

    return null;
  },

  setItem: (key: string, value: string): void => {
    // 1. Grava no localStorage
    try {
      window.localStorage.setItem(key, value);
    } catch {}

    // 2. Grava em cookies com chunking de até 3500 bytes
    try {
      const prevCountStr = getCookie(`${key}_chunks`);
      const prevCount = prevCountStr ? parseInt(prevCountStr, 10) : 0;

      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }

      setCookie(`${key}_chunks`, String(chunks.length));
      chunks.forEach((chunk, index) => {
        setCookie(`${key}_chunk_${index}`, chunk);
      });

      // Remove chunks anteriores excedentes
      if (!isNaN(prevCount) && prevCount > chunks.length) {
        for (let i = chunks.length; i < prevCount; i++) {
          deleteCookie(`${key}_chunk_${i}`);
        }
      }
    } catch {}
  },

  removeItem: (key: string): void => {
    // 1. Remove do localStorage
    try {
      window.localStorage.removeItem(key);
    } catch {}

    // 2. Remove dos cookies
    try {
      const countStr = getCookie(`${key}_chunks`);
      if (countStr) {
        const count = parseInt(countStr, 10);
        if (!isNaN(count)) {
          for (let i = 0; i < count; i++) {
            deleteCookie(`${key}_chunk_${i}`);
          }
        }
        deleteCookie(`${key}_chunks`);
      }
      deleteCookie(key);
    } catch {}
  },
};
