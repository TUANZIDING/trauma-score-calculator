// ===== Core calculation (pure functions) =====
var REGIONS = ["头颈部","面部","胸部","腹部及盆腔脏器","四肢及骨盆带","体表"];
var REGION_SHORT = ["头颈","面","胸","腹","四肢","体表"];
var AIS_LABEL = {1:"轻度",2:"中度",3:"较重",4:"严重",5:"危重",6:"极重（目前视为无法存活）",9:"不详"};

var TRISS_COEF = {
  mtos1995: { name: "MTOS 1995（Champion 1995；与 traumar 一致）",
    blunt: [-0.4499, 0.8085, -0.0835, -1.7430],
    penetrating: [-2.5355, 0.9934, -0.0651, -1.1360] },
  boyd1987: { name: "Boyd 1987（原始 MTOS）",
    blunt: [-1.2470, 0.9544, -0.0768, -1.9052],
    penetrating: [-0.6029, 1.1430, -0.1516, -2.6676] }
};

// injuries: [{region:0-5, ais:1-6|9}]
function calcISS(injuries) {
  var valid = injuries.filter(function(x){ return x.ais >= 1 && x.ais <= 6; });
  var hasAIS9 = injuries.some(function(x){ return x.ais === 9; });
  var regionMax = [0,0,0,0,0,0];
  valid.forEach(function(x){ if (x.ais > regionMax[x.region]) regionMax[x.region] = x.ais; });
  var has6 = valid.some(function(x){ return x.ais === 6; });
  var order = [0,1,2,3,4,5].filter(function(r){ return regionMax[r] > 0; })
    .sort(function(a,b){ return regionMax[b]-regionMax[a] || a-b; });
  var top = order.slice(0,3);
  var iss = has6 ? 75 : top.reduce(function(s,r){ return s + regionMax[r]*regionMax[r]; }, 0);
  var all = valid.map(function(x){ return x.ais; }).sort(function(a,b){ return b-a; }).slice(0,3);
  var niss = has6 ? 75 : all.reduce(function(s,a){ return s + a*a; }, 0);
  return { iss: iss, niss: niss, regionMax: regionMax, topRegions: top, nissTop: all, has6: has6, hasAIS9: hasAIS9, nValid: valid.length };
}

var POSSIBLE_ISS = (function(){
  var s = {}; s[75] = true;
  for (var a=0;a<=5;a++) for (var b=0;b<=a;b++) for (var c=0;c<=b;c++) s[a*a+b*b+c*c] = true;
  return s;
})();
function issPossible(v){ return !!POSSIBLE_ISS[v]; }

function codeGCS(g){ return g>=13?4 : g>=9?3 : g>=6?2 : g>=4?1 : 0; }
function codeSBP(s){ return s>=90?4 : s>=76?3 : s>=50?2 : s>=1?1 : 0; }
function codeRR(r){ return (r>=10&&r<=29)?4 : r>=30?3 : r>=6?2 : r>=1?1 : 0; }

function meredithV(e, m){
  var v = Math.round(-0.3756 + 0.5713*m + 0.4233*e);
  return Math.max(1, Math.min(5, v));
}

function calcRTS(gcs, sbp, rr){
  var gc = codeGCS(gcs), sc = codeSBP(sbp), rc = codeRR(rr);
  var rts = 0.9368*gc + 0.7326*sc + 0.2908*rc;
  return { gc: gc, sc: sc, rc: rc, rts: Math.round(rts*10000)/10000, trts: gc+sc+rc };
}

// mech: "blunt" | "penetrating"
function calcTRISS(rts, iss, age, mech, version, pedsRule){
  var set = TRISS_COEF[version];
  var used = mech;
  var pedsApplied = false;
  if (pedsRule && age < 15 && mech === "penetrating") { used = "blunt"; pedsApplied = true; }
  var c = set[used];
  var ai = age >= 55 ? 1 : 0;
  var b = c[0] + c[1]*rts + c[2]*iss + c[3]*ai;
  var ps = 1/(1+Math.exp(-b));
  return { b: b, ps: ps, coef: c, usedMech: used, ageIndex: ai, pedsApplied: pedsApplied, versionName: set.name };
}

