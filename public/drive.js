/* Exploratory cohort-relative labeling; deliberately independent of zoom/selection. */
(function(root){
  'use strict';
  const dayMs=86400000;
  const median=values=>{
    if(!values.length)return null;
    const v=[...values].sort((a,b)=>a-b),mid=Math.floor(v.length/2);
    return v.length%2?v[mid]:(v[mid-1]+v[mid])/2;
  };
  function classify(records, minIntervals=3){
    const groups=new Map();
    for(const r of records){
      if(!groups.has(r.patient))groups.set(r.patient,[]);
      groups.get(r.patient).push(r);
    }
    const patients=new Map(),qualifying=[];
    for(const [patient,rows] of groups){
      rows.sort((a,b)=>Date.parse(a.date+'Z')-Date.parse(b.date+'Z')||(a.row||0)-(b.row||0));
      const rises=[];
      for(let i=1;i<rows.length;i++){
        const days=(Date.parse(rows[i].date+'Z')-Date.parse(rows[i-1].date+'Z'))/dayMs;
        const rate=(rows[i].value-rows[i-1].value)*30/days;
        if(days>=7 && days<=90 && Number.isFinite(rate) && rate>0)rises.push(rate);
      }
      const rate=median(rises),eligible=rises.length>=minIntervals;
      patients.set(patient,{group:'insufficient',median:rate,intervals:rises.length,eligible});
      if(eligible)qualifying.push(rate);
    }
    const threshold=median(qualifying);
    let high=0,low=0,insufficient=0;
    for(const v of patients.values()){
      v.group = !v.eligible||threshold===null?'insufficient':v.median>=threshold?'high':'low';
      if(v.group==='high')high++;
      else if(v.group==='low')low++;
      else insufficient++;
    }
    return {threshold,patients,high,low,insufficient,minIntervals};
  }
  root.HBS_DRIVE={classify,median};
})(typeof window==='object'?window:globalThis);
