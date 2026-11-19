import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type AuthMode = 'login' | 'signup';

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (lower.includes('user already registered')) {
    return 'Este e-mail já está cadastrado.';
  }
  if (lower.includes('password should be at least')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (lower.includes('unable to validate email address')) {
    return 'Informe um endereço de e-mail válido.';
  }
  if (lower.includes('rate limit')) {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes.';
  }
  return message;
}

export function Auth() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signupEmailSent, setSignupEmailSent] = useState(false);

  const fromState = (location.state as { from?: { pathname?: string } } | null)
    ?.from?.pathname;

  if (!authLoading && user) {
    return <Navigate to={fromState || '/'} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSignupEmailSent(false);

    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();

    if (mode === 'signup' && trimmedName.length < 2) {
      setErrorMsg('Informe um nome de exibição com pelo menos 2 caracteres.');
      return;
    }

    if (!trimmedEmail || !password) {
      setErrorMsg('Preencha e-mail e senha.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          setErrorMsg(translateAuthError(error.message));
          return;
        }
        showToast('Bem-vindo de volta!', 'success');
        navigate(fromState || '/', { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              display_name: trimmedName,
            },
          },
        });

        if (error) {
          setErrorMsg(translateAuthError(error.message));
          return;
        }

        if (data.session) {
          showToast('Conta criada com sucesso!', 'success');
          navigate(fromState || '/', { replace: true });
        } else {
          setSignupEmailSent(true);
          showToast('Cadastro realizado! Verifique seu e-mail.', 'success');
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
                setSignupEmailSent(false);
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
                setSignupEmailSent(false);
              }}
              className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Criar conta
            </button>
          </div>

          {signupEmailSent && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="font-medium">Confirme seu e-mail</p>
                <p className="mt-0.5 text-xs text-emerald-300/90">
                  Enviamos um link de confirmação para <strong>{email}</strong>.
                  Após confirmar, faça login abaixo.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
                >
                  Nome de exibição
                </label>
                <input
                  id="auth-display-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Como o grupo vai te ver"
                  autoComplete="name"
                  className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
              >
                E-mail
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                autoComplete="email"
                inputMode="email"
                className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400"
              >
                Senha
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                className="min-h-[46px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