function calcSI(hr, sbp, age){
  if (!(sbp > 0) || !(hr >= 0)) return null;
  var si = hr/sbp;
  return { si: si, ageSI: (age>=0 ? age*si : null) };
}


/* ===== v3.2 床旁生理评分（无需 AIS）===== */
/* GAP：Kondo 2011 Crit Care 15:R191。GCS(3–15) + 年龄<60 得3 + SBP>120 得6 / 60–120 得4 / <60 得0；3–24 分。 */
function calcGAP(gcs, age, sbp){
  if (!(gcs>=3 && gcs<=15) || !(age>=0) || !(sbp>=0)) return null;
  var a = age < 60 ? 3 : 0, s = sbp > 120 ? 6 : (sbp >= 60 ? 4 : 0), v = gcs + a + s;
  return { score:v, risk: v<=10 ? "high" : (v<=18 ? "mid" : "low"), riskName: v<=10 ? "高危(3–10)" : (v<=18 ? "中危(11–18)" : "低危(19–24)") };
}
/* MGAP：Sartorius 2010 Crit Care Med 38:831。GCS(3–15) + 钝性伤4 + 年龄<60 得5 + SBP>120 得5 / 60–120 得3；3–29 分。 */
function calcMGAP(gcs, age, sbp, mech){
  if (!(gcs>=3 && gcs<=15) || !(age>=0) || !(sbp>=0) || (mech!=="blunt" && mech!=="penetrating")) return null;
  var v = gcs + (mech==="blunt" ? 4 : 0) + (age < 60 ? 5 : 0) + (sbp > 120 ? 5 : (sbp >= 60 ? 3 : 0));
  return { score:v, risk: v<18 ? "high" : (v<=22 ? "mid" : "low"), riskName: v<18 ? "高危(<18)" : (v<=22 ? "中危(18–22)" : "低危(23–29)") };
}
/* rSIG：Kimura & Tanaka 2018 BMC Emerg Med（JTDB）。rSIG = SBP/HR × GCS；≤14.8 提示死亡风险升高（Lee 2024 韩国 31.8 万例建议 16.5）。 */
function calcRSIG(gcs, sbp, hr){
  if (!(gcs>=3 && gcs<=15) || !(sbp>=0) || !(hr>0)) return null;
  var v = sbp/hr*gcs;
  return { score:v, high: v <= 14.8 };
}

/* ===== v3.2 ICD-10 估算 ISS（交叉核对，不替代 AIS 手册评分）===== */
/* 规则移植自 ICDPIC-R cat_trauma（MIT）：每码取映射 AIS 与区域；区域取最大值；ISS = 前三区域最大 AIS 平方和，任一 AIS 6 → 75；
   NISS = 全部编码前三 AIS 平方和；死亡概率 Pmort = 1/(1+e^-(截距+Σ编码效应))。本工具对重复编码去重。 */
