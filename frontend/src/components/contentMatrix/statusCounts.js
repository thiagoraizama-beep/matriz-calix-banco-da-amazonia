export function groupByStatus(creatives) {
  const groups = {};
  for (const c of creatives) {
    if (!c.status) continue;
    groups[c.status] = (groups[c.status] || 0) + 1;
  }
  return groups;
}
