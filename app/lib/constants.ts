export const KANBAN_COLUMNS = ['backlog', 'ongoing', 'unfinished', 'done'] as const;
export type KanbanColumn = typeof KANBAN_COLUMNS[number];