function normICD(raw){
  var s = String(raw||"").toUpperCase().replace(/[\s.．。]/g,"");
  if (!/^[ST]\d\d/.test(s)) return null;
  if (s.length >= 4 && typeof ICD_MAP !== "undefined" && ICD_MAP[s.slice(0,4)]) return s.slice(0,4);
  if (typeof ICD_MAP !== "undefined" && ICD_MAP[s.slice(0,3)]) return s.slice(0,3);
  return s.slice(0,4);
}
function calcICDISS(codes, ref){
  ref = ref === "NIS" ? "NIS" : "TQIP";
  var o = ref === "NIS" ? 2 : 0, seen = {}, items = [], bad = [], reg = [0,0,0,0,0,0], sevs = [], lp = ICD_INTERCEPT[ref], any6 = false;
  (codes||[]).forEach(function(c){
    var raw = String(c).trim(); if (!raw) return;
    var k = normICD(raw);
    if (!k || !ICD_MAP[k]) { bad.push(raw); return; }
    if (seen[k]) return; seen[k] = 1;
    var m = ICD_MAP[k], sev = m[o], r = m[o+1], eff = m[4 + (ref==="NIS"?1:0)];
    if (eff === null) eff = m[4 + (ref==="NIS"?0:1)] || 0;   /* 缺失时用另一参考库（同 icdpicr 的 backup 逻辑） */
    items.push({raw:raw, code:k, ais:sev, region:r}); sevs.push(sev);
    if (sev > reg[r]) reg[r] = sev; if (sev === 6) any6 = true; lp += eff;
  });
  if (!items.length) return {n:0, bad:bad, items:[], iss:null, niss:null, pmort:null, regionMax:reg, ref:ref};
  var top = reg.slice().sort(function(a,b){return b-a;}), iss = top[0]*top[0]+top[1]*top[1]+top[2]*top[2];
  var ts = sevs.slice().sort(function(a,b){return b-a;}).slice(0,3), niss = ts.reduce(function(a,v){return a+v*v;},0);
  if (any6) { iss = 75; niss = 75; }
  return {n:items.length, bad:bad, items:items, iss:iss, niss:niss, pmort:1/(1+Math.exp(-lp)), regionMax:reg, ref:ref};
}
/* 与医生 AIS 评分比较：ISS 差 ≥9，或严重创伤(≥16)判定不一致，或某区域最大 AIS 相差 ≥2 → 建议复核 */
function compareICD(icd, aisRes){
  if (!icd || icd.iss === null || !aisRes || !(aisRes.nValid > 0)) return null;
  var d = icd.iss - aisRes.iss, why = [];
  if (Math.abs(d) >= 9) why.push("ISS 相差 " + (d>0?"+":"") + d);
  if ((icd.iss >= 16) !== (aisRes.iss >= 16)) why.push("“严重创伤(ISS≥16)”判定不一致");
  for (var r = 0; r < 6; r++) { var a = aisRes.regionMax[r]||0, b = icd.regionMax[r]||0; if (Math.abs(a-b) >= 2) why.push(REGIONS[r] + " AIS " + a + " vs ICD " + b); }
  return {diff:d, review: why.length > 0, why: why};
}

function issGrade(iss){
  if (iss === 0) return "无";
  if (iss <= 8) return "轻度";
  if (iss <= 15) return "中度";
  if (iss <= 24) return "重度";
  return "极重度";
}

// ===== Self tests =====

