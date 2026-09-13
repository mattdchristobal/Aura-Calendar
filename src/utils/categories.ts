import { Category } from '../types';

export interface CategoryColorOption {
  key: string;
  name: string;
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  badgeClass: string;
}

export const CATEGORY_COLOR_PRESETS: CategoryColorOption[] = [
  {
    key: 'blue',
    name: 'Ocean Blue',
    hex: '#3B82F6',
    bgClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-l-4 border-l-blue-500',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20'
  },
  {
    key: 'emerald',
    name: 'Emerald Green',
    hex: '#10B981',
    bgClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-l-4 border-l-emerald-500',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20'
  },
  {
    key: 'violet',
    name: 'Royal Violet',
    hex: '#8B5CF6',
    bgClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/50',
    textClass: 'text-violet-700 dark:text-violet-300',
    borderClass: 'border-l-4 border-l-violet-500',
    dotClass: 'bg-violet-500',
    badgeClass: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20'
  },
  {
    key: 'rose',
    name: 'Ruby Rose',
    hex: '#F43F5E',
    bgClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    textClass: 'text-rose-700 dark:text-rose-300',
    borderClass: 'border-l-4 border-l-rose-500',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20'
  },
  {
    key: 'amber',
    name: 'Warm Amber',
    hex: '#F59E0B',
    bgClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-l-4 border-l-amber-500',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20'
  },
  {
    key: 'cyan',
    name: 'Electric Cyan',
    hex: '#06B6D4',
    bgClass: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50',
    textClass: 'text-cyan-700 dark:text-cyan-300',
    borderClass: 'border-l-4 border-l-cyan-500',
    dotClass: 'bg-cyan-500',
    badgeClass: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/20'
  },
  {
    key: 'fuchsia',
    name: 'Magenta Fuchsia',
    hex: '#D946EF',
    bgClass: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/50',
    textClass: 'text-fuchsia-700 dark:text-fuchsia-300',
    borderClass: 'border-l-4 border-l-fuchsia-500',
    dotClass: 'bg-fuchsia-500',
    badgeClass: 'bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/20'
  },
  {
    key: 'indigo',
    name: 'Deep Indigo',
    hex: '#6366F1',
    bgClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    borderClass: 'border-l-4 border-l-indigo-500',
    dotClass: 'bg-indigo-500',
    badgeClass: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/20'
  },
  {
    key: 'teal',
    name: 'Teal Green',
    hex: '#14B8A6',
    bgClass: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/50',
    textClass: 'text-teal-700 dark:text-teal-300',
    borderClass: 'border-l-4 border-l-teal-500',
    dotClass: 'bg-teal-500',
    badgeClass: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/20'
  },
  {
    key: 'orange',
    name: 'Sunset Orange',
    hex: '#F97316',
    bgClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/50',
    textClass: 'text-orange-700 dark:text-orange-300',
    borderClass: 'border-l-4 border-l-orange-500',
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/20'
  },
  {
    key: 'pink',
    name: 'Coral Pink',
    hex: '#EC4899',
    bgClass: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/50',
    textClass: 'text-pink-700 dark:text-pink-300',
    borderClass: 'border-l-4 border-l-pink-500',
    dotClass: 'bg-pink-500',
    badgeClass: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500/20'
  },
  {
    key: 'slate',
    name: 'Neutral Slate',
    hex: '#64748B',
    bgClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/50',
    textClass: 'text-slate-700 dark:text-slate-300',
    borderClass: 'border-l-4 border-l-slate-500',
    dotClass: 'bg-slate-500',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/20'
  }
];

export function createCategory(
  name: string,
  colorKey: string,
  id?: string,
  customHex?: string
): Category {
  const cleanId = id || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `cat_${Date.now()}`;
  const preset = CATEGORY_COLOR_PRESETS.find((p) => p.key === colorKey) || CATEGORY_COLOR_PRESETS[0];

  return {
    id: cleanId,
    name: name.trim(),
    color: preset.key,
    hex: customHex || preset.hex,
    bgClass: preset.bgClass,
    textClass: preset.textClass,
    borderClass: preset.borderClass,
    dotClass: preset.dotClass,
    badgeClass: preset.badgeClass
  };
}

export const DEFAULT_CATEGORIES: Category[] = [
  createCategory('Work & Projects', 'blue', 'work', '#3B82F6'),
  createCategory('Urgent & Deadlines', 'rose', 'urgent', '#F43F5E'),
  createCategory('Personal Life', 'emerald', 'personal', '#10B981'),
  createCategory('Team & Meetings', 'violet', 'team', '#8B5CF6'),
  createCategory('Health & Wellbeing', 'amber', 'health', '#F59E0B'),
  createCategory('Client Strategy', 'cyan', 'client', '#06B6D4'),
  createCategory('Family & Social', 'fuchsia', 'social', '#D946EF')
];

export function getCategoryById(
  arg1?: string | Category[],
  arg2?: string | Category[]
): Category {
  let id = '';
  let categories = DEFAULT_CATEGORIES;

  if (typeof arg1 === 'string') {
    id = arg1;
    if (Array.isArray(arg2) && arg2.length > 0) {
      categories = arg2;
    }
  } else if (Array.isArray(arg1)) {
    if (arg1.length > 0) {
      categories = arg1;
    }
    if (typeof arg2 === 'string') {
      id = arg2;
    }
  }

  const found = categories.find((cat) => cat.id === id);
  if (found) return found;

  const fallback = DEFAULT_CATEGORIES.find((cat) => cat.id === id);
  if (fallback) return fallback;

  return {
    id: id || 'default',
    name: id ? id.charAt(0).toUpperCase() + id.slice(1) : 'General',
    color: 'slate',
    hex: '#64748B',
    bgClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/50',
    textClass: 'text-slate-700 dark:text-slate-300',
    borderClass: 'border-l-4 border-l-slate-500',
    dotClass: 'bg-slate-500',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/20'
  };
}

