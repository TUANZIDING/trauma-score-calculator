import pandas as pd,numpy as np,json
from scipy.stats import rankdata
d=pd.read_json('v32.jsonl',lines=True)
def delong(y,s):
    y=np.asarray(y);s=np.asarray(s,float);pos=s[y==1];neg=s[y==0];m,n=len(pos),len(neg)
    allr=rankdata(np.r_[pos,neg]);rp=rankdata(pos);rn=rankdata(neg)
    auc=(allr[:m].sum()-m*(m+1)/2)/(m*n);v10=(allr[:m]-rp)/n;v01=1-(allr[m:]-rn)/m
    se=np.sqrt(v10.var(ddof=1)/m+v01.var(ddof=1)/n);return auc,se
R={}
for ds in ['titco','crash2','uva']:
  x=d[d.ds==ds];R[ds]={}
  cols=['gap','mgap','rsig','rts','si'] if ds!='uva' else ['mgap_rec']
  # common complete-case subset for fair comparison
  cc=x.dropna(subset=['died']+[c for c in ['gap','mgap','rsig','rts'] if c in x and ds!='uva']) if ds!='uva' else x.dropna(subset=['died','mgap_rec'])
  for c in cols:
    for lab,df in [('all',x),('common',cc)]:
      y=df[[c,'died']].dropna()
      if len(y)<50: continue
      a,se=delong(y.died,-y[c] if c!='si' else y[c])
      R[ds][c+'_'+lab]=dict(n=len(y),deaths=int(y.died.sum()),auc=round(a,3),ci=[round(a-1.96*se,3),round(a+1.96*se,3)])
  for c in ['gapr','mgapr']:
    if c in x:
      y=x[[c,'died']].dropna();R[ds][c]={k:dict(n=int((y[c]==k).sum()),mort=round(100*y[y[c]==k].died.mean(),1)) for k in ['high','mid','low']}
  if 'rsig' in x:
    y=x[['rsig','died']].dropna()
    for cut in [14.8,16.5]:
      p=y.rsig<=cut;tp=(p&(y.died==1)).sum();R[ds]['rsig<=%s'%cut]=dict(sens=round(tp/(y.died==1).sum(),3),spec=round(((~p)&(y.died==0)).sum()/(y.died==0).sum(),3),mort_pos=round(100*y[p].died.mean(),1),mort_neg=round(100*y[~p].died.mean(),1))
json.dump(R,open('../results_v3.2_bedside.json','w'),ensure_ascii=False,indent=1);print(json.dumps(R,indent=1))
