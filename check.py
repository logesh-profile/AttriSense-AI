import pandas as pd
df=pd.read_csv("dataset/datas.csv")
print(df.columns.tolist())
print(df.dtypes)
