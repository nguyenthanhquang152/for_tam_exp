import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const data = JSON.parse(await readFile('dist/data.json', 'utf8'));
await mkdir('reports/previews', { recursive: true });
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.__errors = errors;
  await page.goto('/');
  await expect(page.locator('.cell')).toHaveCount(640);
});
test.afterEach(async ({ page }) => { expect(page.__errors).toEqual([]); });

test('all sources, chronological columns and unknown cells match the workbooks', async ({ page }) => {
  const cells = await page.locator('.cell').evaluateAll(elements => elements.map(element => ({ ...element.dataset, label: element.getAttribute('aria-label') })));
  for (const row of data.rows) {
    const cell = cells.find(cell => cell.time === row.time && cell.taxon === row.taxon && cell.tissue === row.tissue && cell.treatment === row.treatment);
    if (row.percent === null) {
      expect(cell.percent).toBe('unknown');
      expect(cell.label).toContain(`${row.observedPositive} positives observed`);
    } else {
      expect(Number(cell.percent)).toBe(100 * row.positive / row.total);
      expect(cell.label).toContain(`${row.positive} of ${row.total} shrimp`);
    }
  }
  expect(await page.locator('#time-select option').evaluateAll(options => options.map(option => option.value)))
    .toEqual(['all', 'DOC14', 'DOC28', 'DOC42', 'DOC56']);
  expect(await page.locator('.sampling-label').evaluateAll(labels => labels.slice(0, 8).map(label => label.dataset.time)))
    .toEqual(['DOC14', 'DOC28', 'DOC42', 'DOC56', 'DOC14', 'DOC28', 'DOC42', 'DOC56']);
  await expect(page.locator('.cell[data-percent="unknown"]')).toHaveCount(25);
  await expect(page.locator('.cell[data-percent="missing"]')).toHaveCount(80);
  await expect(page.locator('.cell text')).toHaveCount(0);
  await expect(page.locator('.sample-note')).toHaveText('n = 5 shrimp per treatment and tissue at each sampling day.');
  await expect(page.locator('.section-rule')).toHaveCount(3);
  await expect(page.locator('.taxon-divider')).toHaveCount(2);
  await expect(page.locator('.taxon-divider').first()).toHaveAttribute('stroke-width', '5');
  await expect(page.locator('.treatment-rule')).toHaveCount(8);
  await expect(page.locator('.cell[tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('#data-body tr')).toHaveCount(0);
  await page.getByText('View underlying data', { exact: false }).click();
  await expect(page.locator('#data-body tr')).toHaveCount(640);
  await page.getByLabel('Sampling time').selectOption('DOC42');
  await expect(page.locator('#data-body tr')).toHaveCount(160);
});

test('each sampling day retains aligned taxa and distinguishes blanks from unlisted taxa and zeros', async ({ page }) => {
  for (const [time, absent, incomplete] of [['DOC14', 30, 0], ['DOC28', 20, 0], ['DOC42', 20, 25], ['DOC56', 10, 0]]) {
    await page.getByLabel('Sampling time').selectOption(time);
    await expect(page.locator('.cell')).toHaveCount(160);
    await expect(page.locator(`.cell[data-time="${time}"]`)).toHaveCount(160);
    await expect(page.locator('.cell[data-percent="missing"]')).toHaveCount(absent);
    await expect(page.locator('.cell[data-percent="unknown"]')).toHaveCount(incomplete);
  }
  await page.getByLabel('Sampling time').selectOption('DOC42');
  const incomplete = page.locator('.cell[data-taxon="Vibrio jasicida"][data-tissue="HP"][data-treatment="F0"]');
  await incomplete.hover();
  await expect(incomplete).toHaveAttribute('fill', '#e1e5e4');
  await expect(page.getByRole('tooltip')).toContainText('1 of 5 measurements missing; 4 positives observed');
  await expect(page.locator('.cell[data-taxon="Mesoflavibacter zeaxanthinifaciens"][data-tissue="HP"][data-treatment="F0"]')).toHaveAttribute('fill', '#ffffff');
  await page.getByLabel('Sampling time').selectOption('DOC14');
  await expect(page.locator('.cell[data-taxon="Ruegeria profundi"][data-percent="missing"]')).toHaveCount(10);
  await expect(page.locator('.cell[data-taxon="Ruegeria arenilitoris"][data-percent="missing"]')).toHaveCount(0);
  await expect(page.locator('.cell[data-taxon="Micrococcus luteus"][data-percent="missing"]')).toHaveCount(10);
});

test('tissue, palette, pointer and keyboard controls preserve scientific values', async ({ page }) => {
  await page.getByLabel('Sampling time').selectOption('DOC56');
  await page.getByRole('radio', { name: 'HP', exact: true }).check();
  await expect(page.locator('.cell')).toHaveCount(80);
  const maximum = page.locator('.cell[data-taxon="Vibrio tubiashii"][data-treatment="F0"]');
  await expect(maximum).toHaveAttribute('data-percent', '100');
  await maximum.hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(page.locator('#cell-details')).toContainText('100% positive (5 of 5 shrimp)');
  await page.getByLabel('Color palette').selectOption('blue');
  await expect(maximum).toHaveAttribute('fill', '#1e40af');
  await page.getByLabel('Color palette').selectOption('teal');
  await expect(maximum).toHaveAttribute('fill', '#0f766e');
  const first = page.locator('.cell').first();
  await first.focus();
  await expect(page.locator('#cell-details')).toContainText('Vibrio brasiliensis · DOC56 · HP · F0');
  await page.mouse.move(20, 20);
  await maximum.hover();
  await expect(page.locator('#cell-details')).toContainText('Vibrio tubiashii · DOC56 · HP · F0');
  await expect(first).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.locator('#cell-details')).toContainText('Vibrio brasiliensis · DOC56 · HP · F0');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.cell').nth(1)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.cell').nth(6)).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('.cell').nth(9)).toBeFocused();
  await page.keyboard.press('Control+End');
  await expect(page.locator('.cell').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cell-details')).toContainText('Select a cell');
  await page.getByRole('radio', { name: 'Gut', exact: true }).check();
  await expect(page.locator('.cell')).toHaveCount(80);
  await expect(page.locator('.cell[data-taxon="Vibrio tubiashii"][data-treatment="F0"]')).toHaveAttribute('data-percent', '80');
  await page.getByRole('radio', { name: 'Both tissues' }).check();
  await expect(page.locator('.cell')).toHaveCount(160);
});

