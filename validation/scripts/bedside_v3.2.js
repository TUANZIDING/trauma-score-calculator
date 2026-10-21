const C=require('../../src/core.js');
const fs=require('fs');const ok=v=>v!==null&&v!==undefined&&!Number.isNaN(v);const o=[];
for(const l of fs.readFileSync('in.jsonl','utf8').trim().split('\n')){const r=JSON.parse(l);
 if(r.ds==='uva'){o.push({ds:'uva',died:r.died,mgap_rec:r.mgap});continue;}
 if(r.ds==='titco'&&r.burn)continue;
 const m=r.mech==='blunt'?'blunt':r.mech==='penetrating'?'penetrating':null;const x={ds:r.ds,died:r.died,mech:m};
 if(ok(r.gcs)&&ok(r.sbp)){if(ok(r.age)){const g=C.calcGAP(r.gcs,r.age,r.sbp);if(g)x.gap=g.score,x.gapr=g.risk;
   if(m){const mg=C.calcMGAP(r.gcs,r.age,r.sbp,m);if(mg)x.mgap=mg.score,x.mgapr=mg.risk;}}
   if(ok(r.hr)&&r.hr>0){const s=C.calcRSIG(r.gcs,r.sbp,r.hr);if(s)x.rsig=s.score;}
   if(ok(r.rr)){x.rts=C.calcRTS(r.gcs,r.sbp,r.rr).rts;}}
 if(ok(r.hr)&&r.hr>0&&ok(r.sbp)&&r.sbp>0)x.si=r.hr/r.sbp;
 o.push(x);}
fs.writeFileSync('v32.jsonl',o.map(JSON.stringify).join('\n'));
