import pandas as pd,numpy as np,json
from scipy.stats import rankdata,spearmanr
d=pd.read_json('icd_out.jsonl',lines=True)
def delong(y,s):
    y=np.asarray(y);s=np.asarray(s,float);pos=s[y==1];neg=s[y==0];m,n=len(pos),len(neg)
    allr=rankdata(np.r_[pos,neg]);rp=rankdata(pos);rn=rankdata(neg)
    auc=(allr[:m].sum()-m*(m+1)/2)/(m*n);v10=(allr[:m]-rp)/n;v01=1-(allr[m:]-rn)/m
    se=np.sqrt(v10.var(ddof=1)/m+v01.var(ddof=1)/n);return round(auc,3),[round(auc-1.96*se,3),round(auc+1.96*se,3)]
x=d.dropna(subset=['died','iss','iss_t','iss_n']).copy()
R={'n':len(x),'deaths':int(x.died.sum())}
for c in ['iss','niss','iss_t','niss_t','pm_t','iss_n','niss_n','pm_n']:
    a,ci=delong(x.died,x[c]);R['auc_'+c]=dict(auc=a,ci=ci)
for k in ['t','n']:
    diff=x['iss_'+k]-x.iss
    a=(x.iss>=16);b=(x['iss_'+k]>=16);po=(a==b).mean();pe=a.mean()*b.mean()+(1-a.mean())*(1-b.mean())
    R['agree_'+k]=dict(spearman=round(spearmanr(x.iss,x['iss_'+k]).correlation,3),median_diff=float(diff.median()),within8=round(float((diff.abs()<=8).mean()),3),review_ge9=round(float((diff.abs()>=9).mean()),3),
       kappa16=round((po-pe)/(1-pe),3),sens16=round(float((b&a).sum()/a.sum()),3),spec16=round(float((~b&~a).sum()/(~a).sum()),3))
    p=x['pm_'+k];R['cal_'+k]=dict(expected=round(float(p.sum()),1),observed=int(x.died.sum()))
json.dump(R,open('../results_v3.2_icd.json','w'),ensure_ascii=False,indent=1);print(json.dumps(R,indent=1,ensure_ascii=False))
