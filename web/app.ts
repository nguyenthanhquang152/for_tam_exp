import rawData from './data.generated.json';
import { cellDescription, naturalOrder, parseDataset, percent, type Palette } from './model';
import { renderHeatmap } from './heatmap';
import { download, pngBlob, svgBlob } from './export';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing page element: ${id}`);
  return element as T;
}

function start(): void {
  const data = parseDataset(rawData);
  const times = [...new Set(data.rows.map(row => row.time))].sort(naturalOrder);
  const tissues = [...new Set(data.rows.map(row => row.tissue))].sort((a, b) => Number(a !== 'HP') - Number(b !== 'HP') || naturalOrder(a, b));
  const timeSelect = byId<HTMLSelectElement>('time-select');
  const paletteSelect = byId<HTMLSelectElement>('palette-select');
  const controls = byId<HTMLFieldSetElement>('controls');
  const viewOptions = byId('view-options');
  const chart = byId('chart');
  const details = byId('cell-details');
  const tooltip = byId('cell-tooltip');
  const status = byId('export-status');
  const initialDetails = details.textContent;
  let selected = 'all';
  let view: ReturnType<typeof renderHeatmap>;

  for (const time of times) timeSelect.add(new Option(time, time));
  const views = [{ value: 'all', label: 'Both tissues' }, ...tissues.map(tissue => ({ value: tissue, label: tissue }))];
  if (tissues.length !== 2) views[0]!.label = 'All tissues';
  for (const [index, option] of views.entries()) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'tissue'; input.value = option.value; input.checked = index === 0;
    const span = document.createElement('span'); span.textContent = option.label;
    label.append(input, span); viewOptions.append(label);
    input.addEventListener('change', () => { selected = input.value; render(); });
  }

  function render(): void {
    const selection = selected === 'all' ? tissues : [selected];
    const palette = paletteSelect.value as Palette;
    view = renderHeatmap(data, timeSelect.value, selection, palette);
    chart.replaceChildren(view.svg);
    tooltip.hidden = true;
    details.textContent = initialDetails;
    status.textContent = '';
    const body = byId('data-body');
    const fragment = document.createDocumentFragment();
    for (const cell of view.orderedCells) {
      const row = document.createElement('tr');
      const observation = cell.observation;
      const values = [cell.taxon, cell.tissue, cell.treatment, observation?.positive ?? 'Missing',
        observation?.total ?? 'Missing', observation ? percent(observation.percent) : 'Missing'];
      values.forEach((value, index) => {
        const element = document.createElement(index === 0 ? 'th' : 'td');
        if (element instanceof HTMLTableCellElement && index === 0) element.scope = 'row';
        element.textContent = String(value); row.append(element);
      });
      fragment.append(row);
    }
    body.replaceChildren(fragment);
    byId('record-count').textContent = `${view.orderedCells.length} cells`;
    const currentRows = data.rows.filter(row => row.time === timeSelect.value);
    byId('dataset-summary').textContent = `${timeSelect.value} · ${new Set(currentRows.map(row => row.taxon)).size} taxa\n${new Set(currentRows.map(row => row.treatment)).size} treatments · ${tissues.length} tissues`;

    function inspect(target: EventTarget | null): void {
      if (!(target instanceof SVGRectElement)) return;
      const cell = view.details.get(target);
      if (cell) {
        details.textContent = cellDescription(cell);
        tooltip.textContent = details.textContent;
        tooltip.hidden = false;
        const box = target.getBoundingClientRect();
        tooltip.style.left = `${Math.max(12, Math.min(innerWidth - tooltip.offsetWidth - 12, box.left + box.width / 2 - tooltip.offsetWidth / 2))}px`;
        const above = box.top - tooltip.offsetHeight - 10;
        tooltip.style.top = `${Math.max(12, above > 12 ? above : Math.min(innerHeight - tooltip.offsetHeight - 12, box.bottom + 10))}px`;
      }
    }
    view.svg.addEventListener('pointerover', event => inspect(event.target));
    view.svg.addEventListener('focusin', event => inspect(event.target));
    view.svg.addEventListener('pointerout', () => { tooltip.hidden = true; });
    view.svg.addEventListener('focusout', () => { tooltip.hidden = true; });
    view.svg.addEventListener('click', event => {
      if (!(event.target instanceof SVGRectElement) || !view.details.has(event.target)) return;
      for (const cell of view.cells) cell.setAttribute('tabindex', cell === event.target ? '0' : '-1');
      event.target.focus(); inspect(event.target);
    });
    view.svg.addEventListener('keydown', event => {
      if (!(event.target instanceof SVGRectElement)) return;
      const index = view.cells.indexOf(event.target);
      if (index < 0) return;
      const { columns, cells } = view;
      let next = index;
      const column = index % columns;
      if (event.key === 'Escape') { tooltip.hidden = true; details.textContent = initialDetails; event.preventDefault(); return; }
      if (event.key === 'ArrowLeft') next = column > 0 ? index - 1 : index;
      else if (event.key === 'ArrowRight') next = column < columns - 1 ? index + 1 : index;
      else if (event.key === 'ArrowUp') next = Math.max(column, index - columns);
      else if (event.key === 'ArrowDown') next = Math.min(cells.length - columns + column, index + columns);
      else if (event.key === 'Home') next = event.ctrlKey ? 0 : index - column;
      else if (event.key === 'End') next = event.ctrlKey ? cells.length - 1 : index - column + columns - 1;
      else return;
      event.preventDefault();
      cells[index]!.setAttribute('tabindex', '-1');
      cells[next]!.setAttribute('tabindex', '0');
      cells[next]!.focus();
    });
  }

  timeSelect.addEventListener('change', render);
  document.addEventListener('pointerdown', () => { tooltip.hidden = true; });
  document.addEventListener('scroll', () => { tooltip.hidden = true; }, true);
  paletteSelect.addEventListener('change', render);
  for (const format of ['svg', 'png'] as const) {
    byId<HTMLButtonElement>(`export-${format}`).addEventListener('click', async () => {
      controls.disabled = true;
      status.classList.remove('failure');
      status.textContent = `Preparing ${format.toUpperCase()}…`;
      try {
        const blob = format === 'svg' ? svgBlob(view.svg) : await pngBlob(view.svg);
        const name = `${timeSelect.value}_${selected === 'all' ? tissues.join('_') : selected}_${paletteSelect.value}_prevalence`
          .replace(/[^A-Za-z0-9_-]/g, '_');
        download(blob, `${name}.${format}`);
        status.textContent = `${format.toUpperCase()} is ready. ${format === 'png' ? `${view.width * 3} × ${view.height * 3} pixels.` : 'Scalable vector figure.'}`;
      } catch {
        status.classList.add('failure');
        status.textContent = `Could not create the ${format.toUpperCase()}. Try the other export format or retry in a current browser.`;
      } finally {
        controls.disabled = false;
      }
    });
  }
  byId('source-note').textContent = `Source: ${data.source.filename} · ${data.rows.length} validated taxon records`;
  render();
  controls.disabled = false;
}

try { start(); }
catch (error) {
  const message = byId('fatal-error');
  message.textContent = `The figure could not be loaded. ${error instanceof Error ? error.message : 'Invalid dataset.'} Rebuild from the corrected workbook.`;
  message.hidden = false;
  byId('explorer').hidden = true;
  byId('dataset-summary').textContent = 'Dataset unavailable';
}
