import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthGuard } from './components/AuthGuard';
import { GroupGuard } from './components/GroupGuard';
import { Auth } from './pages/Auth';
import { GroupDashboard } from './pages/GroupDashboard';
import { GroupHub } from './pages/GroupHub';
import { RankingDetail } from './pages/RankingDetail';

export function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
