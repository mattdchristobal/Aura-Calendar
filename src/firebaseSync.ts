import { db as firestoreDb } from './firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import type { CalendarEvent, Category, SharedCalendar, UserSettings } from './types';

/**
 * Service to maintain bidirectional 24/7 cloud synchronization between
 * client state and Google Cloud Firestore.
 */

let unsubscribeEvents: (() => void) | null = null;
let unsubscribeCategories: (() => void) | null = null;
let unsubscribeSettings: (() => void) | null = null;
let unsubscribeShares: (() => void) | null = null;

export function subscribeToFirestoreEvents(
  onUpdate: (events: CalendarEvent[]) => void,
  onError?: (err: any) => void
): () => void {
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
        console.warn('[Firestore Events Sync Warning]:', error);
        if (onError) onError(error);
      }
    );
    unsubscribeEvents = unsub;
    return unsub;
  } catch (err) {
    console.warn('[Firestore Subscription Error]:', err);
    return () => {};
  }
}

export function subscribeToFirestoreCategories(
  onUpdate: (categories: Category[]) => void
): () => void {
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
        console.warn('[Firestore Categories Sync Warning]:', error);
      }
    );
    unsubscribeCategories = unsub;
    return unsub;
  } catch (err) {
    return () => {};
  }
}

export async function saveEventToFirestore(event: CalendarEvent): Promise<void> {
  if (!event || !event.id) return;
  try {
    const eventRef = doc(firestoreDb, 'events', event.id);
    await setDoc(eventRef, {
      ...event,
      cloudSyncedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('[Firestore Save Event Warning]:', err);
  }
}

export async function deleteEventFromFirestore(eventId: string): Promise<void> {
  if (!eventId) return;
  try {
    const eventRef = doc(firestoreDb, 'events', eventId);
    await deleteDoc(eventRef);
  } catch (err) {
    console.warn('[Firestore Delete Event Warning]:', err);
  }
}

export async function saveCategoryToFirestore(category: Category): Promise<void> {
  if (!category || !category.id) return;
  try {
    const ref = doc(firestoreDb, 'categories', category.id);
    await setDoc(ref, category, { merge: true });
  } catch (err) {
    console.warn('[Firestore Save Category Warning]:', err);
  }
}

export async function saveSettingsToFirestore(settings: UserSettings): Promise<void> {
  if (!settings) return;
  try {
    const ref = doc(firestoreDb, 'settings', 'global');
    await setDoc(ref, settings, { merge: true });
  } catch (err) {
    console.warn('[Firestore Save Settings Warning]:', err);
  }
}
