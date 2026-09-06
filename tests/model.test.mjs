import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['web/model.ts'], bundle: true, format: 'esm', write: false });
const { parseDataset, colorFor, cellDescription } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const data = JSON.parse(readFileSync('dist/data.json', 'utf8'));

test('browser dataset preserves all source percentages and group assignments', () => {
  assert.equal(parseDataset(data).rows.length, 560);
  for (const row of data.rows) assert.equal(row.percent, row.missing ? null : 100 * row.positive / row.total);
  assert.deepEqual(data.sources.map(source => source.time), ['DOC14', 'DOC28', 'DOC42', 'DOC56']);
  assert.equal(data.rows.filter(row => row.percent === null).length, 25);
  assert.equal(data.groups.length, 3);
  const csv = readFileSync('plots/plotted_data.csv', 'utf8').trim().split(/\r?\n/).slice(1);
  assert.equal(csv.length, data.rows.length);
  for (const [index, line] of csv.entries()) {
    const [time, tissue, taxon, treatment, total, positive, , pct, missing, observed] = line.split(',');
    const row = data.rows[index];
    assert.deepEqual([row.time, row.tissue, row.taxon, row.treatment, row.total, row.positive, row.percent, row.missing, row.observedPositive],
      [time, tissue, taxon, treatment, Number(total), positive === '' ? null : Number(positive), pct === '' ? null : Number(pct), Number(missing), Number(observed)]);
  }
});

test('invalid counts, inconsistent metadata and duplicates fail validation', () => {
  const mutations = [
    d => { d.schemaVersion = 1; }, d => { d.rows = []; },
    d => { d.rows.push(d.rows[0]); }, d => { d.rows[0].positive = 6; },
    d => { d.rows[0].total = 0; }, d => { d.rows[0].percent = 99; },
    d => { d.rows[0].positive = 1.5; }, d => { d.rows[0].percent = NaN; },
    d => { d.rows[0].taxon = ''; }, d => { d.rows[0].group = 99; },
    d => { d.rows[0].total = 10; d.rows[0].percent = 50; },
    d => { d.rows[30].group = 2; }, d => { delete d.tissueNames.HP; },
    d => { d.sources.push(d.sources[0]); }, d => { d.rows[0].time = 'DOC99'; },
    d => { d.rows.find(row => row.missing > 0).percent = 80; },
    d => { d.rows.find(row => row.missing > 0).positive = 4; },
    d => { d.rows.find(row => row.missing > 0).observedPositive = 5; },
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
    assert.equal(colorFor(null, palette), '#e1e5e4');
  }
  assert.match(cellDescription({ time: 'DOC14', taxon: 'Taxon', tissue: 'HP', treatment: 'F0' }), /unknown/);
  const incomplete = data.rows.find(row => row.time === 'DOC42' && row.tissue === 'HP' && row.treatment === 'F0' && row.taxon === 'Vibrio jasicida');
  assert.match(cellDescription({ ...incomplete, observation: incomplete }), /1 of 5 measurements missing; 4 positives observed/);
});

test('inline bundle safely escapes source labels that contain HTML closing tags', async () => {
  const payload = '</script><img src=x onerror=alert(1)>';
  const result = await build({ stdin: { contents: `globalThis.label = ${JSON.stringify(payload)}` }, minify: true, write: false });
  assert.ok(!result.outputFiles[0].text.toLowerCase().includes('</script>'));
});
