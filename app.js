/* Offline Absolute HbS Explorer. Does not make network requests or persist names. */
(() => {
  'use strict';
  let data = window.ABS_HBS_DATA;
  const demoData = data;
  let workbookPath = null;
  if (!data || !window.Plotly) {
    document.getElementById('chartRegion').textContent = 'Unable to load the chart files. Please open index.html inside the complete Explorer folder.';
    return;
  }

  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parseDate = d => Date.parse(d.endsWith('Z') ? d : d + 'Z');
  const dayDiff = (left, right) => (parseDate(right) - parseDate(left)) / 86400000;
  const shortDate = d => d ? d.slice(0,10) : '';
  const fullDate = d => d ? d.replace('T',' ').slice(0,16) : '—';
  const number = n => Number(n).toFixed(2);
  const GROUP_COLORS = {high:'#b44941',low:'#237c95',insufficient:'#89929c'};
  // Distinct solid colors per patient: warmer tones for the higher-rate group,
  // cooler tones for the lower-rate group. No dash patterns or segment overlays.
  const COMPARISON_PALETTES = {
    high: ['#a73532','#d25647','#8a273b','#dc7551','#bb455f','#7d222e'],
    low: ['#1c6c91','#3998b5','#2453a1','#217c8b','#526dc0','#3c90a3'],
    insufficient: ['#606975','#87909a','#4b5563','#a3a9b1','#727885','#949aa5']
  };
  const model = {
    view:'overview', checked:new Set(data.patients), page:0, pageSize:9,
    from: data.maxDate.slice(0,4) >= '2024' ? '2024-01-01' : data.minDate.slice(0,10),
    to:data.maxDate.slice(0,10), high:true, threshold:2.4,
    selected:null, names:new Map(), showNames:true,
  };
  let sortedPatients = [...data.patients].sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
  let recordsById = new Map(data.records.map(r => [r.id,r]));
  let recordsByRow = new Map(data.records.map(r => [r.row,r]));
  let patients = new Map(sortedPatients.map(p => [p, data.records.filter(r => r.patient === p).sort((a,b) => parseDate(a.date) - parseDate(b.date) || a.row-b.row)]));
  let classification = {threshold:null, patients:new Map(), high:0, low:0, insufficient:0};
  function rebuildClassification() {
    classification = window.HBS_DRIVE.classify(data.records);
  }
  function classOf(p) { return classification.patients.get(p)?.group || 'insufficient'; }
  function groupName(p) {
    return {high:'High drive',low:'Low drive',insufficient:'Insufficient data'}[classOf(p)];
  }
  function classBadge(p) {
    const group=classOf(p);
    return `<span class="drive-badge ${group}" title="Exploratory, cohort-relative classification; not a confirmed post-RCE proliferative-drive measurement">${groupName(p)}</span>`;
  }
  let allRates = [...patients.values()].flatMap(rows => intervals(rows).filter(v => v.eligible && v.rise > 0).map(v => v.rise)).sort((a,b) => a-b);
  const percentile = (xs,q) => !xs.length ? 0 : xs[Math.floor((xs.length-1)*q)];
  let veryHigh = percentile(allRates, .90);
  rebuildClassification();
  let graphGeneration = 0;

  function intervals(rows) {
    const out = [];
    for (let i=1;i<rows.length;i++) {
      const earlier = rows[i-1], later=rows[i], days=dayDiff(earlier.date,later.date);
      out.push({earlier,later,days,eligible: days>=7 && days<=90,
        rise: days>0 ? (later.value-earlier.value)*30/days : null});
    }
    return out;
  }
  function inRange(row) { return shortDate(row.date)>=model.from && shortDate(row.date)<=model.to; }
  function filteredRows(p) { return (patients.get(p)||[]).filter(inRange); }
  function med(values) {
    if (!values.length) return null;
    const s=[...values].sort((a,b)=>a-b), mid=Math.floor(s.length/2);
    return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
  }
  function patientStats(p, fullHistory=false) {
    const rows=fullHistory?(patients.get(p)||[]):filteredRows(p), rising=intervals(rows).filter(x=>x.eligible && x.rise>0);
    return {count:rows.length, rises:rising.length, median:med(rising.map(x=>x.rise)), max: rising.length ? Math.max(...rising.map(x=>x.rise)) : null};
  }
  function label(p) {
    const name = model.showNames && model.names.has(p) ? model.names.get(p).name : '';
    return name ? `${name} (${p})` : p;
  }

  function refreshPatientList() {
    const search = $('patientSearch').value.trim().toLowerCase();
    $('checkedCount').textContent = `${model.checked.size}/${sortedPatients.length} selected`;
    const wrapper = $('patientList'); wrapper.replaceChildren();
    for (const p of sortedPatients) {
      const name = model.showNames ? model.names.get(p)?.name : null;
      if (search && !(`${p} ${name || ''}`.toLowerCase().includes(search))) continue;
      const option = document.createElement('label'); option.className='patient-option';
      const check=document.createElement('input'); check.type='checkbox';check.checked=model.checked.has(p);
      check.addEventListener('change',()=>{if(check.checked)model.checked.add(p);else model.checked.delete(p);model.page=0;refreshPatientList();render();});
      const text=document.createElement('span');
      text.innerHTML=`<span class="pid">${safe(name||p)}</span>${name?`<span class="pname">${safe(p)}</span>`:''}${classBadge(p)}`;
      option.append(check,text);wrapper.append(option);
    }
    if (!wrapper.childElementCount) {
      const p=document.createElement('p');p.className='small-muted';p.textContent='No matching patients';wrapper.append(p);
    }
  }
  function setView(view) {
    model.view=view;
    for (const v of ['Overview','Compare','Ranking']) $('tab'+v).classList.toggle('active',v.toLowerCase()===view);
    const detail = {
      overview:['PATIENTS','Patient HbS trends','Shared axes for every patient. Amber sections mark rapid observed increases. Click a dot for its source.'],
      compare:['COMPARE','Compare patients','Each patient has a solid curve. Warm shades represent higher relative rates; cool shades represent lower rates.'],
      ranking:['PATIENT PRIORITIES','Who should we look at first?','Exploratory high/low groups are based on median positive HbS increases across each patient’s full available record.'],
    }[view];
    $('viewEyebrow').textContent=detail[0];$('viewTitle').textContent=detail[1];$('viewDescription').textContent=detail[2];
    $('dateControls').hidden=view==='ranking';
    $('riseSettings').hidden=view!=='overview';
    $('overviewLegend').hidden=view!=='overview';
    $('comparisonLegend').hidden=view!=='compare';
    $('rankingHint').hidden=view!=='ranking';
    render();
  }
  function setNotice(s) {$('modeNotice').hidden = !s;$('modeNotice').textContent=s;}
  function plotConfig() {return {responsive:true,displaylogo:false,scrollZoom:false,toImageButtonOptions:{format:'png',filename:'Absolute_HbS_chart',scale:2},modeBarButtonsToRemove:['select2d','lasso2d','autoScale2d','toggleSpikelines']};}
  function axisLayout() {
    const maximum=Math.max(10,Math.ceil(data.maxValue+0.4));
    return {
      xaxis:{type:'date',range:[model.from+'T00:00:00',model.to+'T23:59:59'],title:{text:'Lab date',font:{size:10}},tickfont:{size:10},gridcolor:'#e9eef3',linecolor:'#b4c3d0',automargin:true,zeroline:false},
      yaxis:{range:[0,maximum],title:{text:'Absolute HbS (g/dL)',font:{size:10}},tickfont:{size:10},gridcolor:'#e9eef3',linecolor:'#b4c3d0',automargin:true,zeroline:false},
      paper_bgcolor:'#fff',plot_bgcolor:'#fff',font:{family:'Inter,Segoe UI,Arial,sans-serif',size:11,color:'#456073'},
      hovermode:'closest',clickmode:'event',margin:{l:54,r:15,t:10,b:50},showlegend:false,
    };
  }
  function tracesFor(p, color='#202936', showLegend=false) {
    const rows=filteredRows(p);
    if (!rows.length) return [];
    const x=[],y=[];
    const segments=intervals(rows);
    for (const s of segments) {
      if (s.days>0 && s.days<=90) { x.push(s.earlier.date,s.later.date,null); y.push(s.earlier.value,s.later.value,null); }
    }
    const title = showLegend ? `${label(p)} · ${groupName(p)}` : label(p);
    const line={type:'scatter',mode:'lines',name:title,x,y,hoverinfo:'skip',
      line:{width:showLegend?2.8:2.1,color,dash:'solid'},showlegend:showLegend};
    const marks={type:'scatter',mode:'markers',name:title,
      x:rows.map(r=>r.date),y:rows.map(r=>r.value),
      customdata:rows.map(r=>({id:r.id})),
      text:rows.map(r=>`${safe(label(p))}<br>${safe(fullDate(r.date))}<br>${number(r.value)} g/dL<br>Click for details`),
      hovertemplate:'%{text}<extra></extra>',marker:{color,size:showLegend?6:7,line:{color:'#fff',width:1}},showlegend:false};
    const result=[line];
    // Only individual plots have segment highlights. In comparisons each patient
    // retains a single group color, so overlays never compete with the legend.
    if (!showLegend && model.high) {
      const xs=[],ys=[];
      for (const s of segments) {
        if (!s.eligible || s.rise < model.threshold) continue;
        xs.push(s.earlier.date,s.later.date,null); ys.push(s.earlier.value,s.later.value,null);
      }
      if(xs.length)result.push({type:'scatter',mode:'lines',x:xs,y:ys,showlegend:false,hoverinfo:'skip',
        line:{color:'#d28a28',width:4.2}});
    }
    result.push(marks);
    return result;
  }
  function wirePointClick(div) {
    div.on('plotly_click', e=>{
      const item=e.points && e.points[0];
      if (item && item.customdata && item.customdata.id) selectRecord(item.customdata.id);
    });
  }
  function createEmpty(message) {
    const el=document.createElement('div');el.className='empty';el.textContent=message;return el;
  }
  async function renderOverview(root, generation) {
    const selected=sortedPatients.filter(p=>model.checked.has(p));
    $('pager').hidden=selected.length<=model.pageSize;
    const totalPages=Math.max(1,Math.ceil(selected.length/model.pageSize));
    model.page=Math.min(model.page,totalPages-1);
    $('pageLabel').textContent=`Page ${model.page+1} of ${totalPages} · ${selected.length} selected`;
    $('prevPage').disabled=model.page===0;$('nextPage').disabled=model.page>=totalPages-1;
    if(!selected.length){root.append(createEmpty('Choose patients from the left to view their graphs.'));return;}
    const wrapper=document.createElement('div');wrapper.className='chart-grid';root.append(wrapper);
    for(const p of selected.slice(model.page*model.pageSize,(model.page+1)*model.pageSize)) {
      const st=patientStats(p), card=document.createElement('div');card.className='chart-card';
      const heading=document.createElement('div');heading.className='chart-card-title';
      const first=document.createElement('div');const labelText=document.createElement('h3');labelText.textContent=label(p);
      const sub=document.createElement('div');sub.className='caption';sub.innerHTML=`${classBadge(p)} <span class="sample-count">${st.count} measurements</span>`;
      first.append(labelText,sub);
      heading.append(first);
      const chart=document.createElement('div');chart.className='small-chart';card.append(heading,chart);wrapper.append(card);
      if(st.count===0){chart.append(createEmpty('No measurements in this date range.'));continue;}
      const layout=axisLayout();layout.margin={l:51,r:13,t:7,b:48};layout.xaxis.title.text='Date';layout.yaxis.title.text='g/dL';layout.xaxis.tickfont.size=9;
      if(generation!==graphGeneration)return;
      await Plotly.newPlot(chart,tracesFor(p),layout,plotConfig());wirePointClick(chart);
    }
  }
  async function renderCompare(root,generation) {
    let selected=sortedPatients.filter(p=>model.checked.has(p));
    if (!selected.length){root.append(createEmpty('Choose one or more patients from the left to compare their HbS curves.'));return;}
    if(selected.length>6) {
      setNotice(`Showing the first six of ${selected.length} selected patients. Use the checkboxes to choose who to compare.`);
      selected=selected.slice(0,6);
    }
    const chart=document.createElement('div');chart.className='full-chart';root.append(chart);
    const colorIndex = new Map();
    const traces=selected.flatMap(p=>{
      const group=classOf(p),used=colorIndex.get(group)||0;
      colorIndex.set(group,used+1);
      const palette=COMPARISON_PALETTES[group];
      return tracesFor(p,palette[used%palette.length],true);
    });
    if(!traces.length){chart.replaceWith(createEmpty('No measurements for these patients in the current date range.'));return;}
    const layout=axisLayout();layout.height=520;layout.margin={l:76,r:25,t:36,b:65};layout.showlegend=true;
    layout.legend={orientation:'h',y:1.11,x:0,font:{size:11}};layout.xaxis.title.text='Laboratory measurement date';
    if(generation!==graphGeneration)return;
    await Plotly.newPlot(chart,traces,layout,plotConfig());wirePointClick(chart);
  }
  function exportRates() {
    const rows=rankedStats();
    const escapeCSV=v=>{const s=String(v??'');const guarded=/^[=+\-@]/.test(s)?"'"+s:s;return '"'+guarded.replace(/"/g,'""')+'"';};
    // Export only coded IDs, even when identifiable names are on screen.
    const lines=[['ParticipantID','ExploratoryGroup','MeasurementsInFullRecord','EligiblePositiveIntervals','MedianRise_g_dL_per_30days','MaximumRise_g_dL_per_30days','CohortCutoff_g_dL_per_30days'],
      ...rows.map(x=>[x.patient,groupName(x.patient),x.count,x.rises,x.median===null?'':x.median.toFixed(5),x.max===null?'':x.max.toFixed(5),classification.threshold===null?'':classification.threshold.toFixed(5)])];
    const csv=lines.map(row=>row.map(escapeCSV).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='HbS_relative_rise_summary_full_history.csv';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function rankedStats(){return sortedPatients.filter(p=>model.checked.has(p)).map(p=>({patient:p,...patientStats(p,true)})).sort((a,b)=>(b.median??-1)-(a.median??-1));}
  async function renderRanking(root,generation) {
    const rows=rankedStats(),eligible=rows.filter(x=>x.rises>=3),others=rows.filter(x=>x.rises<3);
    const wrap=document.createElement('div');wrap.className='chart-card';root.append(wrap);
    const heading=document.createElement('div');heading.className='chart-card-title';
    const title=document.createElement('div');title.innerHTML='<h3>Relative rate of HbS increase</h3><div class="caption">Median positive rise · g/dL per 30 days · full available record</div>';
    const button=document.createElement('button');button.type='button';button.textContent='Export summary (IDs only)';button.addEventListener('click',exportRates);
    heading.append(title,button);wrap.append(heading);
    const chart=document.createElement('div');chart.className='ranking-chart';wrap.append(chart);
    if(!eligible.length){chart.replaceWith(createEmpty('No patients have at least three eligible positive intervals in the full dataset.'));return;}
    const highest=Math.max(0.5,...eligible.map(r=>r.median));
    const rankLabels=eligible.map(x=>label(x.patient));
    const maxLabel=Math.max(...rankLabels.map(x=>x.length),0);
    const trace={type:'bar',orientation:'h',x:eligible.map(x=>x.median),y:rankLabels,
      customdata:eligible.map(x=>x.patient),marker:{color:eligible.map(x=>GROUP_COLORS[classOf(x.patient)]),opacity:.92},
      hovertemplate:'%{y}<br>Median: %{x:.2f} g/dL / 30d<br>Click to inspect this patient<extra></extra>',
      text:eligible.map(x=>`${number(x.median)} · ${x.rises} intervals`),textposition:'outside',textfont:{size:10,color:'#566677'}};
    const layout={height:Math.max(630,eligible.length*29+105),margin:{l:Math.min(300,Math.max(135,maxLabel*6.3)),r:105,t:20,b:60},
      font:{family:'Inter,Segoe UI,Arial,sans-serif',size:10,color:'#52667a'},paper_bgcolor:'#fff',plot_bgcolor:'#fff',
      xaxis:{title:'Median positive rise (g/dL per 30 days)',range:[0,highest*1.32],gridcolor:'#eaf0f3',zeroline:false},
      yaxis:{autorange:'reversed',automargin:true,tickfont:{size:11}},bargap:.35};
    if(generation!==graphGeneration)return;
    await Plotly.newPlot(chart,[trace],layout,plotConfig());
    chart.on('plotly_click',e=>{const patient=e.points?.[0]?.customdata;if(patient){model.checked=new Set([patient]);refreshPatientList();setView('overview');}});
    const note=document.createElement('div');note.className='ranking-note';
    note.textContent=`Full available record · ${classification.high} high drive, ${classification.low} low drive, ${classification.insufficient} with insufficient data (entire cohort). Cutoff: ${classification.threshold===null?'n/a':number(classification.threshold)} g/dL per 30 days. Groups are exploratory and do not establish post-RCE proliferative drive.`;root.append(note);
    if(others.length){const insufficient=document.createElement('div');insufficient.className='insufficient';insufficient.innerHTML=`<strong>Insufficient eligible rise intervals:</strong> ${others.map(x=>`${safe(label(x.patient))} (${x.rises})`).join(', ')}. These patients are not ranked, but their measurements remain available in the overview.`;root.append(insufficient);}
  }
  function render() {
    graphGeneration++;
    const generation=graphGeneration;
    setNotice('');const root=$('chartRegion');root.replaceChildren();$('pager').hidden=true;
    if (model.from>model.to){root.append(createEmpty('The start date must be on or before the end date.'));return;}
    if(model.view==='overview')renderOverview(root,generation).catch(showChartError);
    if(model.view==='compare')renderCompare(root,generation).catch(showChartError);
    if(model.view==='ranking')renderRanking(root,generation).catch(showChartError);
  }
  function showChartError(e){console.error(e);$('chartRegion').replaceChildren(createEmpty('The chart could not render. Please reopen the Explorer, and check that all its files are in one folder.'));}

  function selectRecord(id) {
    const r=recordsById.get(id);if(!r)return;
    model.selected=id;
    $('inspector').hidden=false;document.body.classList.remove('inspector-hidden');
    const rows=patients.get(r.patient)||[],at=rows.findIndex(x=>x.id===id),previous=rows[at-1],days=previous?dayDiff(previous.date,r.date):null;
    const rise=previous&&days>0?(r.value-previous.value)*30/days:null;
    const good=days>=7&&days<=90;
    const rawIndex=data.headers.indexOf('RawValue');
    const rawText=rawIndex>=0?r.source[rawIndex]:'';
    const match=String(rawText).match(/([\d.]+)\s*(?:g(?:m)?\/?dL)\s*[x×*]\s*([\d.]+)\s*%/i);
    const pair=match?`Hemoglobin ${match[1]} g/dL × HbS ${match[2]}% ÷ 100`:rawText;
    const map=model.names.get(r.patient);const official=model.showNames?map?.original:'';
    const html=`<div class="patient-head"><div><h3>${safe(label(r.patient))}</h3><div class="pd">${safe(fullDate(r.date))} · ${groupName(r.patient)} (exploratory)</div></div><span class="source-badge">${safe(data.sheet)} · row ${r.row}</span></div>
      <div class="value-block"><div class="kicker">Absolute HbS</div><div class="big-number">${number(r.value)} <small>g/dL</small></div></div>
      <div class="details-table"><span class="label">Patient ID</span><span class="val">${safe(r.patient)}</span>
      ${official?`<span class="label">Source patient ID</span><span class="val">${safe(official)}</span>`:''}
      <span class="label">Lab date</span><span class="val">${safe(shortDate(r.date))}</span>
      <span class="label">Lab time</span><span class="val">${safe(r.date.slice(11,16))}</span>
      <span class="label">Previous timepoint</span><span class="val">${previous?safe(shortDate(previous.date)):'—'}</span>
      <span class="label">Days since previous</span><span class="val">${days!==null?number(days):'—'}</span>
      <span class="label">Change in HbS</span><span class="val">${previous?(r.value-previous.value>=0?'+':'')+number(r.value-previous.value)+' g/dL':'—'}</span>
      <span class="label">Observed rise rate</span><span class="val">${rise!==null&&good&&rise>0?number(rise)+' g/dL / 30 days':'Not an eligible rising interval'}</span></div>
      <div class="calc-box"><div class="kicker">Original calculation</div><div class="calc">${safe(pair||'Unavailable')}</div></div>`;
    $('selectedDetails').className='point-details';$('selectedDetails').innerHTML=html;
    $('cellReference').textContent=`${data.sheet}!${numericColumn()}${r.row}`;
    $('copyReference').disabled=false;
    $('sourceStatus').textContent=`Source: ${data.file}. Use Excel's Go To with the cell reference.`;
    $('openWorkbook').disabled = !workbookPath;
    renderSource(r);
  }
  function renderSource(r) {
    const table=$('sourceSheet');table.replaceChildren();
    const thead=document.createElement('thead'),tr=document.createElement('tr');
    for(const head of ['#',...data.headers]) {const th=document.createElement('th');th.textContent=head==='LabTest_DateTime'?'Date / time':head==='OriginalRefRangeAndUnit'?'Original reference':head;tr.append(th);}
    thead.append(tr);table.append(thead);
    const tbody=document.createElement('tbody');
    const around=data.records.filter(x=>x.row>=r.row-2 && x.row<=r.row+2).sort((a,b)=>a.row-b.row);
    for(const item of around){
      const tr=document.createElement('tr');if(item.id===r.id)tr.className='selected';
      const first=document.createElement('td');first.textContent=item.row;tr.append(first);
      item.source.forEach((value,index)=>{const cell=document.createElement('td');const visible=data.headers[index]!=='FullName'||model.showNames;cell.textContent=visible?value:'••••';cell.title=visible?value:'Patient name hidden';tr.append(cell);});
      tr.addEventListener('click',()=>selectRecord(item.id));tbody.append(tr);
    }
    table.append(tbody);
  }
  async function copyReference() {
    if(!model.selected)return;
    const r=recordsById.get(model.selected),address=`'${data.sheet.replace(/'/g,"''")}'!${numericColumn()}${r.row}`;
    try {await navigator.clipboard.writeText(address);$('sourceStatus').textContent=`Copied ${address}. In Excel, use Go To (Ctrl+G) and paste it.`;}
    catch(e){
      const ta=document.createElement('textarea');ta.value=address;ta.style.position='absolute';ta.style.left='-9999px';document.body.append(ta);ta.select();
      const copied=document.execCommand('copy');ta.remove();$('sourceStatus').textContent=copied?`Copied ${address}. In Excel, use Go To (Ctrl+G) and paste it.`:`Excel address: ${address}`;
    }
  }

  function numericColumn() {return window.HBS_WORKBOOK.columnName(data.columns?.numeric ?? data.headers.indexOf('NumericValue'));}
  function resetDataset(next, path = null) {
    data=next;workbookPath=path;
    sortedPatients=[...data.patients].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    recordsById=new Map(data.records.map(r=>[r.id,r]));
    recordsByRow=new Map(data.records.map(r=>[r.row,r]));
    patients=new Map(sortedPatients.map(p=>[p,data.records.filter(r=>r.patient===p).sort((a,b)=>parseDate(a.date)-parseDate(b.date)||a.row-b.row)]));
    allRates=[...patients.values()].flatMap(rows=>intervals(rows).filter(x=>x.eligible&&x.rise>0).map(x=>x.rise)).sort((a,b)=>a-b);
    veryHigh=percentile(allRates,.90);
    rebuildClassification();
    model.checked=new Set(data.patients);model.page=0;model.selected=null;
    model.names=new Map();
    for(const record of data.records)if(record.name)model.names.set(record.patient,{name:record.name});
    model.showNames=model.names.size>0;
    $('showNames').checked=model.showNames;
    $('showNames').disabled=model.names.size===0;
    $('mappingStatus').textContent=model.names.size?`${model.names.size} patient names loaded and displayed.`:'This workbook contains no patient names.';
    $('recordCount').textContent=`${data.count} results · ${sortedPatients.length} patients`;
    // workbook name is shown in the compact source banner
    $('workbookName').textContent=path?data.file:'Fictional demonstration data';
    $('demoWarning').hidden=!!path;
    $('fromDate').min=data.minDate.slice(0,10);$('fromDate').max=data.maxDate.slice(0,10);
    $('toDate').min=data.minDate.slice(0,10);$('toDate').max=data.maxDate.slice(0,10);
    const end=new Date(parseDate(data.maxDate));end.setUTCFullYear(end.getUTCFullYear()-3);
    model.from=end.toISOString().slice(0,10)<data.minDate.slice(0,10)?data.minDate.slice(0,10):end.toISOString().slice(0,10);model.to=data.maxDate.slice(0,10);
    $('fromDate').value=model.from;$('toDate').value=model.to;
    $('selectedDetails').className='selection-empty';
    $('selectedDetails').innerHTML='<strong>Click any measurement</strong><p>Its value, rate of change, calculation and Excel row appear here.</p>';
    $('cellReference').textContent=data.sheet;
    $('sourceSheet').innerHTML='<tbody><tr><td class="placeholder-cell">Select a graph point to view its source.</td></tr></tbody>';
    $('copyReference').disabled=true;$('openWorkbook').disabled=!workbookPath;
    $('sourceStatus').textContent='';
    const warns=data.warnings||[];
    $('workbookStatus').textContent=warns.length?`Loaded ${data.count} measurements. Check data quality: ${warns.slice(0,2).join(' ')}`:path?`${data.count} measurements · ${data.patients.length} patients. Loaded locally.`:'No patient workbook is open. This is fictional demo data.';
    $('patientSearch').value='';refreshPatientList();setView('overview');
    $('inspector').hidden=true;document.body.classList.add('inspector-hidden');
  }
  async function useWorkbook(bytes,fileName,path=null){
    $('chooseWorkbook').disabled=true;
    $('workbookStatus').textContent='Reading Excel measurements…';
    try{
      const next=await window.HBS_WORKBOOK.importWorkbook(bytes,fileName);
      resetDataset(next,path);
    }catch(e){
      console.error('Excel import failed',e);
      $('workbookStatus').textContent=`Could not open workbook: ${e.message}`;
    }finally{$('chooseWorkbook').disabled=false;}
  }
  async function autoLoadWorkbook(){
    if(!window.__TAURI__?.core?.invoke)return;
    $('workbookStatus').textContent='Looking for HbS_Absolute_Values.xlsx…';
    try {
      const result=await window.__TAURI__.core.invoke('load_default_workbook');
      if(result){
        const bytes=Uint8Array.from(atob(result.contents),c=>c.charCodeAt(0));
        await useWorkbook(bytes,result.name,result.path);
      }else{
        $('workbookStatus').textContent='No workbook found automatically. Put HbS_Absolute_Values.xlsx in the Data folder beside the application, then reopen it. Or choose a workbook here.';
      }
    }catch(e){
      $('workbookStatus').textContent=`Automatic loading failed: ${String(e)}. Choose a workbook to continue.`;
    }
  }
  async function chooseWorkbook(){
    if(window.__TAURI__?.core?.invoke){
      try{
        const result=await window.__TAURI__.core.invoke('pick_and_read_workbook');
        if(!result)return;
        const binary=atob(result.contents);
        const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
        await useWorkbook(bytes,result.name,result.path);
      }catch(e){$('workbookStatus').textContent=`Could not read Excel file: ${e}`;}
    }else $('workbookFile').click();
  }
  async function openWorkbook(){
    if(!workbookPath)return;
    try{await window.__TAURI__.core.invoke('open_workbook',{path:workbookPath});
      $('sourceStatus').textContent='Workbook opened. Use the copied cell reference with Go To (Ctrl+G).';}
    catch(e){$('sourceStatus').textContent=`Could not open workbook: ${e}`;}
  }
  function init() {
    $('recordCount').textContent=`${data.count} results · ${sortedPatients.length} patients`;
    // workbook name is shown in the compact source banner
    $('fromDate').min=data.minDate.slice(0,10);$('fromDate').max=data.maxDate.slice(0,10);
    $('toDate').min=data.minDate.slice(0,10);$('toDate').max=data.maxDate.slice(0,10);
    $('fromDate').value=model.from;$('toDate').value=model.to;
    for(const view of ['Overview','Compare','Ranking'])$('tab'+view).addEventListener('click',()=>setView(view.toLowerCase()));
    $('patientSearch').addEventListener('input',refreshPatientList);
    $('selectAll').addEventListener('click',()=>{model.checked=new Set(sortedPatients);model.page=0;refreshPatientList();render();});
    $('selectNone').addEventListener('click',()=>{model.checked.clear();model.page=0;refreshPatientList();render();});
    $('selectExamples').addEventListener('click',()=>{
      const qualified=sortedPatients
        .map(p=>({id:p,rate:classification.patients.get(p)?.median,group:classOf(p)}))
        .filter(x=>x.group!=='insufficient' && Number.isFinite(x.rate));
      const high=qualified.filter(x=>x.group==='high').sort((a,b)=>b.rate-a.rate).slice(0,3);
      const low=qualified.filter(x=>x.group==='low').sort((a,b)=>a.rate-b.rate).slice(0,3);
      model.checked=new Set([...high,...low].map(x=>x.id));
      model.page=0;refreshPatientList();setView('compare');
    });
    $('fromDate').addEventListener('change',e=>{model.from=e.target.value||model.from;model.page=0;render();});
    $('toDate').addEventListener('change',e=>{model.to=e.target.value||model.to;model.page=0;render();});
    $('recentDates').addEventListener('click',()=>{const t=new Date(parseDate(data.maxDate));t.setUTCFullYear(t.getUTCFullYear()-3);model.from=t.toISOString().slice(0,10);model.to=data.maxDate.slice(0,10);$('fromDate').value=model.from;$('toDate').value=model.to;model.page=0;render();});
    $('allDates').addEventListener('click',()=>{model.from=data.minDate.slice(0,10);model.to=data.maxDate.slice(0,10);$('fromDate').value=model.from;$('toDate').value=model.to;model.page=0;render();});
    $('highlight').addEventListener('change',e=>{model.high=e.target.checked;render();});
    $('threshold').addEventListener('input',e=>{$('thresholdLabel').textContent=`${number(e.target.value)} g/dL / 30 days`;});
    $('threshold').addEventListener('change',e=>{model.threshold=Number(e.target.value);render();});
    $('prevPage').addEventListener('click',()=>{model.page=Math.max(0,model.page-1);render();});
    $('nextPage').addEventListener('click',()=>{model.page++;render();});
    $('copyReference').addEventListener('click',copyReference);
    $('chooseWorkbook').addEventListener('click',chooseWorkbook);
    $('workbookFile').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)file.arrayBuffer().then(b=>useWorkbook(new Uint8Array(b),file.name));e.target.value='';});
    $('useDemo').addEventListener('click',()=>resetDataset(demoData));
    $('closeInspector').addEventListener('click',()=>{$('inspector').hidden=true;document.body.classList.add('inspector-hidden');});
    $('openWorkbook').addEventListener('click',openWorkbook);
    $('showNames').addEventListener('change',e=>{model.showNames=e.target.checked;refreshPatientList();render();if(model.selected)selectRecord(model.selected);});
    resetDataset(demoData);
    autoLoadWorkbook();
  }
  init();
})();
