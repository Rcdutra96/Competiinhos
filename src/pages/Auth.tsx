import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Loader2, Trophy, User, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  clearLastNick,
  getLastNick,
  nicknameToSlug,
  pinToPassword,
  setLastNick,
  slugToEmail,
} from '../lib/authStorage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type AuthMode = 'login' | 'signup';

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Apelido ou PIN incorretos.';
  }
  if (lower.includes('user already registered')) {
    return 'Esse apelido já está em uso. Tente entrar ou escolha outro.';
  }
  if (lower.includes('rate limit')) {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Acesso pendente de confirmação.';
  }
  return message;
}

export function Auth() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>('login');
  const [nickname, setNickname] = useState('');
  const [hasSavedNick, setHasSavedNick] = useState(false);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pinInputRef = useRef<HTMLInputElement>(null);

  const fromState = (location.state as { from?: { pathname?: string } } | null)
    ?.from?.pathname;

  // Carrega apelido salvo do cookie
  useEffect(() => {
    const saved = getLastNick();
    if (saved) {
      setNickname(saved);
      setHasSavedNick(true);
    }
  }, []);

  if (!authLoading && user) {
    return <Navigate to={fromState || '/'} replace />;
  }

  const handleClearSavedNick = () => {
    clearLastNick();
    setNickname('');
    setHasSavedNick(false);
    setPin('');
    setErrorMsg(null);
  };

  const handlePinChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(raw);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedNick = nickname.trim();
    if (trimmedNick.length < 3 || trimmedNick.length > 20) {
      setErrorMsg('O apelido precisa ter entre 3 e 20 caracteres.');
      return;
    }

    const slug = nicknameToSlug(trimmedNick);
    if (!slug || slug.length < 3) {
      setErrorMsg('O apelido deve conter pelo menos 3 letras ou números válidos.');
      return;
    }

    if (pin.length !== 4) {
      setErrorMsg('Digite um PIN de 4 números.');
      pinInputRef.current?.focus();
      return;
    }

    const email = slugToEmail(slug);
    const password = pinToPassword(pin);

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMsg(translateAuthError(error.message));
          return;
        }

        setLastNick(trimmedNick);
        showToast(`Bem-vindo, ${trimmedNick}!`, 'success');
        navigate(fromState || '/', { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: trimmedNick,
            },
          },
        });

        if (error) {
          setErrorMsg(translateAuthError(error.message));
          return;
        }

        // Se a conta já tiver sido autenticada automaticamente:
        if (data.session) {
          setLastNick(trimmedNick);
          showToast(`Acesso criado com sucesso!`, 'success');
          navigate(fromState || '/', { replace: true });
        } else {
          // Caso confirmação seja requerida ou não venha sessão, tenta logar diretamente:
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (loginError) {
            setErrorMsg(
              'Acesso criado! Tente entrar com seu apelido e PIN agora.'
            );
            setMode('login');
          } else {
            setLastNick(trimmedNick);
            showToast(`Acesso criado com sucesso!`, 'success');
            navigate(fromState || '/', { replace: true });
          }
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-safe-header pb-safe flex min-h-dvh flex-col justify-center bg-zinc-950 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 shadow-lg shadow-emerald-500/10">
            <Trophy className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Competiinhos
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Metas sociais em grupo com provas reais e votações transparentes
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-zinc-950/70 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Criar acesso
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="auth-nickname"
                  className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400"
                >
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                  Apelido
                </label>
                {hasSavedNick && mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleClearSavedNick}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-400 transition-colors"
                  >
                    <XCircle className="h-3 w-3" />
                    Trocar conta
                  </button>
                )}
              </div>
              <input
                id="auth-nickname"
                type="text"
                required
                minLength={3}
                maxLength={20}
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Ex.: Rafa, Amanda, Dutra"
                autoComplete="username"
                className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm font-medium text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                {mode === 'signup'
                  ? '3 a 20 caracteres. Este será seu nome nos grupos.'
                  : 'Digite o mesmo apelido criado anteriormente.'}
              </p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="auth-pin"
                  className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400"
                >
                  <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
                  PIN (4 dígitos)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {showPin ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      Ocultar PIN
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      Mostrar PIN
                    </>
                  )}
                </button>
              </div>

              {/* Display de 4 caixas com input sobreposto */}
              <div
                onClick={() => pinInputRef.current?.focus()}
                className="relative flex cursor-pointer justify-center gap-3 py-1"
              >
                <input
                  ref={pinInputRef}
                  id="auth-pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoComplete="one-time-code"
                  value={pin}
                  onChange={handlePinChange}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  aria-label="PIN de 4 dígitos"
                />

                {[0, 1, 2, 3].map((index) => {
                  const digit = pin[index];
                  const isCurrent = pin.length === index;

                  return (
                    <div
                      key={index}
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-xl font-bold transition-all ${
                        digit
                          ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300 shadow-sm'
                          : isCurrent
                          ? 'border-emerald-500 bg-zinc-950 shadow-md shadow-emerald-500/20'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-600'
                      }`}
                    >
                      {digit ? (
                        showPin ? (
                          digit
                        ) : (
                          <span className="h-3 w-3 rounded-full bg-emerald-400" />
                        )
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="mt-1.5 text-center text-[11px] text-zinc-500">
                Toque nos quadros para digitar seu código numérico de 4 dígitos.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || pin.length !== 4 || nickname.trim().length < 3}
              className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Entrar' : 'Criar acesso'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