test('SVG and PNG exports work for all views and PNG pixels match SVG cells', async ({ page }, info) => {
  test.setTimeout(120_000);
  const cases = [['all', 'Both tissues', 'HP_Gut', 640], ['all', 'HP', 'HP', 320], ['all', 'Gut', 'Gut', 320],
    ...['DOC14', 'DOC28', 'DOC42', 'DOC56'].map(time => [time, 'Both tissues', 'HP_Gut', 160]),
    ['DOC56', 'HP', 'HP', 80], ['DOC56', 'Gut', 'Gut', 80]];
  for (const [time, view, stem, cellCount] of cases) {
    await page.getByLabel('Sampling time').selectOption(time);
    await page.getByRole('radio', { name: view, exact: true }).check();
    const geometry = await page.locator('#chart svg').evaluate(svg => ({
      width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height,
      centers: [...svg.querySelectorAll('.cell')].map(cell => ({
        x: Math.floor((Number(cell.getAttribute('x')) + Number(cell.getAttribute('width')) / 2) * 3),
        y: Math.floor((Number(cell.getAttribute('y')) + Number(cell.getAttribute('height')) / 2) * 3),
        fill: cell.getAttribute('fill'),
      })),
    }));
    for (const format of ['svg', 'png']) {
      const downloadEvent = page.waitForEvent('download');
      await page.getByRole('button', { name: format === 'svg' ? 'Download SVG' : /Download PNG/ }).click();
      const download = await downloadEvent;
      const file = info.outputPath(`${time}_${stem}.${format}`);
      await download.saveAs(file);
      const buffer = await readFile(file);
      const sampling = time === 'all' ? 'DOC14_DOC28_DOC42_DOC56' : time;
      expect(download.suggestedFilename()).toBe(`${sampling}_${stem}_red_prevalence.${format}`);
      if (format === 'svg') {
        const svg = buffer.toString('utf8');
        expect(svg.match(/class="cell"/g)).toHaveLength(cellCount);
        expect(svg).not.toContain('tabindex');
        expect(svg).not.toContain('<script');
        expect(svg).toContain('n = 5 shrimp per treatment and tissue');
      } else {
        expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(buffer.readUInt32BE(16)).toBe(geometry.width * 3);
        expect(buffer.readUInt32BE(20)).toBe(geometry.height * 3);
        const pixels = await page.evaluate(async ({ url, centers }) => {
          const image = new Image(); image.src = url; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
          return centers.map(({ x, y }) => [...ctx.getImageData(x, y, 1, 1).data]);
        }, { url: `data:image/png;base64,${buffer.toString('base64')}`, centers: geometry.centers });
        geometry.centers.forEach((center, i) => expect(pixels[i]).toEqual([
          ...[1, 3, 5].map(offset => parseInt(center.fill.slice(offset, offset + 2), 16)), 255,
        ]));
      }
      if (info.project.name === 'chromium') {
        await mkdir('reports/web', { recursive: true });
        await download.saveAs(`reports/web/${download.suggestedFilename()}`);
      }
    }
  }
});

