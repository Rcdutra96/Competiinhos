import { createClient } from '@supabase/supabase-js';
import { cookieStorage } from './authStorage';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
const supabaseAnonKey = typeof rawAnonKey === 'string' ? rawAnonKey.trim() : '';

const missingVars: string[] = [];
if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = missingVars.length === 0;

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : `Configuração do Supabase ausente: ${missingVars.join(', ')}. Defina essas variáveis no arquivo .env (desenvolvimento) ou nos Secrets do repositório GitHub Actions (produção).`;

if (supabaseConfigError) {
  console.error(`[Competiinhos] ${supabaseConfigError}`);
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: false,
      storageKey: 'competiinhos-auth',
      storage: cookieStorage,
    },
  }
);
