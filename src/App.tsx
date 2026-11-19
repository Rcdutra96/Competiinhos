import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthGuard } from './components/AuthGuard';
import { GroupGuard } from './components/GroupGuard';
import { supabaseConfigError } from './lib/supabase';
import { Auth } from './pages/Auth';
import { GroupDashboard } from './pages/GroupDashboard';
import { GroupHub } from './pages/GroupHub';
import { RankingDetail } from './pages/RankingDetail';

export function App() {
  if (supabaseConfigError) {
    return (
      <div className="pt-safe-header pb-safe flex min-h-dvh items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-zinc-900 p-6 shadow-xl">
          <h1 className="text-lg font-bold text-rose-300">
            Erro de configuração
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            {supabaseConfigError}
          </p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <AuthGuard>
                  <GroupHub />
                </AuthGuard>
              }
            />
            <Route
              path="/groups/:groupId"
              element={
                <AuthGuard>
                  <GroupGuard>
                    <GroupDashboard />
                  </GroupGuard>
                </AuthGuard>
              }
            />
            <Route
              path="/groups/:groupId/ranking"
              element={
                <AuthGuard>
                  <GroupGuard>
                    <RankingDetail />
                  </GroupGuard>
                </AuthGuard>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
