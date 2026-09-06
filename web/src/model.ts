export interface Observation {
  time: string; tissue: string; taxon: string; treatment: string;
  total: number; positive: number | null; percent: number | null; group: number;
  missing: number; observedPositive: number;
}
export interface Dataset {
  schemaVersion: 2;
  sources: { filename: string; sha256: string; time: string }[];
  groups: { name: string; color: string }[];
  tissueNames: Record<string, string>;
  rows: Observation[];
}
export interface Cell {
  time: string; taxon: string; tissue: string; treatment: string; observation: Observation | undefined;
}
export type Palette = 'red' | 'blue' | 'teal';
export const PALETTES: Record<Palette, readonly string[]> = {
  red: ['#ffffff', '#fee5d9', '#fcae91', '#fb6a4a', '#cb181d'],
  blue: ['#ffffff', '#dbeafe', '#93c5fd', '#3b82f6', '#1e40af'],
  teal: ['#ffffff', '#ccfbf1', '#5eead4', '#14b8a6', '#0f766e'],
};
const percentageFormatter = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
export const percent = (value: number): string => percentageFormatter.format(value);
export const naturalOrder = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true });
export const cellKey = (time: string, taxon: string, tissue: string, treatment: string): string => JSON.stringify([time, taxon, tissue, treatment]);

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
  if (data.schemaVersion !== 2) throw new Error('Unsupported dataset version.');
  if (!Array.isArray(data.sources) || !data.sources.length) throw new Error('Missing data sources.');
  const times = new Set<string>();
  for (const entry of data.sources) {
    const source = object(entry);
    string(source.filename);
    if (!/^[a-f0-9]{64}$/.test(string(source.sha256))) throw new Error('Invalid source fingerprint.');
    const time = string(source.time);
    if (times.has(time)) throw new Error('Duplicate sampling source.');
    times.add(time);
  }
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
    if (!times.has(row.time as string)) throw new Error('Observation has no source.');
    const { total, positive, percent: pct, group, missing, observedPositive } = row;
    if (typeof total !== 'number' || !Number.isSafeInteger(total) || total <= 0 ||
        typeof missing !== 'number' || !Number.isSafeInteger(missing) || missing < 0 || missing > total ||
        typeof observedPositive !== 'number' || !Number.isSafeInteger(observedPositive) || observedPositive < 0 || observedPositive > total - missing) throw new Error('Invalid counts or missing measurements.');
    if (missing > 0) {
      if (positive !== null || pct !== null) throw new Error('Incomplete measurements must have unknown prevalence.');
    } else if (typeof positive !== 'number' || !Number.isSafeInteger(positive) || positive < 0 || positive > total || observedPositive !== positive ||
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
  if (new Set(data.rows.map(row => object(row).time)).size !== times.size) throw new Error('Source has no observations.');
  return data as unknown as Dataset;
}

export function cellDescription(cell: Cell): string {
  const prefix = `${cell.taxon} · ${cell.time} · ${cell.tissue} · ${cell.treatment}`;
  const row = cell.observation;
  if (!row) return `${prefix} — taxon not listed in this source; prevalence is unknown.`;
  if (row.percent === null) return `${prefix} — unknown prevalence: ${row.missing} of ${row.total} measurements missing; ${row.observedPositive} positives observed.`;
  return `${prefix} — ${percent(row.percent)}% positive (${row.positive} of ${row.total} shrimp).`;
}

export function colorFor(value: number | null | undefined, palette: Palette): string {
  if (value === undefined || value === null) return '#e1e5e4';
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
