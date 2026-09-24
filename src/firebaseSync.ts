import { db as firestoreDb, auth } from './firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import type { CalendarEvent, Category, UserSettings } from './types';

/**
 * Standardized Firestore Error Reporting per Firebase Architecture Guidelines
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Service to maintain bidirectional 24/7 cloud synchronization between
 * client state and Google Cloud Firestore with resilient reconnection.
 */
let unsubscribeEvents: (() => void) | null = null;
let unsubscribeCategories: (() => void) | null = null;
let eventsRetryTimer: any = null;
let categoriesRetryTimer: any = null;

export function subscribeToFirestoreEvents(
  onUpdate: (events: CalendarEvent[]) => void,
  onError?: (err: any) => void
): () => void {
  let isCleanedUp = false;

  const startSubscription = () => {
    if (isCleanedUp) return;
    try {
      const eventsCol = collection(firestoreDb, 'events');
      const unsub = onSnapshot(
        eventsCol,
        (snapshot) => {
          const events: CalendarEvent[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as CalendarEvent;
            if (data && data.id) {
              events.push(data);
            }
          });
          onUpdate(events);
        },
        (error) => {
          const errMsg = error ? String(error.message || error) : '';
          const isPermissionDenied = error?.code === 'permission-denied' || errMsg.includes('insufficient permissions');
          
          if (isPermissionDenied) {
            try {
              handleFirestoreError(error, OperationType.GET, 'events');
            } catch (handled) {
              if (onError) onError(handled);
              return;
            }
          }

          // Handle transient stream disconnects (e.g. GrpcConnection Listen stream RST_STREAM code 13)
          console.warn('[Firestore Events Sync Stream Notice]:', error?.message || error);
          if (onError) onError(error);

          // Graceful auto-retry after stream reset
          if (!isCleanedUp) {
            clearTimeout(eventsRetryTimer);
            eventsRetryTimer = setTimeout(() => {
              if (!isCleanedUp) {
                console.info('[Firestore Events Sync]: Re-establishing real-time listener...');
                startSubscription();
              }
            }, 3000);
          }
        }
      );
      unsubscribeEvents = () => {
        isCleanedUp = true;
        clearTimeout(eventsRetryTimer);
        try { unsub(); } catch {}
      };
    } catch (err) {
      console.warn('[Firestore Subscription Error]:', err);
      if (!isCleanedUp) {
        clearTimeout(eventsRetryTimer);
        eventsRetryTimer = setTimeout(startSubscription, 5000);
      }
    }
  };

  startSubscription();

  return () => {
    isCleanedUp = true;
    clearTimeout(eventsRetryTimer);
    if (unsubscribeEvents) {
      unsubscribeEvents();
      unsubscribeEvents = null;
    }
  };
}

export function subscribeToFirestoreCategories(
  onUpdate: (categories: Category[]) => void
): () => void {
  let isCleanedUp = false;

  const startSubscription = () => {
    if (isCleanedUp) return;
    try {
      const catCol = collection(firestoreDb, 'categories');
      const unsub = onSnapshot(
        catCol,
        (snapshot) => {
          const cats: Category[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as Category;
            if (data && data.id) {
              cats.push(data);
            }
          });
          if (cats.length > 0) {
            onUpdate(cats);
          }
        },
        (error) => {
          const errMsg = error ? String(error.message || error) : '';
          const isPermissionDenied = error?.code === 'permission-denied' || errMsg.includes('insufficient permissions');
          if (isPermissionDenied) {
            try {
              handleFirestoreError(error, OperationType.GET, 'categories');
            } catch {}
          }
          console.warn('[Firestore Categories Sync Stream Notice]:', error?.message || error);
          if (!isCleanedUp) {
            clearTimeout(categoriesRetryTimer);
            categoriesRetryTimer = setTimeout(() => {
              if (!isCleanedUp) {
                console.info('[Firestore Categories Sync]: Re-establishing real-time listener...');
                startSubscription();
              }
            }, 3000);
          }
        }
      );
      unsubscribeCategories = () => {
        isCleanedUp = true;
        clearTimeout(categoriesRetryTimer);
        try { unsub(); } catch {}
      };
    } catch (err) {
      console.warn('[Firestore Categories Subscription Error]:', err);
      if (!isCleanedUp) {
        clearTimeout(categoriesRetryTimer);
        categoriesRetryTimer = setTimeout(startSubscription, 5000);
      }
    }
  };

  startSubscription();

  return () => {
    isCleanedUp = true;
    clearTimeout(categoriesRetryTimer);
    if (unsubscribeCategories) {
      unsubscribeCategories();
      unsubscribeCategories = null;
    }
  };
}

export async function saveEventToFirestore(event: CalendarEvent): Promise<void> {
  if (!event || !event.id) return;
  const path = `events/${event.id}`;
  try {
    const eventRef = doc(firestoreDb, 'events', event.id);
    await setDoc(eventRef, {
      ...event,
      cloudSyncedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message || '').includes('insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.warn('[Firestore Save Event Warning]:', err);
  }
}

export async function deleteEventFromFirestore(eventId: string): Promise<void> {
  if (!eventId) return;
  const path = `events/${eventId}`;
  try {
    const eventRef = doc(firestoreDb, 'events', eventId);
    await deleteDoc(eventRef);
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message || '').includes('insufficient permissions')) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    console.warn('[Firestore Delete Event Warning]:', err);
  }
}

export async function saveCategoryToFirestore(category: Category): Promise<void> {
  if (!category || !category.id) return;
  const path = `categories/${category.id}`;
  try {
    const ref = doc(firestoreDb, 'categories', category.id);
    await setDoc(ref, category, { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message || '').includes('insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.warn('[Firestore Save Category Warning]:', err);
  }
}

export async function deleteCategoryFromFirestore(categoryId: string): Promise<void> {
  if (!categoryId) return;
  const path = `categories/${categoryId}`;
  try {
    const ref = doc(firestoreDb, 'categories', categoryId);
    await deleteDoc(ref);
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message || '').includes('insufficient permissions')) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    console.warn('[Firestore Delete Category Warning]:', err);
  }
}

export async function saveSettingsToFirestore(settings: UserSettings): Promise<void> {
  if (!settings) return;
  const path = 'settings/global';
  try {
    const ref = doc(firestoreDb, 'settings', 'global');
    await setDoc(ref, settings, { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message || '').includes('insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.warn('[Firestore Save Settings Warning]:', err);
  }
}

