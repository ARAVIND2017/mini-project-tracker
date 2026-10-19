// Helpers for the review queue (UI only).

/** How long an item has waited, e.g. "3 d" or "5 h". */
export function waitedFor(since: string | null, now: number): string {
  if (!since) return '—';
  const hours = Math.max(0, Math.floor((now - Date.parse(since)) / 3_600_000));
  return hours >= 24 ? `${Math.floor(hours / 24)} d` : `${hours} h`;
}

interface QueueLinkItem {
  project_id: string | null;
  target_type: string | null;
  target_id: string | null;
  stage_key: string | null;
}

/** Where an item is reviewed on the project page. */
export function itemLink(item: QueueLinkItem): string {
  const base = `/projects/${item.project_id}`;
  if (item.target_type === 'task_submission')
    return `${base}?view=tasks&submission=${item.target_id}`;
  return `${base}?stage=${item.stage_key}`;
}
