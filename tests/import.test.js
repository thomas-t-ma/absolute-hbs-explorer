import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const context = {window:{}, TextDecoder, DataView, Uint8Array, Blob, Response, DecompressionStream,
  Date, Map, Set, Math, String, Number, RegExp, Error};
runInNewContext(readFileSync(new URL('../public/workbook.js',import.meta.url),'utf8'),context);
const importer=context.window.HBS_WORKBOOK;

test('imports a fictitious workbook, preserving real Excel row and shifted numeric column', async () => {
  const file=readFileSync(new URL('./synthetic_named.xlsx',import.meta.url));
  const data=await importer.importWorkbook(file,'synthetic_named.xlsx');
  assert.equal(data.count,3);
  assert.deepEqual([...data.patients],['SS900','SS901']);
  assert.equal(data.sheet,'Sheet2');
  assert.equal(data.columns.numeric,5);
  assert.equal(importer.columnName(data.columns.numeric),'F');
  assert.equal(data.records[0].id,'Sheet2:2');
  assert.equal(data.records[0].name,'Alice & Example');
  assert.equal(data.records[0].date,'2025-01-01T12:00:00');
  assert.equal(data.records[1].value,4);
  assert.equal(data.records[1].row,3);
  assert.equal(data.records[2].name,'Bob Sample');
  assert.equal(data.warnings.length,0);
  const days=(Date.parse(data.records[1].date+'Z')-Date.parse(data.records[0].date+'Z'))/86400000;
  assert.equal((data.records[1].value-data.records[0].value)*30/days,2);
});

test('rejects non-workbooks without making a network request',async()=>{
  await assert.rejects(importer.importWorkbook(new Uint8Array([1,2,3]),'notexcel.xlsx'),/valid .xlsx/);
});

test('does not shift dates into the machine time zone',()=>{
  assert.equal(importer.excelDate('2025-01-31 12:30:00',false),'2025-01-31T12:30:00');
});
