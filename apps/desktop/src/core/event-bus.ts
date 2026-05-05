type Handler = (payload: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

export const eventBus = {
  on(event: string, handler: Handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
    return () => listeners.get(event)?.delete(handler);
  },

  emit(event: string, payload?: unknown) {
    listeners.get(event)?.forEach((h) => h(payload));
  },

  off(event: string, handler: Handler) {
    listeners.get(event)?.delete(handler);
  },
};
