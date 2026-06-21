import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

# Load Dataset
df = pd.read_csv("dataset/datas.csv")

# Dataset Information
print("Dataset Shape:")
print(df.shape)

print("\nAttrition Count:")
print(df["Attrition"].value_counts())

# Graph
sns.countplot(x="Attrition", data=df)
plt.title("Employee Attrition Distribution")


# Convert all text columns to numbers
le = LabelEncoder()

for column in df.columns:
    if df[column].dtype == "object" or str(df[column].dtype) == "str":
        df[column] = le.fit_transform(df[column])

# Features and Target
X = df.drop("Attrition", axis=1)
y = df["Attrition"]

# Train Test Split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

# Model
model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)

# Prediction
y_pred = model.predict(X_test)

# Accuracy
accuracy = accuracy_score(y_test, y_pred)

print("\nAccuracy:")
print(f"{accuracy*100:.2f}%")

print("\nClassification Report:")
print(classification_report(y_test, y_pred))

print("\nProject Completed Successfully!")
plt.show()