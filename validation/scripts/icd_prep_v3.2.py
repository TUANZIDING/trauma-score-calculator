import pandas as pd,json,re
d=pd.read_csv('../data/titco/titco-I-full-dataset-v1.csv',low_memory=False,encoding='latin1')
cols=[c for c in d.columns if c.endswith('_icd') and c[0] in 'exfco']
with open('icd_in.jsonl','w') as f:
  for _,r in d.iterrows():
    codes=[]
    for c in cols:
      v=r[c]
      if isinstance(v,str): codes+= [x.strip() for x in re.split('[,;/ ]+',v) if x.strip()]
    f.write(json.dumps(dict(died=None if pd.isna(r['died']) else int(r['died']=='Yes'),burn=int(r['moi']=='Burn'),iss=None if pd.isna(r['iss']) else float(r['iss']),niss=None if pd.isna(r['niss']) else float(r['niss']),codes=codes))+'\n')
