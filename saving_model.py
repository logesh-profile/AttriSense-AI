import pandas as pd
import joblib
import os
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

# ── Load Dataset ────────────────────────────────────────────────────
df = pd.read_csv("dataset/datas.csv")

print("Dataset Shape:", df.shape)
print("\nAttrition Count:")
print(df["Attrition"].value_counts())

# ── Drop constant / ID columns ───────────────────────────────────────
DROP_COLS = ["EmployeeCount", "EmployeeNumber", "Over18", "StandardHours"]
df = df.drop(columns=DROP_COLS)
print("\nDropped constant/ID columns:", DROP_COLS)

# ── Detect text columns ───────────────────────────────────────────────
# Check dtype AND actual values — some CSVs show strings as dtype "str"
# instead of "object" depending on pandas version
TEXT_COLS = [
    col for col in df.columns
    if df[col].dtype == "object"
    or str(df[col].dtype) == "str"
    or df[col].apply(lambda x: isinstance(x, str)).any()
]
print("\nText columns detected for encoding:", TEXT_COLS)

# ── Encode — one LabelEncoder per column ────────────────────────────
encoders = {}
for col in TEXT_COLS:
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col].astype(str))
    encoders[col] = le

# Verify no string columns remain
remaining = [c for c in df.columns if df[c].dtype == "object"
             or df[c].apply(lambda x: isinstance(x, str)).any()]
if remaining:
    print(f"⚠️  Still has string columns after encoding: {remaining}")
else:
    print("✅ All columns are numeric — ready for model training")

# ── Features and Target ──────────────────────────────────────────────
X = df.drop("Attrition", axis=1)
y = df["Attrition"]

FEATURE_COLUMNS = list(X.columns)
print(f"\nFinal feature columns ({len(FEATURE_COLUMNS)}):")
print(FEATURE_COLUMNS)

# ── Train / Test Split ───────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ── Train Model ──────────────────────────────────────────────────────
model = RandomForestClassifier(
    n_estimators=100,
    random_state=42,
    class_weight="balanced"
)
model.fit(X_train, y_train)

# ── Evaluate ─────────────────────────────────────────────────────────
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"\nTest Accuracy: {accuracy * 100:.2f}%")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["No Attrition", "Attrition"]))

# ── Save Everything ──────────────────────────────────────────────────
os.makedirs("backend", exist_ok=True)

joblib.dump(model,           "backend/attrition_model.pkl")
joblib.dump(encoders,        "backend/encoders.pkl")
joblib.dump(FEATURE_COLUMNS, "backend/feature_columns.pkl")

print("\n✅ backend/attrition_model.pkl  — trained model")
print("✅ backend/encoders.pkl          — label encoders")
print("✅ backend/feature_columns.pkl   — feature order")
print("\nDone! Run backend/app.py to start Flask.")