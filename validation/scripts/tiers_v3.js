const C=require('../../src/core.js');
const fs=require('fs');const ok=v=>v!==null&&v!==undefined&&!Number.isNaN(v);
const L=fs.readFileSync('out.jsonl','utf8').trim().split('\n').map(JSON.parse);
const res={};
for(const ds of ['titco','crash2','uva']){
 const agg={};let tp=0,fp=0,fn=0,tn=0,n=0;
 for(const r of L){ if(r.ds!==ds||!ok(r.died))continue; if(ds==='titco'&&r.burn===1)continue;
  const iss=ds==='crash2'?null:(ok(r.iss_rec)?r.iss_rec:(ok(r.iss)?r.iss:null));
  const p={gcs:ok(r.gcs)?r.gcs:null,sbp:ok(r.sbp)?r.sbp:null,rr:ok(r.rr)?r.rr:null,hr:ok(r.hr)?r.hr:null,si:ok(r.si)?r.si:null,ageSI:ok(r.agesi)?r.agesi:null,
   age:ds==='uva'?null:(ok(r.age)?r.age:null),iss:iss,niss:ok(r.niss_rec)?r.niss_rec:(ok(r.niss)?r.niss:null),ps:ok(r.ps)?r.ps:null,mech:r.mech};
  const t=C.calcTier(p).level; const lv=t==='grey'?'green':t; n++;
  agg[lv]=agg[lv]||{n:0,d:0};agg[lv].n++;agg[lv].d+=r.died;
  const red=lv==='red'; if(red&&r.died)tp++;else if(red)fp++;else if(r.died)fn++;else tn++;}
 res[ds]={n,tiers:Object.fromEntries(['red','orange','yellow','green'].map(k=>[k,agg[k]?{n:agg[k].n,deaths:agg[k].d,mort:+(100*agg[k].d/agg[k].n).toFixed(1)}:{n:0}])),
  red_sens:+(tp/(tp+fn)).toFixed(3),red_spec:+(tn/(tn+fp)).toFixed(3),red_ppv:+(tp/(tp+fp)).toFixed(3),red_npv:+(tn/(tn+fn)).toFixed(3)};}
console.log(JSON.stringify(res,null,1));fs.writeFileSync('tiers_v3.json',JSON.stringify(res));
