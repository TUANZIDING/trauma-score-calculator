import pandas as pd, numpy as np, re, json
D='../data/'  # put downloaded datasets here, see README
def num(x):
    try: return float(x)
    except: return None
def nz(v): return None if v is None or (isinstance(v,float) and np.isnan(v)) else float(v)
out=[]
# TITCO
d=pd.read_csv(D+'titco/titco-I-full-dataset-v1.csv',low_memory=False,encoding='latin1')
cols=['head_and_neck','face','chest','abdomen_and_pelvic_contents','extremities','external']
for _,r in d.iterrows():
    inj=[]
    anyais=False
    for i,c in enumerate(cols):
        v=r[c]
        if isinstance(v,str):
            for t in v.split(','):
                nums=[int(x) for x in re.findall(r'\d',t)]
                if nums: inj.append({'region':i,'ais':max(nums)}); anyais=True
    age=str(r['age']); age=90.0 if age.startswith('>') else num(age)
    out.append(dict(ds='titco',died=None if pd.isna(r['died']) else int(r['died']=='Yes'),
      dama=int(r['dama']=='Yes'),burn=int(r['moi']=='Burn'),age=age,
      mech=None if pd.isna(r['ti']) else r['ti'].lower(),
      gcs=nz(r['gcs_t_1']),sbp=nz(r['sbp_1']),rr=nz(r['rr_1']),hr=nz(r['hr_1']),
      iss_rec=nz(r['iss']),niss_rec=nz(r['niss']),inj=inj if anyais else None))
c=pd.read_stata(D+'crash2/crash2.dta')
for _,r in c.iterrows():
    out.append(dict(ds='crash2',died=int(pd.notna(r['ddeath'])),age=nz(r['age']),gcs=nz(r['gcs']),sbp=nz(r['sbp']),rr=nz(r['rr']),hr=nz(r['hr']),mech=str(r['injurytype'])))
u=pd.read_csv(D+'uva/injury_scores_data.csv')
for _,r in u.iterrows():
    out.append(dict(ds='uva',died=None if pd.isna(r['dc_status']) else int(r['dc_status']=='Dead'),iss_rec=nz(r['iss']),niss_rec=nz(r['niss']),pos=nz(r['pos']),mgap=nz(r['mgap_total']),mech=r['blunt_pen'].lower()))
with open('in.jsonl','w') as f:
    for o in out: f.write(json.dumps(o)+'\n')
print(len(out))
