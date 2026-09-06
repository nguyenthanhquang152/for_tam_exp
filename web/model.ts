export interface Observation {
  time: string; tissue: string; taxon: string; treatment: string;
  total: number; positive: number; percent: number; group: number;
}
export interface Dataset {
  schemaVersion: 1;
  source: { filename: string; sha256: string };
  groups: { name: string; color: string }[];
  tissueNames: Record<string, string>;
  rows: Observation[];
}
export interface Cell {
  taxon: string; tissue: string; treatment: string; observation: Observation | undefined;
}
export type Palette = 'red' | 'blue' | 'teal';
export const PALETTES: Record<Palette, readonly string[]> = {
  red: ['#ffffff', '#fee5d9', '#fcae91', '#fb6a4a', '#cb181d'],
  blue: ['#ffffff', '#dbeafe', '#93c5fd', '#3b82f6', '#1e40af'],
  teal: ['#ffffff', '#ccfbf1', '#5eead4', '#14b8a6', '#0f766e'],
};
export const percent = (value: number): string => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value);
export const naturalOrder = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true });
export const cellKey = (taxon: string, tissue: string, treatment: string): string => JSON.stringify([taxon, tissue, treatment]);

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid data object.');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing data label.');
  return value;
}

export function parseDataset(value: unknown): Dataset {
  const data = object(value);
  if (data.schemaVersion !== 1) throw new Error('Unsupported dataset version.');
  const source = object(data.source);
  string(source.filename);
  if (!/^[a-f0-9]{64}$/.test(string(source.sha256))) throw new Error('Invalid source fingerprint.');
  if (!Array.isArray(data.groups) || !data.groups.length) throw new Error('Missing taxon groups.');
  for (const entry of data.groups) {
    const group = object(entry);
    string(group.name);
    if (!/^#[a-f0-9]{6}$/i.test(string(group.color))) throw new Error('Invalid group color.');
  }
  const tissueNames = object(data.tissueNames);
  for (const name of Object.values(tissueNames)) string(name);
  if (!Array.isArray(data.rows) || !data.rows.length) throw new Error('The dataset has no observations.');
  const keys = new Set<string>();
  const sizes = new Map<string, number>();
  const groups = new Map<string, number>();
  for (const entry of data.rows) {
    const row = object(entry);
    for (const field of ['time', 'tissue', 'taxon', 'treatment']) string(row[field]);
    const { total, positive, percent: pct, group } = row;
    if (typeof total !== 'number' || !Number.isSafeInteger(total) || total <= 0 ||
        typeof positive !== 'number' || !Number.isSafeInteger(positive) || positive < 0 || positive > total ||
        typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100 ||
        Math.abs(pct - 100 * positive / total) > 1e-8) throw new Error('Invalid counts or detection percentage.');
    if (typeof group !== 'number' || !Number.isInteger(group) || group < 0 || group >= data.groups.length) throw new Error('Invalid taxon group.');
    if (!Object.hasOwn(tissueNames, row.tissue as string)) throw new Error('Missing tissue label.');
    const key = JSON.stringify([row.time, row.tissue, row.taxon, row.treatment]);
    if (keys.has(key)) throw new Error('Duplicate observation.');
    keys.add(key);
    const cohort = JSON.stringify([row.time, row.tissue, row.treatment]);
    if (sizes.has(cohort) && sizes.get(cohort) !== total) throw new Error('Inconsistent cohort sample size.');
    sizes.set(cohort, total);
    const taxon = row.taxon as string;
    if (groups.has(taxon) && groups.get(taxon) !== group) throw new Error('Inconsistent taxon grouping.');
    groups.set(taxon, group);
  }
  return data as unknown as Dataset;
}

export function cellDescription(cell: Cell): string {
  const prefix = `${cell.taxon} · ${cell.tissue} · ${cell.treatment}`;
  const row = cell.observation;
  return row ? `${prefix} — ${percent(row.percent)}% positive (${row.positive} of ${row.total} shrimp).`
    : `${prefix} — no record; prevalence is unknown.`;
}

export function colorFor(value: number | undefined, palette: Palette): string {
  if (value === undefined) return '#e1e5e4';
  const stops = PALETTES[palette];
  const position = Math.max(0, Math.min(100, value)) / 25;
  const index = Math.min(3, Math.floor(position));
  const fraction = position - index;
  const a = stops[index]!;
  const b = stops[index + 1]!;
  const channels = [1, 3, 5].map(offset => Math.round(
    parseInt(a.slice(offset, offset + 2), 16) * (1 - fraction) +
    parseInt(b.slice(offset, offset + 2), 16) * fraction));
  return '#' + channels.map(channel => channel.toString(16).padStart(2, '0')).join('');
}
