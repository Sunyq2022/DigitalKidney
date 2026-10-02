const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const p = require('./physics.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'study-data.json')));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'physics-fixtures.json')));
let maxError = 0;
for (const fixture of fixtures) {
  const parameters = p.effective(data.model.baseline, fixture.severity);
  for (const [actual, expected] of [
    [p.concentration(data.model.aif, parameters, data.model.dt), fixture.concentration],
    [p.enhancement(data.model.aif, parameters, data.model.dt, data.model.relaxivity), fixture.enhancement]
  ]) {
    assert.equal(actual.length, expected.length);
    for (let i = 0; i < actual.length; i++) { const error = Math.abs(actual[i] - expected[i]); maxError = Math.max(maxError, error); assert.ok(error < 1e-10, `${i}: ${error}`); }
  }
}
for (let normal = 0; normal <= 512; normal += 16) {
  const fields = Array.from({length: 512}, (_, i) => i < normal ? [0, 0, 0] : [.4, .5, .2]);
  const fixed = p.backgroundFix(fields, data.model.baseline, .2, false);
  for (let i = 0; i < fields.length; i++) {
    const before = p.effective(data.model.baseline, fields[i]), after = p.effective(fixed.baseline, fixed.severity[i]);
    for (let k = 0; k < 4; k++) assert.ok(Math.abs(before[k] - after[k]) < 1e-12);
  }
}
const diffuse = p.backgroundFix(Array.from({length:512}, () => [.4,.5,.2]), data.model.baseline,.2);
assert.deepEqual(diffuse.severity[0], [0,0,0]);
assert.notDeepEqual(diffuse.baseline, data.model.baseline);
assert.equal(p.quantile([0,0,1,1],.2),0);
assert.ok(p.quantile(Array(102).fill(0).concat(Array(410).fill(1)),.2)>0);
assert.equal(p.quantile(Array(104).fill(0).concat(Array(408).fill(1)),.2),0);
console.log(`PASS: five Python kernel fixtures (max error ${maxError}), effective-product invariance and diffuse/finite-quantile boundaries.`);
