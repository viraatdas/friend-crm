import { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'uncategorized',
    name: 'Uncategorized',
    color: '#6B7280', // gray
    order: 0,
  },
  {
    id: 'high-yielding',
    name: 'High Yielding',
    color: '#10B981', // green
    order: 1,
  },
  {
    id: 'mid-yielding',
    name: 'Mid-Yielding',
    color: '#3B82F6', // blue
    order: 2,
  },
  {
    id: 'purdue',
    name: 'Purdue',
    color: '#CEB888', // Purdue gold
    order: 3,
  },
  {
    id: 'high-school',
    name: 'High School',
    color: '#EC4899', // pink
    order: 4,
  },
  {
    id: 'exla',
    name: 'Exla',
    color: '#8B5CF6', // purple
    order: 5,
  },
  {
    id: 'not-high-yielding',
    name: 'Not High Yielding',
    color: '#F59E0B', // amber
    order: 6,
  },
  {
    id: 'spent-enough-time',
    name: 'Spent Enough Time',
    color: '#EF4444', // red
    order: 7,
  },
  {
    id: 'out-of-reach',
    name: 'Out of Reach',
    color: '#6366F1', // indigo
    order: 8,
  },
  {
    id: 'archived',
    name: 'Archived',
    color: '#9CA3AF', // light gray
    order: 9,
  },
];

export const DEFAULT_CATEGORY_ID = 'uncategorized';
