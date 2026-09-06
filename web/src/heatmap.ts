import { cellDescription, cellKey, colorFor, naturalOrder, PALETTES, type Cell, type Dataset, type Palette } from './model';

const NS = 'http://www.w3.org/2000/svg';
function node<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

export function renderHeatmap(data: Dataset, time: string, tissues: string[], palette: Palette) {
  const times = time === 'all' ? data.sources.map(source => source.time) : [time];
  const observations = data.rows.filter(row => times.includes(row.time));
  const visible = observations.filter(row => tissues.includes(row.tissue));
  const taxonGroups = new Map(data.rows.map(row => [row.taxon, row.group]));
  const taxa = [...taxonGroups.keys()].sort((a, b) => taxonGroups.get(a)! - taxonGroups.get(b)! ||
    Number(!a.startsWith('Vibrio ')) - Number(!b.startsWith('Vibrio ')) || naturalOrder(a, b));
  const treatments = [...new Set(data.rows.map(row => row.treatment))].sort(naturalOrder);
  const columns = treatments.flatMap(treatment => times.map(time => ({ treatment, time })));
  const lookup = new Map(visible.map(row => [cellKey(row.time, row.taxon, row.tissue, row.treatment), row]));
  const left = 374, cellWidth = times.length > 1 ? (tissues.length === 1 ? 28 : 22) : (tissues.length === 1 ? 94 : 72), rowHeight = 28, panelGap = 46;
  const panelWidth = columns.length * cellWidth;
  const right = left + tissues.length * panelWidth + (tissues.length - 1) * panelGap;
  const legendX = right + 38, width = legendX + 158;
  let cursor = 200;
  const positions = new Map<string, number>();
  const headings: { text: string; color: string; y: number; rule: number }[] = [];
  for (const [groupIndex, group] of data.groups.entries()) {
    const members = taxa.filter(taxon => taxonGroups.get(taxon) === groupIndex);
    if (!members.length) continue;
    const labelColor = ['#bb281d', '#146b91', '#527b28'][groupIndex] ?? group.color;
    headings.push({ text: group.name, color: labelColor, y: cursor, rule: headings.length ? cursor - 16 : cursor + 12 });
    members.forEach((taxon, index) => positions.set(taxon, cursor + 18 + index * rowHeight));
    cursor += 18 + members.length * rowHeight + 48;
  }
  const bottom = cursor - 48, height = bottom + 132;
  const svg = node('svg', {
    xmlns: NS, viewBox: `0 0 ${width} ${height}`, width, height,
    class: tissues.length === 1 ? 'heatmap single' : 'heatmap', role: 'grid',
    'aria-labelledby': 'heatmap-title', 'aria-describedby': 'heatmap-description',
    'aria-rowcount': taxa.length, 'aria-colcount': tissues.length * columns.length,
    'font-family': 'Arial, Helvetica, sans-serif', 'font-size': 14,
  });
  svg.append(node('title', { id: 'heatmap-title' }, `Bacterial detection prevalence: ${times.join(', ')}, ${tissues.join(' and ')}`));
  svg.append(node('desc', { id: 'heatmap-description' }, 'Percentage of examined shrimp positive for each taxon. Columns follow treatment then chronological sampling day. Use arrow keys between cells or read the data table. White means zero; grey means an unlisted taxon or incomplete measurements.'));
  const backdrop = node('g', { 'aria-hidden': 'true' });
  svg.append(backdrop);
  backdrop.append(node('rect', { width, height, fill: '#ffffff' }));
  backdrop.append(node('text', { x: 36, y: 43, 'font-size': 25, 'font-weight': 600, fill: '#263f43' }, 'Culturable microbiota in whiteleg shrimp'));
  backdrop.append(node('text', { x: 36, y: 70, 'font-size': 13, fill: '#607579' }, `${times.join(' → ')}  /  Shrimp positive (%)  /  ${taxa.length} bacterial taxa`));
  backdrop.append(node('line', { x1: 36, x2: width - 36, y1: 91, y2: 91, stroke: '#d6e0dc' }));
  backdrop.append(node('text', { x: 36, y: 159, 'font-size': 10, 'font-weight': 700, 'letter-spacing': 1.3, fill: '#607579' }, 'BACTERIAL TAXA'));
  tissues.forEach((tissue, panel) => {
    const x = left + panel * (panelWidth + panelGap);
    backdrop.append(node('text', { x: x + panelWidth / 2, y: 132, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 600, fill: '#263f43' }, data.tissueNames[tissue] ?? tissue));
    treatments.forEach((treatment, column) => backdrop.append(node('text', {
      x: x + (column + 0.5) * times.length * cellWidth, y: times.length > 1 ? 159 : 169, 'text-anchor': 'middle',
      'font-size': 13, 'font-weight': 700, fill: '#435c60',
    }, treatment)));
    if (times.length > 1) columns.forEach((column, index) => backdrop.append(node('text', {
      class: 'sampling-label', 'data-time': column.time,
      x: x + (index + 0.5) * cellWidth, y: 184, 'text-anchor': 'middle', 'font-size': 10, fill: '#435c60',
    }, column.time.replace(/^DOC/, ''))));
  });
  if (times.length > 1) backdrop.append(node('text', { x: left - 19, y: 184, 'text-anchor': 'end', 'font-size': 10, fill: '#607579' }, 'Sampling day'));
  for (const heading of headings) {
    backdrop.append(node('text', { x: 36, y: heading.y, fill: heading.color, 'font-size': 14, 'font-weight': 700 }, heading.text));
  }
  for (const taxon of taxa) {
    backdrop.append(node('text', { x: left - 19, y: positions.get(taxon)! + 19, 'text-anchor': 'end', 'font-style': 'italic', 'font-size': 14, fill: '#354f54' }, taxon));
  }
  const rowGroup = node('g', { role: 'rowgroup' });
  svg.append(rowGroup);
  const cells: SVGRectElement[] = [];
  const details = new Map<SVGRectElement, Cell>();
  const orderedCells: Cell[] = [];
  taxa.forEach((taxon, rowIndex) => {
    const row = node('g', { role: 'row', 'aria-rowindex': rowIndex + 1 });
    rowGroup.append(row);
    tissues.forEach((tissue, panel) => columns.forEach(({ treatment, time }, column) => {
      const observation = lookup.get(cellKey(time, taxon, tissue, treatment));
      const cell: Cell = { time, taxon, tissue, treatment, observation };
      const rect = node('rect', {
        x: left + panel * (panelWidth + panelGap) + column * cellWidth,
        y: positions.get(taxon)!, width: cellWidth, height: rowHeight,
        fill: colorFor(observation?.percent, palette), class: 'cell',
        role: 'gridcell', tabindex: cells.length === 0 ? 0 : -1,
        'aria-colindex': panel * columns.length + column + 1,
        'aria-label': cellDescription(cell),
        'data-taxon': taxon, 'data-time': time, 'data-tissue': tissue, 'data-treatment': treatment,
        'data-percent': observation ? observation.percent ?? 'unknown' : 'missing',
      });
      row.append(rect);
      cells.push(rect); details.set(rect, cell); orderedCells.push(cell);
    }));
  });
  const rules = node('g', { 'aria-hidden': 'true', 'pointer-events': 'none' });
  svg.append(rules);
  for (const heading of headings) rules.append(node('line', {
    class: 'section-rule', x1: 36, x2: right, y1: heading.rule, y2: heading.rule,
    stroke: '#aab6b2', 'stroke-width': 1.5, 'stroke-dasharray': '7 5',
  }));
  const top = Math.min(...positions.values());
  tissues.forEach((_, panel) => {
    const x = left + panel * (panelWidth + panelGap);
    rules.append(node('line', { class: 'taxon-divider', x1: x, x2: x, y1: top, y2: bottom, stroke: '#c6ccca', 'stroke-width': 5 }));
    for (let column = 1; column < treatments.length; column++) rules.append(node('line', {
      class: 'treatment-rule', x1: x + column * times.length * cellWidth, x2: x + column * times.length * cellWidth,
      y1: 183, y2: bottom, stroke: '#aab6b2', 'stroke-width': 0.8, 'stroke-dasharray': '2 3',
    }));
    rules.append(node('line', { x1: x, x2: x + panelWidth, y1: bottom, y2: bottom, stroke: '#aab6b2' }));
  });
  const legend = node('g', { 'aria-hidden': 'true' });
  svg.append(legend);
  const defs = node('defs');
  const gradient = node('linearGradient', { id: 'prevalence-gradient', x1: 0, y1: 1, x2: 0, y2: 0 });
  PALETTES[palette].forEach((color, i) => gradient.append(node('stop', { offset: `${i * 25}%`, 'stop-color': color })));
  defs.append(gradient); legend.append(defs);
  legend.append(node('text', { x: legendX, y: 200, 'font-size': 12, 'font-weight': 700, fill: '#435c60' }, 'Shrimp positive'));
  legend.append(node('text', { x: legendX, y: 219, 'font-size': 12, fill: '#607579' }, '(%)'));
  legend.append(node('rect', { x: legendX, y: 242, width: 15, height: 185, fill: 'url(#prevalence-gradient)' }));
  for (const value of [0, 25, 50, 75, 100]) legend.append(node('text', {
    x: legendX + 25, y: 242 + (100 - value) / 100 * 185 + 4, 'font-size': 11, fill: '#4d656a',
  }, String(value)));
  legend.append(node('rect', { x: legendX, y: 451, width: 14, height: 14, fill: colorFor(undefined, palette) }));
  legend.append(node('text', { x: legendX + 24, y: 462, 'font-size': 11, fill: '#4d656a' }, 'Unknown / unlisted'));
  const samples = [...new Set(visible.map(row => row.total))].sort((a, b) => a - b);
  const sampleNote = samples.length === 1 ? `n = ${samples[0]} shrimp per treatment and tissue${times.length > 1 ? ' at each sampling day' : ''}.`
    : samples.length ? `Sample sizes vary (n = ${samples[0]}–${samples.at(-1)}). See cell details or the data table.`
    : 'No observations for this selection.';
  legend.append(node('text', { class: 'sample-note', x: 36, y: bottom + 39, 'font-size': 12, fill: '#435c60' }, sampleNote));
  legend.append(node('text', { x: 36, y: bottom + 62, 'font-size': 11, fill: '#607579' }, 'Detection prevalence = positive shrimp ÷ examined shrimp × 100. Multiple taxa can occur in one shrimp.'));
  const incomplete = visible.filter(row => row.missing > 0).length;
  const note = incomplete ? `${incomplete} percentages are unknown because measurements are incomplete. Gray also marks taxa not listed in a source.`
    : 'Percentages across taxa need not sum to 100. Gray marks taxa not listed in a source.';
  legend.append(node('text', { x: 36, y: bottom + 82, 'font-size': 11, fill: '#607579' }, note));
  legend.append(node('text', { x: 36, y: bottom + 110, 'font-size': 10, fill: '#607579' }, `Sources: ${data.sources.filter(source => times.includes(source.time)).map(source => source.filename).join(' → ')}`));
  return { svg, cells, details, orderedCells, columns: tissues.length * columns.length, width, height };
}
