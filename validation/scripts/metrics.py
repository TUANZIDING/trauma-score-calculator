import pandas as pd, numpy as np, json
from scipy.stats import norm
d=pd.read_json('out.jsonl',lines=True)
def delong(y,s):
    y=np.asarray(y);s=np.asarray(s,float);pos=s[y==1];neg=s[y==0];m,n=len(pos),len(neg)
    from scipy.stats import rankdata
    allr=rankdata(np.r_[pos,neg]);rp=rankdata(pos);rn=rankdata(neg)
    auc=(allr[:m].sum()-m*(m+1)/2)/(m*n)
    v10=(allr[:m]-rp)/n; v01=1-(allr[m:]-rn)/m
    se=np.sqrt(v10.var(ddof=1)/m+v01.var(ddof=1)/n)
    return auc,se
def aucres(df,col,higher_worse=True):
    x=df[[col,'died']].dropna()
    s=x[col] if higher_worse else -x[col]
    a,se=delong(x.died,s)
    return dict(n=int(len(x)),deaths=int(x.died.sum()),auc=round(a,3),ci=[round(a-1.96*se,3),round(a+1.96*se,3)])
def logit(p): p=np.clip(p,1e-6,1-1e-6); return np.log(p/(1-p))
def lr(X,y,offset=None,it=50):
    X=np.c_[np.ones(len(y)),X] if X is not None else np.ones((len(y),1));b=np.zeros(X.shape[1]);off=0 if offset is None else offset
    for _ in range(it):
        p=1/(1+np.exp(-(X@b+off)));W=p*(1-p);g=X.T@(y-p);H=(X*W[:,None]).T@X;b+=np.linalg.solve(H,g)
    se=np.sqrt(np.diag(np.linalg.inv(H)));return b,se
def triss_cal(df):
    x=df[['ps','died']].dropna();y=x.died.values.astype(float);pd_=1-x.ps.values;lp=logit(pd_)
    citl,citlse=lr(None,y,offset=lp);sl,slse=lr(lp[:,None],y)
    surv=1-y;A=surv.sum();E=x.ps.sum();N=len(x)
    W=(A-E)/N*100;Z=(A-E)/np.sqrt((x.ps*(1-x.ps)).sum())
    q=pd.qcut(pd_,10,labels=False,duplicates='drop');dec=[]
    for k in sorted(set(q)):
        m=q==k;dec.append(dict(decile=int(k)+1,n=int(m.sum()),pred_mort=round(pd_[m].mean()*100,1),obs_mort=round(y[m].mean()*100,1)))
    return dict(n=N,deaths=int(y.sum()),brier=round(float(np.mean((pd_-y)**2)),4),
      calibration_in_the_large=round(float(citl[0]),3),calibration_in_the_large_ci=[round(float(citl[0]-1.96*citlse[0]),3),round(float(citl[0]+1.96*citlse[0]),3)],
      calibration_slope=round(float(sl[1]),3),calibration_slope_ci=[round(float(sl[1]-1.96*slse[1]),3),round(float(sl[1]+1.96*slse[1]),3)],
      expected_deaths=round(float(pd_.sum()),1),observed_deaths=int(y.sum()),W=round(float(W),2),Z=round(float(Z),2),deciles=dec)
def tiers(df,mode):
    x=df.copy();g,s,si,rr,iss,ps,age=[x.get(c) if c in x else pd.Series(np.nan,index=x.index) for c in ['gcs','sbp','si','rr','iss_rec','ps','age']]
    crit={}
    if mode in('full','phys'):
        crit.update({'GCS<=8':g<=8,'SBP<90':s<90,'SI>=1.0':si>=1.0,'RR<10':rr<10,'RR>29':rr>29})
    if mode in('full','iss'): crit['ISS>=25']=iss>=25
    if mode=='full': crit['Ps<0.5']=ps<0.5
    red=np.logical_or.reduce([v.fillna(False).values for v in crit.values()])
    oc={}
    if mode in('full','iss'): oc['ISS16-24']=(iss>=16)&(iss<=24)
    if mode in('full','phys'): oc['GCS9-12']=(g>=9)&(g<=12); oc['0.8<=SI<1.0']=(si>=0.8)&(si<1.0)
    if mode=='full': oc['0.5<=Ps<0.9']=(ps>=0.5)&(ps<0.9); oc['age>=65&ISS>=9']=(age>=65)&(iss>=9)
    org=np.logical_or.reduce([v.fillna(False).values for v in oc.values()])&~red
    yel=((iss>=9)&(iss<=15)).fillna(False).values&~red&~org if mode in('full','iss') else np.zeros(len(x),bool)
    t=np.where(red,'Red',np.where(org,'Orange',np.where(yel,'Yellow','Green')))
    y=x.died.values;out=[]
    for k in['Red','Orange','Yellow','Green']:
        m=t==k;out.append(dict(tier=k,n=int(m.sum()),deaths=int(y[m].sum()),mortality_pct=round(float(y[m].mean()*100),1) if m.sum() else None))
    tp=int((red&(y==1)).sum());fp=int((red&(y==0)).sum());fn=int((~red&(y==1)).sum());tn=int((~red&(y==0)).sum())
    perf=dict(sens=round(tp/(tp+fn),3),spec=round(tn/(tn+fp),3),ppv=round(tp/(tp+fp),3),npv=round(tn/(tn+fn),3),tp=tp,fp=fp,fn=fn,tn=tn)
    contrib=[]
    others=lambda k:np.logical_or.reduce([v.fillna(False).values for kk,v in crit.items() if kk!=k]) if len(crit)>1 else np.zeros(len(x),bool)
    for k,v in crit.items():
        m=v.fillna(False).values;only=m&~others(k)
        contrib.append(dict(criterion=k,n_met=int(m.sum()),missing=int(v.index[v.isna()].size) if False else int((~x[{'GCS<=8':'gcs','SBP<90':'sbp','SI>=1.0':'si','RR<10':'rr','RR>29':'rr','ISS>=25':'iss_rec','Ps<0.5':'ps'}[k]].notna()).sum()),
          mortality_pct=round(float(y[m].mean()*100),1) if m.sum() else None,deaths_captured=int(y[m].sum()),
          sole_trigger_n=int(only.sum()),sole_trigger_deaths=int(y[only].sum())))
    ocontrib=[dict(criterion=k,n_met=int(v.fillna(False).sum()),mortality_pct=round(float(y[v.fillna(False).values].mean()*100),1) if v.fillna(False).sum() else None) for k,v in oc.items()]
    return dict(mode=mode,n=int(len(x)),tiers=out,red_for_death=perf,red_criteria=crit_list if False else contrib,orange_criteria=ocontrib)
