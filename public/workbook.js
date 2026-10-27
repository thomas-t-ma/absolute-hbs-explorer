/* Offline .xlsx reader optimized for workbooks with many blank, formatted rows.
 * No network, remote APIs, or dependency on Excel/Python.
 */
(() => {
  'use strict';
  const decoder = new TextDecoder();
  const decodeXml = s => String(s ?? '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_m, entity) => {
    if (entity[0] === '#') {
      const n = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }
    return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[entity.toLowerCase()] || '';
  });
  function attr(tag, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const hit = tag.match(new RegExp('(?:\\s|<)' + escaped + '="([^"]*)"'));
    return hit ? decodeXml(hit[1]) : '';
  }
  function colIndex(ref) {
    const m = /^([A-Z]+)\d+$/.exec(ref);
    if (!m) return -1;
    return [...m[1]].reduce((v, c) => v * 26 + c.charCodeAt(0) - 64, 0) - 1;
  }
  function columnName(index) {
    let n=index+1, s='';
    while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}
    return s;
  }
  function zipEntries(bytes) {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
      if(view.getUint32(i,true)===0x06054b50){end=i;break;}
    }
    if(end<0)throw Error('This is not a valid .xlsx file (ZIP directory missing).');
    const total=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);
    if(total>2000)throw Error('Workbook contains an unexpectedly large number of ZIP entries.');
    const entries=new Map();let pos=offset;
    for(let i=0;i<total;i++){
      if(view.getUint32(pos,true)!==0x02014b50)throw Error('Invalid ZIP directory entry.');
      const method=view.getUint16(pos+10,true),compressed=view.getUint32(pos+20,true),size=view.getUint32(pos+24,true);
      const nlen=view.getUint16(pos+28,true),elen=view.getUint16(pos+30,true),clen=view.getUint16(pos+32,true);
      const start=view.getUint32(pos+42,true),name=decoder.decode(bytes.subarray(pos+46,pos+46+nlen));
      if(size>150*1024*1024)throw Error('Workbook sheet exceeds the 150 MB per-sheet safety limit.');
      if(entries.has(name))throw Error('Workbook contains duplicate ZIP entries.');
      entries.set(name,{method,compressed,size,start});
      pos+=46+nlen+elen+clen;
    }
    async function read(name) {
      const entry=entries.get(name);if(!entry)return null;
      const p=entry.start;
      if(view.getUint32(p,true)!==0x04034b50)throw Error('Invalid ZIP local entry.');
      const hlen=view.getUint16(p+26,true)+view.getUint16(p+28,true);
      const start=p+30+hlen;
      if(start+entry.compressed>bytes.length)throw Error('Corrupt ZIP entry.');
      const compressed=bytes.subarray(start,start+entry.compressed);
      let result;
      if(entry.method===0)result=compressed;
      else if(entry.method===8){
        let stream;
        try {stream=new DecompressionStream('deflate-raw');}
        catch {throw Error('This Mac needs Safari/WebKit 16.4 or later to open Excel files.');}
        const pipe=new Blob([compressed]).stream().pipeThrough(stream);
        result=new Uint8Array(await new Response(pipe).arrayBuffer());
      } else throw Error(`Unsupported ZIP compression method: ${entry.method}`);
      if(result.byteLength!==entry.size)throw Error('Workbook ZIP entry has an incorrect size.');
      return decoder.decode(result);
    }
    return {read,has:name=>entries.has(name)};
  }
  function parseShared(xml) {
    if(!xml)return [];
    const strings=[];
    const re=/<si\b[^>]*>([\s\S]*?)<\/si>/g;let m;
    while((m=re.exec(xml))) strings.push([...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>decodeXml(t[1])).join(''));
    return strings;
  }
  function cellsFromRow(xml,strings) {
    const cells=new Map();let m;
    const re=/<c(?=[\s>])([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    while((m=re.exec(xml))){
      const properties=m[1],index=colIndex(attr(properties,'r'));
      if(index<0||index>250)continue;
      const body=m[2]||'',typ=attr(properties,'t');
      let val='';
      if(typ==='inlineStr')val=[...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>decodeXml(x[1])).join('');
      else {
        const v=/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);
        if(v)val=typ==='s'?(strings[Number(v[1])]??''):decodeXml(v[1]);
      }
      if(val!==''&&val!==null)cells.set(index,String(val));
    }
    return cells;
  }
  function sheetsFromMetadata(workbookXml,relsXml) {
    const relationships=new Map();let m;
    const rel=/<Relationship\b[^>]*\/>/g;
    while((m=rel.exec(relsXml))){
      const id=attr(m[0],'Id'),target=attr(m[0],'Target');
      if(!target||!id)continue;
      let normalized=target.startsWith('/')?target.slice(1):(target.startsWith('xl/')?target:'xl/'+target);
      if(normalized.startsWith('xl/worksheets/'))relationships.set(id,normalized);
    }
    const sheets=[];const re=/<sheet\b[^>]*\/>/g;
    while((m=re.exec(workbookXml))){
      const name=attr(m[0],'name'),rid=attr(m[0],'r:id');
      if(relationships.has(rid))sheets.push({name,path:relationships.get(rid)});
    }
    return sheets;
  }
  function excelDate(value,use1904){
    if(value===undefined||value==='')throw Error('Missing lab date');
    const s=String(value).trim();
    if(!/^[-+]?\d+(?:\.\d+)?$/.test(s)){
      // Excel text-formatted date; do not introduce browser-local timezone shifts.
      const m=/^(\d{4})-(\d\d?)-(\d\d?)[ T](\d\d?):(\d\d)(?::(\d\d))?/.exec(s);
      if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:${m[6]||'00'}`;
      const us=/^(\d\d?)\/(\d\d?)\/(\d{4})(?:\s+(\d\d?):(\d\d)(?::(\d\d))?)?/.exec(s);
      if(us)return `${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}T${(us[4]||'00').padStart(2,'0')}:${us[5]||'00'}:${us[6]||'00'}`;
      throw Error('Unrecognized date '+s.slice(0,30));
    }
    const serial=Number(s);
    if(!Number.isFinite(serial)||serial<0||serial>150000)throw Error('Invalid Excel date serial');
    const base=Date.UTC(use1904?1904:1899,use1904?0:11,use1904?1:30);
    return new Date(base+Math.round(serial*86400)*1000).toISOString().slice(0,19);
  }
  const REQUIRED=['ParticipantID','LabTest_DateTime','NumericValue'];
  function getColumnMap(headers){
    const cols={};headers.forEach((s,i)=>cols[s.trim().toLowerCase()]=i);
    for(const name of REQUIRED){if(cols[name.toLowerCase()]===undefined)return null;}
    return cols;
  }
  function parseSheet(xml,strings,sheetName,use1904,fileName){
    const re=/<row\b([^>]*)>([\s\S]*?)<\/row>/g;
    let m,headers=null,cols=null,records=[],warnings=[],invalid=0;
    while((m=re.exec(xml))){
      // Most workbook rows have formatting only. Skip them cheaply.
      if(!m[2].includes('<v>')&&!m[2].includes('<v ')&&!m[2].includes('<is>'))continue;
      const row=Number(attr(m[1],'r'));
      if(!Number.isSafeInteger(row)||row<1)continue;
      const cells=cellsFromRow(m[2],strings);
      if(!cells.size)continue;
      if(!headers){
        const max=Math.max(...cells.keys());
        const proposed=Array.from({length:max+1},(_,i)=>cells.get(i)||'');
        const found=getColumnMap(proposed);
        if(!found)continue;
        headers=proposed;cols=found;continue;
      }
      const get=key=>cells.get(cols[key.toLowerCase()])||'';
      const patient=get('ParticipantID').trim(),numeric=get('NumericValue');
      if(!patient||numeric==='')continue;
      try {
        const value=Number(numeric),date=excelDate(get('LabTest_DateTime'),use1904);
        if(!Number.isFinite(value)||value<0||value>100)throw Error('invalid absolute HbS');
        const unit=get('Unit').trim();
        if(unit&&!/^(g|gm)\s*\/\s*dL$/i.test(unit))throw Error(`unexpected unit: ${unit}`);
        const raw=get('RawValue');
        const source=headers.map((_,i)=>i===cols['labtest_datetime']?date.replace('T',' '):(cells.get(i)||''));
        records.push({id:`${sheetName}:${row}`,patient,date,value,row,source,name:get('FullName').trim()});
        const calc=/([\d.]+)\s*g(?:m)?\s*\/\s*dL\s*[x×*]\s*([\d.]+)\s*%\s*\/\s*100/i.exec(raw);
        if(calc && Math.abs(Number(calc[1])*Number(calc[2])/100-value)>.035)warnings.push(`Row ${row}: calculated HbS differs from reported value.`);
      } catch(e) {
        invalid++;if(warnings.length<30)warnings.push(`Row ${row}: ${e.message}`);
      }
    }
    if(!headers||!records.length)return null;
    if(invalid>warnings.length)warnings.push(`${invalid} invalid measurements skipped in total.`);
    const names=new Map();
    for(const r of records)if(r.name){
      const prior=names.get(r.patient);
      if(prior&&prior!==r.name)throw Error(`Conflicting FullName for ${r.patient}. Please check the source workbook.`);
      names.set(r.patient,r.name);
    }
    const dates=records.map(r=>r.date).sort();
    return {sheet:sheetName,headers,file:fileName,count:records.length,
      patients:[...new Set(records.map(r=>r.patient))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),
      minDate:dates[0],maxDate:dates.at(-1),maxValue:Math.max(...records.map(r=>r.value)),
      columns:{numeric:cols.numericvalue,date:cols.labtest_datetime,fullName:cols.fullname??-1},
      records,warnings};
  }
  async function importWorkbook(bytes,fileName='Workbook.xlsx') {
    const input=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    if(input.byteLength>60*1024*1024)throw Error('Workbook exceeds the 60 MB input-file limit.');
    const zip=zipEntries(input);
    const workbook=await zip.read('xl/workbook.xml'),rels=await zip.read('xl/_rels/workbook.xml.rels');
    if(!workbook||!rels)throw Error('Not a supported Excel .xlsx workbook.');
    const use1904=/<workbookPr\b[^>]*date1904="(?:1|true)"/.test(workbook);
    const strings=parseShared(await zip.read('xl/sharedStrings.xml'));
    const sheets=sheetsFromMetadata(workbook,rels);
    for(const sheet of sheets){
      const xml=await zip.read(sheet.path);
      if(!xml)continue;
      const data=parseSheet(xml,strings,sheet.name,use1904,fileName);
      if(data)return data;
    }
    throw Error('No worksheet containing ParticipantID, LabTest_DateTime, and NumericValue with measurements was found.');
  }
  window.HBS_WORKBOOK={importWorkbook,columnName,excelDate};
})();