/* ===== v3 决策层：危险分级 + 指南提示（仅为指南要点提醒，不是医嘱） ===== */
var SRC = {
  ATLS:"ATLS 11版(2025)", EU:"欧洲创伤大出血指南第6版(2023)", CN:"创伤失血性休克中国急诊专家共识(2023)",
  FT:"ACS 现场分诊指南(2021)", TQIP:"ACS TQIP 大量输血指南", BTF:"BTF 重型颅脑损伤指南第4版",
  CRASH:"CRASH-2(Lancet 2011)", MUT:"Mutschler 2013", KIM:"Kim 2016 年龄休克指数", SZ:"T/SZSMDA 2024-009",
  CADERM:"T/CADERM 3036-2020", OSLER:"Osler 1997", KJ:"Karmy-Jones 1992", TOOL:"本工具设定"
};
function isNum(x){ return typeof x === "number" && !isNaN(x); }
function deriveFlags(p){
  var f = {};
  f.hypo = isNum(p.sbp) && (p.sbp < 90 || (isNum(p.age) && p.age >= 65 && p.sbp < 110));
  f.shock = f.hypo || (isNum(p.si) && p.si >= 1.0);
  f.tbi = (isNum(p.gcs) && p.gcs <= 8) || (isNum(p.headAIS) && p.headAIS >= 3);
  f.abc = (p.torsoPen?1:0) + (isNum(p.hr) && p.hr > 120 ? 1:0) + (isNum(p.sbp) && p.sbp < 90 ? 1:0) + (p.fast?1:0);
  return f;
}
function calcTier(p){
  /* v3 阈值经 TITCO-I / CRASH-2 / UVA 外部数据检验后调整（见 validation_report.md） */
  var f = deriveFlags(p), R = [], O = [], Y = [];
  if (isNum(p.gcs) && p.gcs <= 8) R.push("GCS " + p.gcs + " ≤8");
  if (p.intub) R.push("已插管/需辅助通气");
  if (isNum(p.sbp) && p.sbp < 90) R.push("SBP " + p.sbp + " <90");
  else if (f.hypo) R.push("≥65 岁 SBP " + p.sbp + " <110");
  if (isNum(p.si) && p.si >= 1.4) R.push("SI " + p.si.toFixed(2) + " ≥1.4");
  if (isNum(p.rr) && (p.rr < 10 || p.rr > 29)) R.push("RR " + p.rr + (p.rr < 10 ? " <10" : " >29"));
  if (f.abc >= 2) R.push("ABC 评分 " + f.abc + " ≥2");
  if (isNum(p.iss) && p.iss >= 25) R.push("ISS " + p.iss + " ≥25");
  if (isNum(p.ps) && p.ps < 0.9) R.push("TRISS Ps " + (p.ps*100).toFixed(1) + "% <90%");
  if (isNum(p.age) && p.age >= 65 && isNum(p.iss) && p.iss >= 9) R.push("≥65 岁且 ISS " + p.iss + " ≥9");
  if (isNum(p.gcs) && p.gcs >= 9 && p.gcs <= 12) O.push("GCS " + p.gcs + "（9–12）");
  if (isNum(p.iss) && p.iss >= 16 && p.iss < 25) O.push("ISS " + p.iss + "（16–24）");
  if (isNum(p.si) && p.si >= 1.0 && p.si < 1.4) O.push("SI " + p.si.toFixed(2) + "（1.0–<1.4）");
  if (isNum(p.age) && p.age >= 65 && isNum(p.ageSI) && p.ageSI >= 50) O.push("≥65 岁且年龄休克指数 ≥50");
  if (p.torsoPen) O.push("躯干穿透伤");
  if (isNum(p.niss) && p.niss >= 16 && isNum(p.iss) && p.iss < 16) O.push("NISS " + p.niss + " ≥16（ISS 可能低估）");
  if (isNum(p.iss) && p.iss >= 9 && p.iss <= 15) Y.push("ISS " + p.iss + "（9–15）");
  if (isNum(p.gcs) && p.gcs >= 13 && p.gcs <= 14) Y.push("GCS " + p.gcs + "（13–14）");
  if (isNum(p.si) && p.si >= 0.9 && p.si < 1.0) Y.push("SI " + p.si.toFixed(2) + "（0.9–<1.0）");
  if (isNum(p.age) && p.age >= 65) Y.push("年龄 ≥65 岁");
  if (p.anticoag) Y.push("服用抗凝/抗血小板药");
  if (p.mech === "penetrating" && !p.torsoPen) Y.push("穿透伤（部位待明确）");
  var known = isNum(p.gcs) || isNum(p.sbp) || isNum(p.rr) || isNum(p.si) || (isNum(p.iss) && p.iss > 0);
  if (R.length) return {level:"red", name:"红色 · 危重", sub:"立即复苏，启动高级别创伤团队", recheck:"持续监护，每 5–15 分钟复评", reasons:R, minor:O.concat(Y)};
  if (O.length) return {level:"orange", name:"橙色 · 重症", sub:"尽快由创伤团队评估，密切监测", recheck:"建议每 15–30 分钟复评", reasons:O, minor:Y};
  if (Y.length) return {level:"yellow", name:"黄色 · 需关注", sub:"完善评估，动态复评，放低升级阈值", recheck:"建议每 30–60 分钟复评", reasons:Y, minor:[]};
  if (!known) return {level:"grey", name:"待评估", sub:"录入损伤或生理参数后显示分级", recheck:"", reasons:[], minor:[]};
  return {level:"green", name:"绿色 · 低危", sub:"完成二次评估，常规观察", recheck:"病情变化时随时复评", reasons:["未触发红/橙/黄标准"], minor:[]};
}
/* 指南提示库：pri 1=立即 2=尽快 3=后续；role doc 医生 / nurse 护士 / team 团队 */
var ACTIONS = [
 {id:"tta", pri:1, role:"team", when:function(p,f,t){return t.level==="red";}, title:"启动高级别创伤团队", text:"通知急诊/创伤外科/麻醉/输血科，准备复苏单元", src:["FT","SZ"]},
 {id:"xabcde", pri:1, role:"team", when:function(p,f,t){return t.level==="red"||t.level==="orange";}, title:"按 xABCDE 完成初级评估", text:"先控制致命性外出血，再依次评估气道、呼吸、循环、神经、暴露；病情变化随时复评", src:["ATLS"]},
 {id:"airway", pri:1, role:"doc", when:function(p){return isNum(p.gcs)&&p.gcs<=8&&!p.intub;}, title:"评估并建立确定性气道", text:"GCS ≤8：建议气管插管，目标正常通气（PaCO₂ 35–40 mmHg）", src:["EU","CN"]},
 {id:"vent", pri:1, role:"doc", when:function(p){return p.intub;}, title:"确认导管位置与通气", text:"呼气末 CO₂ 确认，避免过度通气；GCS 为非标准值", src:["EU","ATLS"]},
 {id:"breath", pri:1, role:"doc", when:function(p){return isNum(p.rr)&&(p.rr<10||p.rr>29);}, title:"评估通气与氧合", text:"RR 异常：查 SpO₂、血气，排查张力性气胸/连枷胸", src:["FT","ATLS"]},
 {id:"bleed", pri:1, role:"doc", when:function(p,f){return f.shock;}, title:"按失血性休克处置，寻找出血源", text:"FAST、胸片、骨盆片；骨盆骨折疑似时上骨盆带", src:["CN","EU"]},
 {id:"iv", pri:1, role:"nurse", when:function(p,f){return f.shock;}, title:"建立大口径静脉通路", text:"首选外周大口径；穿刺困难时改骨髓腔通路", src:["ATLS","CN"]},
 {id:"lab", pri:1, role:"nurse", when:function(p,f,t){return f.shock||t.level==="red";}, title:"急查血标本并配血", text:"血常规、血气+乳酸、凝血、血型交叉配血（育龄女性加查 hCG），并按需复查", src:["CN","EU"]},
 {id:"mtp", pri:1, role:"team", when:function(p,f){return f.abc>=2||(isNum(p.si)&&p.si>=1.4);}, title:"评估启动大量输血方案（MTP）", text:"ABC ≥2 或 SI ≥1.4：血浆:红细胞 1:1–1:2", src:["TQIP","MUT"]},
 {id:"txa", pri:1, role:"doc", when:function(p,f){return f.shock&&!(isNum(p.hours)&&p.hours>3);}, title:"伤后 3 小时内考虑氨甲环酸", text:"无禁忌时 1 g 静推 10 min，随后 1 g 8 h 内泵入；越早越好", src:["CRASH","EU","CN"]},
 {id:"txa3", pri:2, role:"doc", when:function(p,f){return f.shock&&isNum(p.hours)&&p.hours>3;}, title:"伤后已超 3 小时：不推荐常规使用氨甲环酸", text:"CRASH-2 中 3 h 后给药出血死亡风险反而增加", src:["CRASH","CN"]},
 {id:"permhypo", pri:2, role:"doc", when:function(p,f){return f.shock&&!f.tbi;}, title:"无颅脑伤：允许性低血压", text:"出血控制前目标 SBP 80–90 mmHg", src:["EU","CN"]},
 {id:"tbibp", pri:1, role:"doc", when:function(p,f){return f.tbi&&(f.shock||(isNum(p.sbp)&&p.sbp<110));}, title:"合并颅脑伤：维持脑灌注", text:"目标 SBP ≥110 或 MAP ≥80 mmHg，避免低血压与低氧", src:["EU","CN","BTF"]},
 {id:"pressor", pri:2, role:"doc", when:function(p){return isNum(p.sbp)&&p.sbp<70;}, title:"SBP <70：考虑去甲肾上腺素", text:"在容量复苏同时使用，不作常规替代输血", src:["CN"]},
 {id:"warm", pri:2, role:"nurse", when:function(p,f,t){return f.shock||t.level==="red";}, title:"保温复温", text:"监测核心体温，目标 36–37 ℃；输液/血制品加温", src:["EU","CN"]},
 {id:"ca", pri:2, role:"nurse", when:function(p,f){return f.shock;}, title:"监测离子钙", text:"输血过程中维持离子钙 ≥1.0 mmol/L", src:["CN","EU"]},
 {id:"pen", pri:1, role:"team", when:function(p){return p.torsoPen;}, title:"躯干穿透伤：优先确定性止血", text:"尽早联系手术室或介入，不因影像检查延误", src:["FT","TQIP"]},
 {id:"fast", pri:1, role:"team", when:function(p,f){return p.fast&&f.shock;}, title:"FAST 阳性伴休克：手术/介入止血", text:"不稳定患者优先止血，避免长时间转运去 CT", src:["CN","EU"]},
 {id:"neuro", pri:2, role:"doc", when:function(p){return (isNum(p.gcs)&&p.gcs<=12)||(isNum(p.headAIS)&&p.headAIS>=3);}, title:"颅脑评估", text:"瞳孔、头颅 CT，神经外科会诊；动态 GCS", src:["ATLS","BTF"]},
 {id:"anticoag", pri:2, role:"doc", when:function(p){return p.anticoag;}, title:"抗凝/抗血小板史", text:"查凝血功能，评估逆转；头部受伤者低阈值行头颅 CT", src:["CN","FT"]},
 {id:"elder", pri:2, role:"doc", when:function(p){return isNum(p.age)&&p.age>=65;}, title:"老年患者：警惕“假正常”生命体征", text:"SBP <110 即视为低血压；年龄休克指数 ≥50 提示不稳定", src:["FT","KIM"]},
 {id:"monitor", pri:2, role:"nurse", when:function(p,f,t){return t.level==="red"||t.level==="orange";}, title:"持续监护与记录", text:"心电、血压、SpO₂、体温；记出入量，排除尿道损伤后留置导尿", src:["ATLS","SZ"]},
 {id:"severe", pri:2, role:"team", when:function(p){return isNum(p.iss)&&p.iss>=16;}, title:"严重创伤：收治与多学科会诊", text:"ISS ≥16 属严重创伤，按创伤中心流程收治（ICU/手术）", src:["CADERM"]},
 {id:"niss", pri:3, role:"doc", when:function(p){return isNum(p.niss)&&isNum(p.iss)&&p.niss>p.iss;}, title:"NISS 高于 ISS", text:"同一区域有多处严重损伤，ISS 可能低估伤情", src:["OSLER"]},
 {id:"review", pri:3, role:"team", when:function(p){return isNum(p.ps)&&p.ps<0.5;}, title:"Ps <50%：纳入质控复核", text:"若患者存活即为“意外存活”，需病例讨论；Ps 不得作为放弃救治依据", src:["KJ"]},
 {id:"green", pri:3, role:"doc", when:function(p,f,t){return t.level==="green";}, title:"完成二次评估", text:"从头到脚查体，处理隐匿损伤；病情变化时重新评分", src:["ATLS"]},
 {id:"yellow", pri:2, role:"team", when:function(p,f,t){return t.level==="yellow";}, title:"动态复评", text:"完善影像与实验室检查，出现红/橙指标立即升级", src:["ATLS"]}
];
function getActions(p, tier){
  var f = deriveFlags(p);
  var out = ACTIONS.filter(function(a){ try { return a.when(p, f, tier); } catch(e){ return false; } });
  out.sort(function(a,b){ return a.pri - b.pri; });
  return out.map(function(a){ return {id:a.id, pri:a.pri, role:a.role, title:a.title, text:a.text, src:a.src.map(function(k){return SRC[k];})}; });
}

