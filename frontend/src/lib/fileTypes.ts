/**
 * File type constants and utilities for document filtering
 */

export const FILE_TYPE_CATEGORIES = {
  DOCUMENTS: {
    label: 'Documents',
    extensions: ['pdf', 'doc', 'docx', 'odt'],
  },
  PRESENTATIONS: {
    label: 'Presentations',
    extensions: ['ppt', 'pptx'],
  },
  SPREADSHEETS: {
    label: 'Spreadsheets',
    extensions: ['csv'],
  },
  TEXT: {
    label: 'Text Files',
    extensions: ['txt', 'md'],
  },
  WEB: {
    label: 'Web',
    extensions: ['html'],
  },
  EBOOKS: {
    label: 'E-Books',
    extensions: ['epub', 'enex'],
  },
} as const;

export const ALL_FILE_EXTENSIONS = Object.values(FILE_TYPE_CATEGORIES).flatMap(
  (category) => category.extensions
);

export const FILE_TYPE_OPTIONS = [
  { value: '', label: 'All File Types' },
  ...Object.entries(FILE_TYPE_CATEGORIES).map(([key, { label }]) => ({
    value: key,
    label,
  })),
];

export const DATE_RANGE_OPTIONS = [
  { value: '', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'quarter', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
] as const;

export const SIZE_RANGE_OPTIONS = [
  { value: '', label: 'Any Size' },
  { value: '0-1', label: 'Under 1 MB' },
  { value: '1-10', label: '1 - 10 MB' },
  { value: '10-100', label: '10 - 100 MB' },
  { value: '100+', label: 'Over 100 MB' },
] as const;

export const CHUNK_RANGE_OPTIONS = [
  { value: '', label: 'Any Length' },
  { value: '0-10', label: 'Small (< 10 chunks)' },
  { value: '10-50', label: 'Medium (10-50 chunks)' },
  { value: '50-100', label: 'Large (50-100 chunks)' },
  { value: '100+', label: 'Very Large (100+ chunks)' },
] as const;

/**
 * Get extensions for a file type category
 */
export function getExtensionsForCategory(category: string): string[] {
  const cat = FILE_TYPE_CATEGORIES[category as keyof typeof FILE_TYPE_CATEGORIES];
  return cat ? cat.extensions : [];
}

/**
 * Calculate date range based on preset
 */
export function getDateRange(preset: string): { from?: string; to?: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return {
        from: today.toISOString(),
      };
    case 'week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        from: weekAgo.toISOString(),
      };
    case 'month':
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return {
        from: monthAgo.toISOString(),
      };
    case 'quarter':
      const quarterAgo = new Date(today);
      quarterAgo.setDate(quarterAgo.getDate() - 90);
      return {
        from: quarterAgo.toISOString(),
      };
    default:
      return {};
  }
}

/**
 * Parse size range string to min/max bytes
 */
export function parseSizeRange(range: string): { min?: number; max?: number } {
  if (!range) return {};

  const MB = 1024 * 1024;

  if (range === '0-1') {
    return { max: MB };
  } else if (range === '1-10') {
    return { min: MB, max: 10 * MB };
  } else if (range === '10-100') {
    return { min: 10 * MB, max: 100 * MB };
  } else if (range === '100+') {
    return { min: 100 * MB };
  }

  return {};
}

/**
 * Parse chunk range string to min/max counts
 */
export function parseChunkRange(range: string): { min?: number; max?: number } {
  if (!range) return {};

  if (range === '0-10') {
    return { max: 10 };
  } else if (range === '10-50') {
    return { min: 10, max: 50 };
  } else if (range === '50-100') {
    return { min: 50, max: 100 };
  } else if (range === '100+') {
    return { min: 100 };
  }

  return {};
}
