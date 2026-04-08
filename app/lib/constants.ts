export const KANBAN_COLUMNS = ['backlog', 'ongoing', 'unfinished', 'done', 'research'] as const;
export type KanbanColumn = typeof KANBAN_COLUMNS[number];
