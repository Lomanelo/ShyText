/** Sync snapshot so the venue screen can paint fully Shyned before Firestore lands. */

import { CheckIn, Venue } from '../types/venue';

type Listener = () => void;

export type PendingShyne = {
  venueId: string;
  checkIn: CheckIn;
  venue: Venue;
};

let pending: PendingShyne | null = null;
let pendingError: { venueId: string; message: string } | null = null;
const listeners = new Set<Listener>();

function notify() {
  // Defer so listeners never setState during another component's render/updater.
  queueMicrotask(() => {
    listeners.forEach((listener) => listener());
  });
}

export function subscribePendingShyne(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function markPendingShyne(snapshot: PendingShyne): void {
  pending = snapshot;
  pendingError = null;
  notify();
}

export function patchPendingCheckIn(patch: Partial<CheckIn>): void {
  if (!pending) return;
  pending = { ...pending, checkIn: { ...pending.checkIn, ...patch } };
  notify();
}

export function clearPendingShyne(venueId?: string): void {
  if (!venueId || pending?.venueId === venueId) {
    pending = null;
    notify();
  }
}

export function isPendingShyne(venueId: string | undefined | null): boolean {
  return Boolean(venueId) && pending?.venueId === venueId;
}

export function getPendingShyne(venueId: string | undefined | null): PendingShyne | null {
  if (!venueId || pending?.venueId !== venueId) return null;
  return pending;
}

export function setPendingShyneError(venueId: string, message: string): void {
  if (pending?.venueId === venueId) pending = null;
  pendingError = { venueId, message };
  notify();
}

export function takePendingShyneError(venueId: string | undefined | null): string | null {
  if (!venueId || pendingError?.venueId !== venueId) return null;
  const message = pendingError.message;
  pendingError = null;
  return message;
}