test('accessible controls, grid and expanded table have no automated WCAG A/AA violations', async ({ page }) => {
  test.setTimeout(120_000);
  await page.getByText('View underlying data', { exact: false }).click();
  await page.getByText('How to read this figure', { exact: true }).click();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test.describe('mobile', () => {
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test('layout contains wide content and supports touch inspection', async ({ page }, info) => {
  const sizes = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth,
    chart: document.getElementById('chart-scroll').scrollWidth, frame: document.getElementById('chart-scroll').clientWidth }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
  expect(sizes.chart).toBeGreaterThan(sizes.frame);
  await page.locator('.cell').first().tap();
  await expect(page.locator('#cell-details')).toContainText('Vibrio brasiliensis');
  await page.keyboard.press('Control+End');
  await expect(page.locator('.cell').last()).toBeFocused();
  await expect(page.locator('#cell-details')).toContainText('Tenacibaculum pelagium');
  if (info.project.name === 'chromium') await page.screenshot({ path: 'reports/previews/mobile-preview.png', fullPage: true });
});
});

test('standalone HTML works offline and has no external data or script dependencies', async ({ page, context }, info) => {
  // WebKit's offline emulation rejects file: itself. Deny HTTP(S) directly.
  const networkRequests = [];
  await context.route(/^https?:\/\//, route => {
    networkRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto(pathToFileURL(path.resolve('dist/heatmap.html')).href);
  await expect(page.locator('.cell')).toHaveCount(640);
  await expect(page.locator('script[src], link[rel="stylesheet"]')).toHaveCount(0);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'none'");
  expect(csp).not.toContain("'unsafe-inline'");
  if (info.project.name === 'chromium') await page.screenshot({ path: 'reports/previews/preview.png', fullPage: true });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG' }).click();
  await downloadEvent;
  expect(networkRequests).toEqual([]);
  if (info.project.name === 'chromium') {
    await page.emulateMedia({ media: 'print' });
    await mkdir('reports/web', { recursive: true });
    await page.pdf({ path: 'reports/web/DOC14_DOC28_DOC42_DOC56_HP_Gut_prevalence.pdf', printBackground: true, preferCSSPageSize: true });
  }
});

test('PNG encoding failures produce a useful message and restore export controls', async ({ page }) => {
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = function (callback) { callback(null); }; });
  await page.getByRole('button', { name: /Download PNG/ }).click();
  await expect(page.locator('#export-status')).toContainText('Could not create the PNG');
  await expect(page.getByRole('button', { name: 'Download SVG' })).toBeEnabled();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG' }).click();
  await downloadEvent;
});
