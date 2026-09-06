import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const data = JSON.parse(await readFile('dist/data.json', 'utf8'));
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.__errors = errors;
  await page.goto('/');
  await expect(page.locator('.cell')).toHaveCount(150);
});
test.afterEach(async ({ page }) => { expect(page.__errors).toEqual([]); });

test('all 150 values and requested figure styling match the workbook', async ({ page }) => {
  const cells = await page.locator('.cell').evaluateAll(elements => elements.map(element => ({ ...element.dataset, label: element.getAttribute('aria-label') })));
  for (const row of data.rows) {
    const cell = cells.find(cell => cell.taxon === row.taxon && cell.tissue === row.tissue && cell.treatment === row.treatment);
    expect(Number(cell.percent)).toBe(100 * row.positive / row.total);
    expect(cell.label).toContain(`${row.positive} of ${row.total} shrimp`);
  }
  await expect(page.locator('.cell text')).toHaveCount(0);
  await expect(page.locator('.sample-note')).toHaveText('n = 5 shrimp per treatment and tissue.');
  await expect(page.locator('.section-rule')).toHaveCount(3);
  await expect(page.locator('.taxon-divider')).toHaveCount(2);
  await expect(page.locator('.taxon-divider').first()).toHaveAttribute('stroke-width', '5');
  await expect(page.locator('.treatment-rule')).toHaveCount(8);
  await expect(page.locator('.cell[tabindex="0"]')).toHaveCount(1);
  await page.getByText('View underlying data', { exact: false }).click();
  await expect(page.locator('#data-body tr')).toHaveCount(150);
});

test('tissue, palette, pointer and keyboard controls preserve scientific values', async ({ page }) => {
  await page.getByRole('radio', { name: 'HP', exact: true }).check();
  await expect(page.locator('.cell')).toHaveCount(75);
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
  await expect(page.locator('#cell-details')).toContainText('Vibrio brasiliensis · HP · F0');
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
  await expect(page.locator('.cell')).toHaveCount(75);
  await expect(page.locator('.cell[data-taxon="Vibrio tubiashii"][data-treatment="F0"]')).toHaveAttribute('data-percent', '80');
  await page.getByRole('radio', { name: 'Both tissues' }).check();
  await expect(page.locator('.cell')).toHaveCount(150);
});

test('SVG and PNG exports work for all views and PNG pixels match SVG cells', async ({ page }, info) => {
  for (const [view, stem, cellCount] of [['Both tissues', 'HP_Gut', 150], ['HP', 'HP', 75], ['Gut', 'Gut', 75]]) {
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
      const file = info.outputPath(`${stem}.${format}`);
      await download.saveAs(file);
      const buffer = await readFile(file);
      expect(download.suggestedFilename()).toBe(`DOC56_${stem}_red_prevalence.${format}`);
      if (format === 'svg') {
        const svg = buffer.toString('utf8');
        expect(svg.match(/class="cell"/g)).toHaveLength(cellCount);
        expect(svg).not.toContain('tabindex');
        expect(svg).not.toContain('<script');
        expect(svg).toContain('n = 5 shrimp per treatment and tissue.');
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
        await mkdir('dist/exports', { recursive: true });
        await download.saveAs(`dist/exports/${download.suggestedFilename()}`);
      }
    }
  }
});

test('accessible controls, grid and expanded table have no automated WCAG A/AA violations', async ({ page }) => {
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
  if (info.project.name === 'chromium') await page.screenshot({ path: 'dist/mobile-preview.png', fullPage: true });
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
  await expect(page.locator('.cell')).toHaveCount(150);
  await expect(page.locator('script[src], link[rel="stylesheet"]')).toHaveCount(0);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'none'");
  expect(csp).not.toContain("'unsafe-inline'");
  if (info.project.name === 'chromium') await page.screenshot({ path: 'dist/preview.png', fullPage: true });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG' }).click();
  await downloadEvent;
  expect(networkRequests).toEqual([]);
  if (info.project.name === 'chromium') {
    await page.emulateMedia({ media: 'print' });
    await mkdir('dist/exports', { recursive: true });
    await page.pdf({ path: 'dist/exports/DOC56_HP_Gut_prevalence.pdf', printBackground: true, preferCSSPageSize: true });
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
