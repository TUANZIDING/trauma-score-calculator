const C=require('../../src/core.js');
const fs=require('fs');const L=fs.readFileSync('in.jsonl','utf8').trim().split('\n');const o=[];
const ok=v=>v!==null&&v!==undefined&&!Number.isNaN(v);
for(const l of L){const r=JSON.parse(l);
 if(r.inj){const a=C.calcISS(r.inj);r.iss_calc=a.iss;r.niss_calc=a.niss;}
 if(ok(r.gcs)&&ok(r.sbp)&&ok(r.rr)){const x=C.calcRTS(r.gcs,r.sbp,r.rr);r.rts=x.rts;r.trts=x.trts;}
 if(ok(r.hr)&&r.hr>0&&ok(r.sbp)){const s=C.calcSI(r.hr,r.sbp,ok(r.age)?r.age:-1);if(s){r.si=s.si;r.agesi=s.ageSI;}}
 if(r.ds==='titco'&&ok(r.rts)&&ok(r.iss_rec)&&ok(r.age)&&(r.mech==='blunt'||r.mech==='penetrating')){
   r.ps=C.calcTRISS(r.rts,r.iss_rec,r.age,r.mech,'mtos1995',true).ps;}
 delete r.inj;o.push(JSON.stringify(r));}
fs.writeFileSync('out.jsonl',o.join('\n'));
// self tests
const st=C.runSelfTests();console.log('selftests',st.filter(t=>t.pass).length+'/'+st.length);
// implementation check inputs
let seed=42;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));const rows=['type,age,rts,iss,ps_core,ps_core_peds'];
const possible=[];for(let i=0;i<=75;i++)if(C.issPossible(i))possible.push(i);
for(let i=0;i<1000;i++){const t=rnd()<0.5?'blunt':'penetrating';const age=ri(1,95);
 const x=C.calcRTS(ri(3,15),ri(0,200),ri(0,50));const iss=possible[ri(0,possible.length-1)];
 rows.push([t==='blunt'?'Blunt':'Penetrating',age,x.rts,iss,C.calcTRISS(x.rts,iss,age,t,'mtos1995',false).ps,C.calcTRISS(x.rts,iss,age,t,'mtos1995',true).ps].join(','));}
fs.writeFileSync('impl.csv',rows.join('\n'));
