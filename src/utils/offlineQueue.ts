import { get, set, update } from 'idb-keyval';

export type OfflineActionType = 'clockInAction' | 'clockOutAction' | 'recordBreakAction' | 'setDayAbsenceCodeAction';

export interface OfflineAction {
  id: string; // Unique ID for the offline action (uuid)
  type: OfflineActionType;
  payload: any;
  timestamp: string; // ISO string representing when the action occurred
}

const QUEUE_KEY = 'offline_actions_queue';

export const addOfflineAction = async (type: OfflineActionType, payload: any) => {
  const newAction: OfflineAction = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: new Date().toISOString(),
  };

  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineAction[]) || [];
    return [...queue, newAction];
  });
  
  return newAction;
};

export const getOfflineQueue = async (): Promise<OfflineAction[]> => {
  return (await get(QUEUE_KEY)) || [];
};

export const clearOfflineQueue = async () => {
  await set(QUEUE_KEY, []);
};

export const removeOfflineAction = async (id: string) => {
  await update(QUEUE_KEY, (val) => {
    const queue = (val as OfflineAction[]) || [];
    return queue.filter((action) => action.id !== id);
  });
};
