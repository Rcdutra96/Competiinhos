import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

export function useHeartbeat(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const sendHeartbeat = async () => {
      if (cancelled) return;
      const { error } = await supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        console.warn('Falha ao atualizar heartbeat:', error.message);
      }
    };

    void sendHeartbeat();

    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userId]);
}
