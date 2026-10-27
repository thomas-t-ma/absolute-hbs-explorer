import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const context={window:{},Date,Map};
runInNewContext(readFileSync(new URL('../public/drive.js',import.meta.url),'utf8'),context);
const classify=context.window.HBS_DRIVE.classify;
const build=(patient,values)=>values.map((value,i)=>({patient,value,date:new Date(Date.UTC(2025,0,1+i*30)).toISOString().slice(0,19),row:i+2}));
test('classifies patients by median positive slope, with insufficient data group',()=>{
  const rows=[...build('slow',[1,1.5,2,2.5,3]),...build('fast',[1,3,5,7,9]),...build('short',[1,4])];
  const r=classify(rows);
  assert.equal(r.patients.get('fast').group,'high');
  assert.equal(r.patients.get('slow').group,'low');
  assert.equal(r.patients.get('short').group,'insufficient');
  assert.equal(r.high,1);assert.equal(r.low,1);assert.equal(r.insufficient,1);
  assert.equal(r.threshold,1.25);
});
test('same-day measurements and negative changes do not count as positive eligible intervals',()=>{
  const a=[...build('one',[2,1,2,1,2])];
  a.push({patient:'one',value:100,date:a.at(-1).date,row:7});
  const r=classify(a);
  assert.equal(r.patients.get('one').intervals,2);
  assert.equal(r.patients.get('one').group,'insufficient');
});
test('classifications are unaffected by display date range because full series is input',()=>{
  const a=[...build('fast',[1,3,5,7,9]),...build('slow',[1,1.5,2,2.5,3])];
  assert.equal(classify(a).patients.get('fast').group,'high');
});
