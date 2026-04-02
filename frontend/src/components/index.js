// UI Component Library Exports
// Use: import { Button, Input, Card } from '@/components'

// Buttons & Actions
export { default as Button } from './Button';
export { Tooltip } from './Tooltip';

// Forms
export { Input, Textarea, Select } from './Input';

// Feedback
export { default as Alert } from './Alert';
export { default as Spinner, SpinnerOverlay } from './Spinner';
export { Skeleton, SkeletonText, SkeletonTableRow, SkeletonCard } from './Skeleton';
export { Progress, Divider } from './Progress';

// Layout & Organization
export { Card, CardGrid } from './Card';
export { default as Tabs } from './Tabs';
export { default as Pagination } from './Pagination';
export { Badge, Chip } from './Badge';

// Navigation & More
export { default as Modal } from './Modal';
export { RowActionsMenu } from './RowActionsMenu';
export { EmptyState } from './EmptyState';

// Design System
export const THEME = {
  colors: {
    accent: 'var(--accent)',
    accentBright: 'var(--accent-bright)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    muted: 'var(--muted)',
    text: 'var(--text)',
    surface: 'var(--surface)',
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
  },
  shadows: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
  },
};
