type PushNotice = {
  id: string;
  title: string;
  body: string;
  chatId?: string;
  route?: '/(tabs)/chats' | `/chat/${string}`;
};

type Listener = (notice: PushNotice | null) => void;

let current: PushNotice | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(current);
}

export function publishPushNotice(notice: Omit<PushNotice, 'id'>) {
  current = { ...notice, id: `${Date.now()}` };
  emit();
}

export function clearPushNotice() {
  if (!current) return;
  current = null;
  emit();
}

export function subscribePushNotice(listener: Listener) {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}
