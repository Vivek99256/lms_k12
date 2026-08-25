/**
 * Ported from G2G's `lib/task-utils.ts` (the subset `TaskListView` and
 * `TaskDetailsDrawer`-family components use: `getTaskStatusColor`,
 * `getPriorityColor`). Scoped to this page's component folder rather than a
 * shared `_lib` file, since only `task-list-view.tsx` here needs it.
 */
export function getTaskStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-success/10 text-success border-success/20'
    case 'in_progress':
      return 'bg-primary/10 text-primary border-primary/20'
    case 'review':
      return 'bg-warning/10 text-warning border-warning/20'
    case 'blocked':
      return 'bg-destructive/10 text-destructive border-destructive/20'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function getPriorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case 'low':
      return 'border-success/30 bg-success/10 text-success font-semibold'
    case 'medium':
      return 'border-warning/40 bg-warning/10 text-warning font-semibold'
    case 'high':
      return 'border-destructive/35 bg-destructive/10 text-destructive font-semibold'
    case 'urgent':
    case 'critical':
      return 'border-purple-800/40 bg-purple-950/15 text-purple-800 dark:text-purple-300 font-semibold'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}