function runSelfTests(){
  var R = [];
  function t(name, got, exp){ R.push({name:name, got:String(got), exp:String(exp), pass:String(got)===String(exp)}); }
  function inj(list){ return list.map(function(p){ return {region:p[0], ais:p[1]}; }); }
  var a;
  a = calcISS(inj([[0,4],[2,3],[4,3]])); t("1 头颈4/胸3/四肢3 ISS,NISS", a.iss+","+a.niss, "34,34");
  a = calcISS(inj([[0,4],[0,3],[2,2]])); t("2 头颈4+3/胸2 ISS,NISS", a.iss+","+a.niss, "20,29");
  a = calcISS(inj([[2,3],[2,2],[3,2]])); t("3 胸3+2/腹2 ISS,NISS", a.iss+","+a.niss, "13,17");
  a = calcISS(inj([[3,6],[2,1]])); t("4 任一AIS 6 ISS,NISS", a.iss+","+a.niss, "75,75");
  a = calcISS([]); t("5 无损伤 ISS,NISS", a.iss+","+a.niss, "0,0");
  a = calcISS(inj([[0,3],[2,9]])); t("6 头颈3+AIS9 ISS,NISS,提示", a.iss+","+a.niss+","+a.hasAIS9, "9,9,true");
  a = calcISS(inj([[5,1]])); t("7 仅体表1 ISS", a.iss, 1);
  t("8 SBP 89/90/76/75/50/49/1/0", [89,90,76,75,50,49,1,0].map(codeSBP).join("/"), "3/4/3/2/2/1/1/0");
  t("9 RR 9/10/29/30/6/5/0", [9,10,29,30,6,5,0].map(codeRR).join("/"), "2/4/4/3/2/1/0");
  t("10 GCS 13/12/9/8/6/5/4/3", [13,12,9,8,6,5,4,3].map(codeGCS).join("/"), "4/3/3/2/2/1/1/0");
  a = calcRTS(15,120,18); t("11 正常生理 RTS,T-RTS", a.rts.toFixed(4)+","+a.trts, "7.8408,12");
  t("分级-GCS8 红", calcTier({gcs:8}).level, "red");
  t("分级-≥65岁 SBP105 红", calcTier({sbp:105, age:70}).level, "red");
  t("分级-ISS20 橙", calcTier({iss:20, gcs:15, sbp:120, rr:16}).level, "orange");
  t("分级-SI1.2 橙", calcTier({si:1.2, gcs:15, sbp:100, rr:16}).level, "orange");
  t("分级-70岁ISS9 红", calcTier({iss:9, age:70, gcs:15, sbp:130, rr:16}).level, "red");
  t("分级-ISS9 黄", calcTier({iss:9, gcs:15, sbp:120, rr:16}).level, "yellow");
  t("分级-正常 绿", calcTier({iss:4, gcs:15, sbp:120, rr:16, si:0.6}).level, "green");
  t("提示-伤后4h 不推TXA", getActions({sbp:80, hours:4}, calcTier({sbp:80})).map(function(a){return a.id;}).indexOf("txa"), -1);
  function ps(g,s,r,iss,age,m){ var x = calcRTS(g,s,r); return { rts:x.rts, ps: calcTRISS(x.rts, iss, age, m, "mtos1995", true).ps }; }
  a = ps(15,120,18,9,30,"blunt"); t("12 TRISS 钝性 30岁 ISS9 Ps", a.ps.toFixed(4), "0.9942");
  a = ps(8,80,32,34,60,"blunt"); t("13 TRISS 钝性 60岁 ISS34 RTS,Ps", a.rts.toFixed(4)+","+a.ps.toFixed(4), "4.9438,0.2621");
  a = ps(12,70,24,25,40,"penetrating"); t("14 TRISS 穿透 40岁 ISS25 RTS,Ps", a.rts.toFixed(4)+","+a.ps.toFixed(4), "5.4388,0.7755");
  a = ps(3,0,0,75,70,"blunt"); t("15 TRISS 无生命体征 ISS75 RTS,Ps", a.rts.toFixed(4)+","+a.ps.toFixed(4), "0.0000,0.0002");
  a = calcTRISS(7.8408, 9, 10, "penetrating", "mtos1995", true); t("16 10岁穿透 儿童规则→钝性", a.usedMech, "blunt");
  // extra integrity checks
  var bad = [7,15,23,28,31,37,39,40,44,46,47,49,52,53,55,56,58,60,61,62,63,64,65,67,68,69,70,71,72,73,74];
  t("17 不可能 ISS 值集合", bad.every(function(v){ return !issPossible(v); }) && [0,1,9,16,25,34,50,66,75].every(issPossible), true);
  t("18 GAP GCS15/30岁/SBP130", calcGAP(15,30,130).score+","+calcGAP(15,30,130).risk, "24,low");
  t("19 GAP 边界 SBP120/60/59 年龄60", [120,60,59].map(function(x){return calcGAP(10,60,x).score;}).join("/"), "14/14/10");
  t("20 MGAP 穿透 GCS8/40岁/SBP70", calcMGAP(8,40,70,"penetrating").score+","+calcMGAP(8,40,70,"penetrating").risk, "16,high");
  t("21 MGAP 分组边界 17/18/22/23", [[13,70,50,"blunt"],[14,70,50,"blunt"],[10,40,100,"blunt"],[11,40,100,"blunt"]].map(function(a){return calcMGAP.apply(null,a).risk;}).join("/"), "high/mid/mid/low");
  t("22 rSIG 120/80×10，≤14.8", calcRSIG(10,120,80).score.toFixed(1)+","+calcRSIG(10,120,80).high, "15.0,false");
  t("23 无效输入返回 null", [calcGAP(2,30,100), calcMGAP(15,30,100,"x"), calcRSIG(15,100,0)].every(function(x){return x===null;}), true);
  var ic = calcICDISS(["S06.5","S27.0","S72.0"]); t("24 ICD S06.5/S27.0/S72.0（TQIP）ISS,NISS,n", ic.iss+","+ic.niss+","+ic.n, "21,21,3");
  ic = calcICDISS(["s06.501","S06.5","x99","S0650"]); t("25 ICD 国家临床版扩展码截断/去重/非伤编码", ic.n+","+ic.bad.join("|"), "1,x99");
  t("26 ICD 无有效编码", calcICDISS([]).iss, null);
  return R;
}

if (typeof module !== "undefined" && typeof ICD_MAP === "undefined") { var _m = require("./icdmap.js"); ICD_MAP = _m.ICD_MAP; ICD_INTERCEPT = _m.ICD_INTERCEPT; }
if (typeof module !== "undefined") module.exports = { calcISS:calcISS, calcRTS:calcRTS, calcTRISS:calcTRISS, calcSI:calcSI, meredithV:meredithV, runSelfTests:runSelfTests, issPossible:issPossible, calcTier:calcTier, getActions:getActions, calcGAP:calcGAP, calcMGAP:calcMGAP, calcRSIG:calcRSIG, calcICDISS:calcICDISS, compareICD:compareICD, normICD:normICD };
