import type { CalendarEvent } from '../types';
import seedData from './seedEvents.json';

export const SEED_EVENTS: CalendarEvent[] = (seedData as any) as CalendarEvent[];
export default SEED_EVENTS;
