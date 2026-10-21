const C=require('../../src/core.js');const fs=require('fs');const o=[];let nc=0,nbad=0;
for(const l of fs.readFileSync('icd_in.jsonl','utf8').trim().split('\n')){const r=JSON.parse(l);if(r.burn)continue;
 const t=C.calcICDISS(r.codes,'TQIP'),n=C.calcICDISS(r.codes,'NIS');nc+=r.codes.filter(c=>/^[stST]\d/.test(c)).length;nbad+=t.bad.filter(c=>/^[stST]\d/.test(c)).length;
 o.push(JSON.stringify({died:r.died,iss:r.iss,niss:r.niss,ncode:t.n,iss_t:t.iss,niss_t:t.niss,pm_t:t.pmort,iss_n:n.iss,niss_n:n.niss,pm_n:n.pmort}));}
fs.writeFileSync('icd_out.jsonl',o.join('\n'));console.log('S/T codes',nc,'unmapped',nbad);
