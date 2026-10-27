import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('patient overview is initial and post-import view',()=>{
  assert.match(code,/view:'overview', checked:/);
  assert.match(code,/refreshPatientList\(\);setView\('overview'\)/);
});
test('comparison draws solid, unique palette colors without dash patterns',()=>{
  assert.match(code,/const COMPARISON_PALETTES/);
  assert.match(code,/tracesFor\(p,palette\[used%palette.length\],true\)/);
  assert.match(code,/dash:'solid'/);
  assert.doesNotMatch(code,/\['solid','dash','dot','dashdot'/);
});
