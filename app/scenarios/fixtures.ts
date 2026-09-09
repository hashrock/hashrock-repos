/** シナリオ間で使い回す小物 */

export const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f59e0b"/><path d="M8 12l3 3 5-6" stroke="#fff" stroke-width="2" fill="none"/></svg>';

/** i 日前の ISO 文字列。並び順を決めるのに使う */
export function daysAgo(days: number): string {
  const base = Date.UTC(2026, 8, 1); // 2026-09-01T00:00:00Z
  return new Date(base - days * 86_400_000).toISOString();
}
