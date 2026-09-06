import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['web/model.ts'], bundle: true, format: 'esm', write: false });
const { parseDataset, colorFor, cellDescription } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const data = JSON.parse(readFileSync('dist/data.json', 'utf8'));

test('browser dataset preserves all source percentages and group assignments', () => {
  assert.equal(parseDataset(data).rows.length, 150);
  for (const row of data.rows) assert.equal(row.percent, 100 * row.positive / row.total);
  assert.equal(data.source.filename, 'MA_56D_R_corrected.xlsx');
  assert.equal(data.groups.length, 3);
  const csv = readFileSync('plots/plotted_data.csv', 'utf8').trim().split(/\r?\n/).slice(1);
  assert.equal(csv.length, data.rows.length);
  for (const [index, line] of csv.entries()) {
    const [time, tissue, taxon, treatment, total, positive, , pct] = line.split(',');
    const row = data.rows[index];
    assert.deepEqual([row.time, row.tissue, row.taxon, row.treatment, row.total, row.positive, row.percent],
      [time, tissue, taxon, treatment, Number(total), Number(positive), Number(pct)]);
  }
});

test('invalid counts, inconsistent metadata and duplicates fail validation', () => {
  const mutations = [
    d => { d.schemaVersion = 2; }, d => { d.rows = []; },
    d => { d.rows.push(d.rows[0]); }, d => { d.rows[0].positive = 6; },
    d => { d.rows[0].total = 0; }, d => { d.rows[0].percent = 99; },
    d => { d.rows[0].positive = 1.5; }, d => { d.rows[0].percent = NaN; },
    d => { d.rows[0].taxon = ''; }, d => { d.rows[0].group = 99; },
    d => { d.rows[0].total = 10; d.rows[0].percent = 20; },
    d => { d.rows[30].group = 2; }, d => { delete d.tissueNames.HP; },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(data); mutate(copy);
    assert.throws(() => parseDataset(copy));
  }
});

test('missing values stay distinct from zero and every palette has fixed endpoints', () => {
  for (const [palette, maximum] of [['red', '#cb181d'], ['blue', '#1e40af'], ['teal', '#0f766e']]) {
    assert.equal(colorFor(0, palette), '#ffffff');
    assert.equal(colorFor(100, palette), maximum);
    assert.equal(colorFor(undefined, palette), '#e1e5e4');
  }
  assert.match(cellDescription({ taxon: 'Taxon', tissue: 'HP', treatment: 'F0' }), /unknown/);
});

test('inline bundle safely escapes source labels that contain HTML closing tags', async () => {
  const payload = '</script><img src=x onerror=alert(1)>';
  const result = await build({ stdin: { contents: `globalThis.label = ${JSON.stringify(payload)}` }, minify: true, write: false });
  assert.ok(!result.outputFiles[0].text.toLowerCase().includes('</script>'));
});