R={'datasets':[]}
# TITCO
t=d[(d.ds=='titco')&d.died.notna()].copy()
prim=t[t.burn==0]
iss_cmp=prim[prim.iss_rec.notna()&prim.iss_calc.notna()]
allc=t[t.iss_rec.notna()&t.iss_calc.notna()]
agree=dict(n=int(len(iss_cmp)),exact_pct=round(float((iss_cmp.iss_rec==iss_cmp.iss_calc).mean()*100),2),
  within1_pct=round(float(((iss_cmp.iss_rec-iss_cmp.iss_calc).abs()<=1).mean()*100),2),
  niss_exact_pct=round(float((iss_cmp.niss_rec==iss_cmp.niss_calc).mean()*100),2),
  all_incl_burns_n=int(len(allc)),all_incl_burns_iss_exact_pct=round(float((allc.iss_rec==allc.iss_calc).mean()*100),2),
  rows_with_any_region_code=int(prim.iss_calc.notna().sum()),recorded_iss_missing=int(prim.iss_rec.isna().sum()))
mism=iss_cmp[iss_cmp.iss_rec!=iss_cmp.iss_calc]
agree['mismatch_examples_diff_distribution']={str(int(k)):int(v) for k,v in (mism.iss_rec-mism.iss_calc).value_counts().head(8).items()}
def titco_metrics(df):
    m={'ISS':aucres(df,'iss_rec'),'ISS_recomputed':aucres(df,'iss_calc'),'NISS':aucres(df,'niss_rec'),'RTS':aucres(df,'rts',False),'T-RTS':aucres(df,'trts',False),
       'SI':aucres(df,'si'),'AgeSI':aucres(df,'agesi'),'TRISS_Ps':aucres(df,'ps',False)}
    cc=df[['iss_rec','niss_rec','rts','si','ps','died']].dropna()
    m['common_complete_case']=dict(n=int(len(cc)),deaths=int(cc.died.sum()),**{k:aucres(cc,c,hw)['auc'] for k,c,hw in [('ISS','iss_rec',1),('NISS','niss_rec',1),('RTS','rts',0),('SI','si',1),('TRISS','ps',0)]})
    m['TRISS_calibration']=triss_cal(df);return m
tm=titco_metrics(prim)
sens={'include_burns':{k:v for k,v in titco_metrics(t).items() if k in('ISS','NISS','RTS','TRISS_Ps')},
      'exclude_DAMA':{k:v for k,v in titco_metrics(prim[prim.dama==0]).items() if k in('ISS','NISS','RTS','TRISS_Ps')}}
sens['include_burns']['TRISS_calibration']={k:v for k,v in triss_cal(t).items() if k!='deciles'}
sens['exclude_DAMA']['TRISS_calibration']={k:v for k,v in triss_cal(prim[prim.dama==0]).items() if k!='deciles'}
# penetrating/blunt split for TRISS
tm['TRISS_by_mech']={mk:aucres(prim[prim.mech==mk],'ps',False) for mk in['blunt','penetrating']}
R['datasets'].append(dict(name='TITCO-I',n=int(len(prim)),deaths=int(prim.died.sum()),population_note='primary: burns excluded; DAMA kept as survivors; 1 row missing outcome dropped',
  n_total_with_outcome=int(len(t)),deaths_total=int(t.died.sum()),iss_agreement=agree,metrics=tm,sensitivity=sens,tiers=tiers(prim,'full')))
c=d[d.ds=='crash2'].copy()
R['datasets'].append(dict(name='CRASH-2',n=int(len(c)),deaths=int(c.died.sum()),metrics={'RTS':aucres(c,'rts',False),'T-RTS':aucres(c,'trts',False),'SI':aucres(c,'si'),'AgeSI':aucres(c,'agesi'),
  'GCS':aucres(c,'gcs',False),'SBP':aucres(c,'sbp',False)},tiers=tiers(c,'phys')))
u=d[(d.ds=='uva')&d.died.notna()].copy()
R['datasets'].append(dict(name='UVA',n=int(len(u)),deaths=int(u.died.sum()),metrics={'ISS':aucres(u,'iss_rec'),'NISS':aucres(u,'niss_rec'),'registry_TRISS_pos':aucres(u,'pos',False),'MGAP':aucres(u,'mgap',False),
  'recomputed_ISS':'not possible: no AIS/region columns in dataset'},tiers=tiers(u,'iss')))
R['implementation_check']=json.load(open('impl.json'))
json.dump(R,open('results.json','w'),separators=(',',':'),ensure_ascii=False)
print(json.dumps(R,indent=1,ensure_ascii=False))
