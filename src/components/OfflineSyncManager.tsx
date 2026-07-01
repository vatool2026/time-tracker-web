'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { getOfflineQueue, clearOfflineQueue, removeOfflineAction } from '@/utils/offlineQueue';
import {
  clockInAction,
  clockOutAction,
  recordBreakAction,
  setDayAbsenceCodeAction
} from '@/app/actions';

export function OfflineSyncManager() {
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueLength, setQueueLength] = useState(0);

  useEffect(() => {
    // Check initial status
    setIsOffline(!navigator.onLine);

    const updateQueueLength = async () => {
      const queue = await getOfflineQueue();
      setQueueLength(queue.length);
    };
    
    updateQueueLength();
    
    // Poll queue length occasionally when offline to update UI if actions are added
    let interval: NodeJS.Timeout;
    if (!navigator.onLine) {
      interval = setInterval(updateQueueLength, 2000);
    }

    const handleOnline = async () => {
      setIsOffline(false);
      await syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOffline(true);
      updateQueueLength();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (interval) clearInterval(interval);
    };
  }, [isOffline]);

  const syncOfflineQueue = async () => {
    const queue = await getOfflineQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);

    try {
      for (const action of queue) {
        let success = true;
        try {
          switch (action.type) {
            case 'clockInAction':
              await clockInAction(action.payload.note, action.payload.qr_code_id, action.timestamp);
              break;
            case 'clockOutAction':
              await clockOutAction(action.payload.note, action.timestamp);
              break;
            case 'recordBreakAction':
              await recordBreakAction(action.payload.minutes);
              break;
            case 'setDayAbsenceCodeAction':
              await setDayAbsenceCodeAction(
                action.payload.userId,
                action.payload.dateStr,
                action.payload.code,
                action.payload.note
              );
              break;
          }

        } catch (e) {
          console.error('Failed to sync offline action:', action, e);
          success = false;
        }

        if (success) {
          await removeOfflineAction(action.id);
        }
      }
    } finally {
      setIsSyncing(false);
      const remaining = await getOfflineQueue();
      setQueueLength(remaining.length);
    }
  };

  if (!isOffline && !isSyncing && queueLength === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-500/90 text-white p-2 text-sm flex items-center justify-center gap-2 z-50 animate-in slide-in-from-bottom-2">
      {isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Synchronisiere {queueLength} ausstehende Änderungen...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Sie sind offline. {queueLength} {queueLength === 1 ? 'Änderung' : 'Änderungen'} gespeichert.</span>
        </>
      )}
    </div>
  );
}
