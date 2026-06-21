"""
app.py — AttriSense AI
Flask backend: ML prediction, SQLite storage, analytics API, reports API.

Key routes
──────────
POST /predict          run model → store in SQLite → return JSON
GET  /analytics-data   aggregate all KPIs from SQLite for analytics.js
GET  /api/analytics    alias for /analytics-data
GET  /api/predictions  paginated + filtered prediction history (reports.js)
GET  /api/reports      alias for /api/predictions
GET  /model-info       model metadata
GET  /*                static file fallback
"""

import os
import sqlite3
import joblib
import pandas as pd
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ── App Setup ─────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
DB_PATH      = os.path.join(BASE_DIR, "attrisense.db")

app = Flask(__name__, template_folder=FRONTEND_DIR, static_folder=FRONTEND_DIR)
CORS(app)

# ── Database ──────────────────────────────────────────────────────────

def get_db():
    """Return a Row-factory SQLite connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create the predictions table if it doesn't already exist."""
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id                        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp                 TEXT    NOT NULL,
            prediction                TEXT    NOT NULL,
            probability_yes           REAL    NOT NULL,
            probability_no            REAL    NOT NULL,
            risk_level                TEXT    NOT NULL,
            age                       INTEGER,
            department                TEXT,
            job_role                  TEXT,
            gender                    TEXT,
            overtime                  TEXT,
            monthly_income            REAL,
            job_satisfaction          INTEGER,
            work_life_balance         INTEGER,
            environment_satisfaction  INTEGER,
            relationship_satisfaction INTEGER,
            years_at_company          INTEGER,
            marital_status            TEXT,
            job_level                 INTEGER,
            total_working_years       INTEGER
        )
    """)
    conn.commit()
    conn.close()
    print(f"✅ Database ready: {DB_PATH}")


init_db()

# ── Load ML Artifacts ─────────────────────────────────────────────────
MODEL_PATH    = os.path.join(BASE_DIR, "attrition_model.pkl")
ENCODERS_PATH = os.path.join(BASE_DIR, "encoders.pkl")
COLUMNS_PATH  = os.path.join(BASE_DIR, "feature_columns.pkl")

try:
    model           = joblib.load(MODEL_PATH)
    encoders        = joblib.load(ENCODERS_PATH)
    feature_columns = joblib.load(COLUMNS_PATH)
    print("✅ Model loaded successfully")
    print(f"   Features : {feature_columns}")
    print(f"   Encoders : {list(encoders.keys())}")
except FileNotFoundError as e:
    print(f"❌ Could not load model: {e}")
    model = encoders = feature_columns = None


# ── ML helpers ────────────────────────────────────────────────────────

def encode_value(column, value):
    """Use saved LabelEncoder for text columns, else cast to float."""
    if column in encoders:
        le = encoders[column]
        if value not in le.classes_:
            raise ValueError(
                f"Unknown value '{value}' for '{column}'. "
                f"Allowed: {list(le.classes_)}"
            )
        return int(le.transform([value])[0])
    return float(value)


def build_feature_row(form):
    """
    Map submitted form fields → the exact feature columns the model
    was trained on, encoding text columns via saved LabelEncoders.
    """
    form_map = {
        # ── Section A: Personal ─────────────────
        "Age":                     form.get("age"),
        "Gender":                  form.get("gender"),
        "MaritalStatus":           form.get("maritalStatus"),
        "DistanceFromHome":        form.get("distanceFromHome"),
        # ── Section B: Professional ─────────────
        "Department":              form.get("department"),
        "JobRole":                 form.get("jobRole"),
        "JobLevel":                form.get("jobLevel"),
        "TotalWorkingYears":       form.get("totalWorkingYears"),
        # ── Section C: Compensation ─────────────
        "MonthlyIncome":           form.get("monthlyIncome"),
        "PercentSalaryHike":       form.get("percentSalaryHike"),
        "StockOptionLevel":        form.get("stockOptionLevel"),
        # ── Section D: Work Environment ─────────
        "OverTime":                form.get("overtime"),
        "WorkLifeBalance":         form.get("workLifeBalance"),
        "EnvironmentSatisfaction": form.get("environmentSatisfaction"),
        "JobSatisfaction":         form.get("jobSatisfaction"),
        # ── Dataset defaults (not shown in form) ─
        "BusinessTravel":           form.get("businessTravel",            "Travel_Rarely"),
        "DailyRate":                form.get("dailyRate",                 "800"),
        "Education":                form.get("education",                 "3"),
        "EducationField":           form.get("educationField",            "Life Sciences"),
        "HourlyRate":               form.get("hourlyRate",                "65"),
        "JobInvolvement":           form.get("jobInvolvement",            "3"),
        "MonthlyRate":              form.get("monthlyRate",               "14000"),
        "NumCompaniesWorked":       form.get("numCompaniesWorked",        "2"),
        "PerformanceRating":        form.get("performanceRating",         "3"),
        "RelationshipSatisfaction": form.get("relationshipSatisfaction",  "3"),
        "TrainingTimesLastYear":    form.get("trainingTimesLastYear",     "3"),
        "YearsAtCompany":           form.get("yearsAtCompany",            "5"),
        "YearsInCurrentRole":       form.get("yearsInCurrentRole",        "3"),
        "YearsSinceLastPromotion":  form.get("yearsSinceLastPromotion",   "1"),
        "YearsWithCurrManager":     form.get("yearsWithCurrManager",      "3"),
    }
    row = {}
    for col in feature_columns:
        raw = form_map.get(col)
        if raw is None:
            raise ValueError(f"No value provided for column: '{col}'")
        row[col] = encode_value(col, str(raw).strip())
    return pd.DataFrame([row], columns=feature_columns)


# ── Safe cast helpers ─────────────────────────────────────────────────

def _int(v):
    try:    return int(v)
    except: return None

def _float(v):
    try:    return float(v)
    except: return None


# ── Static routes ─────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/predict.html")
def predict_page():
    return send_from_directory(FRONTEND_DIR, "predict.html")

@app.route("/analytics.html")
def analytics_page():
    return send_from_directory(FRONTEND_DIR, "analytics.html")

@app.route("/reports.html")
def reports_page():
    return send_from_directory(FRONTEND_DIR, "reports.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


# ── POST /predict ─────────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
def predict():
    """Run the ML model, persist result to SQLite, return JSON to frontend."""
    if model is None:
        return jsonify({"success": False,
                        "error": "Model not loaded. Run saving_model.py first."}), 500
    try:
        form = request.get_json() if request.is_json else request.form

        print("\n── Incoming form data ──")
        for k, v in form.items():
            print(f"   {k}: {v}")

        X_input       = build_feature_row(form)
        prediction    = model.predict(X_input)[0]
        probabilities = model.predict_proba(X_input)[0]

        # Decode label
        if "Attrition" in encoders:
            attrition_label = encoders["Attrition"].inverse_transform([prediction])[0]
        else:
            attrition_label = "Yes" if prediction == 1 else "No"

        prob_yes   = round(float(probabilities[1]) * 100, 1)
        prob_no    = round(float(probabilities[0]) * 100, 1)
        risk_level = "High" if prob_yes >= 70 else "Medium" if prob_yes >= 40 else "Low"

        importances = model.feature_importances_
        top_factors = sorted(
            [{"feature": f, "importance": round(float(i) * 100, 1)}
             for f, i in zip(feature_columns, importances)],
            key=lambda x: x["importance"], reverse=True
        )[:5]

        result = {
            "success":         True,
            "prediction":      attrition_label,
            "probability_yes": prob_yes,
            "probability_no":  prob_no,
            "risk_level":      risk_level,
            "top_factors":     top_factors,
            "model_type":      type(model).__name__,
        }

        # ── Persist to SQLite ─────────────────────────────────────────
        conn = get_db()
        conn.execute("""
            INSERT INTO predictions (
                timestamp, prediction, probability_yes, probability_no, risk_level,
                age, department, job_role, gender, overtime, monthly_income,
                job_satisfaction, work_life_balance, environment_satisfaction,
                relationship_satisfaction, years_at_company, marital_status,
                job_level, total_working_years
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            datetime.utcnow().isoformat(),
            attrition_label, prob_yes, prob_no, risk_level,
            _int(form.get("age")),
            form.get("department"),
            form.get("jobRole"),
            form.get("gender"),
            form.get("overtime"),
            _float(form.get("monthlyIncome")),
            _int(form.get("jobSatisfaction")),
            _int(form.get("workLifeBalance")),
            _int(form.get("environmentSatisfaction")),
            _int(form.get("relationshipSatisfaction")),
            _int(form.get("yearsAtCompany")),
            form.get("maritalStatus"),
            _int(form.get("jobLevel")),
            _int(form.get("totalWorkingYears")),
        ))
        conn.commit()
        conn.close()

        print(f"   Prediction  : {attrition_label}")
        print(f"   Probability : {prob_yes}%")
        print(f"   Risk Level  : {risk_level}")
        print(f"   Stored in   : attrisense.db ✅")

        return jsonify(result), 200

    except ValueError as ve:
        print(f"❌ ValueError: {ve}")
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception:
        import traceback; traceback.print_exc()
        return jsonify({"success": False, "error": "Internal server error"}), 500


# ── GET /analytics-data ───────────────────────────────────────────────

@app.route("/analytics-data")
@app.route("/api/analytics")
def analytics_data():
    """
    Compute every KPI analytics.js needs from the predictions table.

    Returned keys (all consumed by analytics.js renderDashboard):
        success, empty, total
        attrition_rate, retention_rate, avg_probability, avg_tenure
        high_risk, medium_risk, low_risk
        dist               { "High": N, "Medium": N, "Low": N }
        dept_stats         { dept: { total, attrition_count, attrition_pct } }
        age_attrition      { "<25": pct, "25-34": pct, ... }
        overtime_attrition { "Yes": pct, "No": pct }
        comp_scatter       [ { income, prob, risk }, ... ]
        radar              { "Job Satisfaction": avg, ... }
        top_factors        [ { feature, importance }, ... ]
        recent             [ last 10 rows as dicts with jobRole + monthlyIncome keys ]
        last_updated       ISO timestamp of newest record
    """
    try:
        conn  = get_db()
        total = conn.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]

        if total == 0:
            conn.close()
            return jsonify({"success": True, "empty": True, "total": 0}), 200

        # ── Basic KPIs ────────────────────────────────────────────────
        yes_count  = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE prediction='Yes'").fetchone()[0]
        high_risk  = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE risk_level='High'").fetchone()[0]
        med_risk   = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE risk_level='Medium'").fetchone()[0]
        low_risk   = conn.execute(
            "SELECT COUNT(*) FROM predictions WHERE risk_level='Low'").fetchone()[0]

        avg_prob   = conn.execute(
            "SELECT AVG(probability_yes) FROM predictions").fetchone()[0] or 0
        avg_tenure = conn.execute(
            "SELECT AVG(total_working_years) FROM predictions "
            "WHERE total_working_years IS NOT NULL").fetchone()[0] or 0
        last_ts    = conn.execute(
            "SELECT MAX(timestamp) FROM predictions").fetchone()[0]

        attrition_rate = round(yes_count / total * 100, 1)
        retention_rate = round(100 - attrition_rate, 1)

        # ── Risk distribution (for donut / insights) ──────────────────
        dist = {"High": high_risk, "Medium": med_risk, "Low": low_risk}

        # ── Department stats ──────────────────────────────────────────
        dept_rows  = conn.execute("""
            SELECT
                department,
                COUNT(*)                                             AS total,
                SUM(CASE WHEN prediction='Yes' THEN 1 ELSE 0 END)  AS attrition_count
            FROM predictions
            WHERE department IS NOT NULL
            GROUP BY department
        """).fetchall()

        dept_stats = {}
        for r in dept_rows:
            pct = round(r["attrition_count"] / r["total"] * 100, 1) if r["total"] else 0
            dept_stats[r["department"]] = {
                "total":           r["total"],
                "attrition_count": r["attrition_count"],
                "attrition_pct":   pct,
            }

        # ── Age-group attrition ───────────────────────────────────────
        age_rows = conn.execute("""
            SELECT
                CASE
                    WHEN age < 25 THEN '<25'
                    WHEN age < 35 THEN '25-34'
                    WHEN age < 45 THEN '35-44'
                    WHEN age < 55 THEN '45-54'
                    ELSE '55+'
                END AS age_group,
                COUNT(*)                                            AS total,
                SUM(CASE WHEN prediction='Yes' THEN 1 ELSE 0 END) AS attrition_count,
                MIN(age)                                            AS min_age
            FROM predictions
            WHERE age IS NOT NULL
            GROUP BY age_group
            ORDER BY min_age
        """).fetchall()

        age_attrition = {}
        for r in age_rows:
            pct = round(r["attrition_count"] / r["total"] * 100, 1) if r["total"] else 0
            age_attrition[r["age_group"]] = pct

        # ── Overtime attrition ────────────────────────────────────────
        ot_rows = conn.execute("""
            SELECT
                overtime,
                COUNT(*)                                            AS total,
                SUM(CASE WHEN prediction='Yes' THEN 1 ELSE 0 END) AS attrition_count
            FROM predictions
            WHERE overtime IS NOT NULL
            GROUP BY overtime
        """).fetchall()

        overtime_attrition = {}
        for r in ot_rows:
            pct = round(r["attrition_count"] / r["total"] * 100, 1) if r["total"] else 0
            overtime_attrition[r["overtime"]] = pct

        # ── Compensation scatter ──────────────────────────────────────
        # Keys: income (raw $), prob (%), risk — matches analytics.js mapping
        comp_rows = conn.execute("""
            SELECT monthly_income AS income,
                   probability_yes AS prob,
                   risk_level AS risk
            FROM predictions
            WHERE monthly_income IS NOT NULL
            ORDER BY monthly_income
            LIMIT 300
        """).fetchall()

        comp_scatter = [
            {
                "income": r["income"],
                "prob":   r["prob"],
                "risk":   r["risk"],
            }
            for r in comp_rows
        ]

        # ── Satisfaction radar — averages per dimension ───────────────
        sat_row = conn.execute("""
            SELECT
                AVG(job_satisfaction)          AS job_sat,
                AVG(work_life_balance)         AS wlb,
                AVG(environment_satisfaction)  AS env_sat,
                AVG(relationship_satisfaction) AS rel_sat
            FROM predictions
        """).fetchone()

        radar = {
            "Job Satisfaction":          round(sat_row["job_sat"] or 0, 2),
            "Work-Life Balance":         round(sat_row["wlb"]     or 0, 2),
            "Environment Satisfaction":  round(sat_row["env_sat"] or 0, 2),
            "Relationship Satisfaction": round(sat_row["rel_sat"] or 0, 2),
        }

        # ── Top risk factors ──────────────────────────────────────────
        # Use the global model feature importances (same for every prediction).
        # If the model isn't loaded fall back to an empty list.
        if model is not None and feature_columns is not None:
            importances = model.feature_importances_
            top_factors = sorted(
                [{"feature": f, "importance": round(float(i) * 100, 1)}
                 for f, i in zip(feature_columns, importances)],
                key=lambda x: x["importance"], reverse=True
            )[:6]   # top 6 as required
        else:
            top_factors = []

        # ── Recent 10 predictions (activity feed) ────────────────────
        # Rename DB columns to match the keys analytics.js expects:
        #   job_role → jobRole,  monthly_income → monthlyIncome
        recent_rows = conn.execute("""
            SELECT
                timestamp,
                prediction,
                probability_yes,
                risk_level,
                department,
                job_role        AS jobRole,
                monthly_income  AS monthlyIncome
            FROM predictions
            ORDER BY timestamp DESC
            LIMIT 10
        """).fetchall()

        recent = [dict(r) for r in recent_rows]

        conn.close()

        return jsonify({
            "success":           True,
            "empty":             False,
            "total":             total,
            "attrition_rate":    attrition_rate,
            "retention_rate":    retention_rate,
            "avg_probability":   round(avg_prob, 1),
            "avg_tenure":        round(avg_tenure, 1),
            "high_risk":         high_risk,
            "medium_risk":       med_risk,
            "low_risk":          low_risk,
            "dist":              dist,
            "dept_stats":        dept_stats,
            "age_attrition":     age_attrition,
            "overtime_attrition":overtime_attrition,
            "comp_scatter":      comp_scatter,
            "radar":             radar,
            "top_factors":       top_factors,
            "recent":            recent,
            "last_updated":      last_ts,
        }), 200

    except Exception:
        import traceback; traceback.print_exc()
        return jsonify({"success": False, "error": "Failed to load analytics"}), 500


# ── GET /api/predictions  (Reports page) ─────────────────────────────

@app.route("/api/predictions")
@app.route("/api/reports")
def api_predictions():
    """
    Return paginated, filtered, sorted prediction history for reports.js.

    Query params
    ────────────
    search      free-text (matches department, job_role, risk_level)
    risk        High | Medium | Low | all
    department  exact string | all
    sort_col    timestamp | department | risk_level | job_role |
                probability_yes  (default: timestamp)
    sort_dir    asc | desc  (default: desc)
    page        1-based page number (default: 1)
    page_size   rows per page, max 50 (default: 10)
    """
    try:
        search     = request.args.get("search",     "").strip()
        risk       = request.args.get("risk",       "all")
        department = request.args.get("department", "all")
        sort_dir   = request.args.get("sort_dir",   "desc").lower()
        page       = max(1, int(request.args.get("page",      1)))
        page_size  = min(50, max(1, int(request.args.get("page_size", 10))))

        # Whitelist sort columns
        allowed_cols = {
            "timestamp", "department", "risk_level",
            "job_role", "probability_yes", "age", "monthly_income",
        }
        sort_col = request.args.get("sort_col", "timestamp")
        if sort_col not in allowed_cols:
            sort_col = "timestamp"
        if sort_dir not in ("asc", "desc"):
            sort_dir = "desc"

        # Build WHERE clause
        conditions, params = [], []
        if search:
            like = f"%{search.lower()}%"
            conditions.append(
                "(LOWER(department) LIKE ? OR LOWER(job_role) LIKE ? OR LOWER(risk_level) LIKE ?)"
            )
            params += [like, like, like]
        if risk != "all":
            conditions.append("risk_level = ?")
            params.append(risk)
        if department != "all":
            conditions.append("department = ?")
            params.append(department)

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        conn  = get_db()
        total = conn.execute(
            f"SELECT COUNT(*) FROM predictions {where}", params
        ).fetchone()[0]

        total_pages = max(1, -(-total // page_size))
        page        = min(page, total_pages)
        offset      = (page - 1) * page_size

        rows = conn.execute(
            f"""
            SELECT * FROM predictions {where}
            ORDER BY {sort_col} {sort_dir}
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset]
        ).fetchall()

        conn.close()

        return jsonify({
            "success":     True,
            "total":       total,
            "page":        page,
            "total_pages": total_pages,
            "rows":        [dict(r) for r in rows],
        }), 200

    except Exception:
        import traceback; traceback.print_exc()
        return jsonify({"success": False, "error": "Failed to load predictions"}), 500


# ── GET /model-info ───────────────────────────────────────────────────

@app.route("/model-info")
def model_info():
    if model is None:
        return jsonify({"loaded": False}), 500
    return jsonify({
        "loaded":          True,
        "model_type":      type(model).__name__,
        "feature_count":   len(feature_columns),
        "feature_columns": feature_columns,
        "encoder_columns": list(encoders.keys()),
        "encoder_classes": {k: list(v.classes_) for k, v in encoders.items()},
    })


# ── Run ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "═" * 50)
    print("  AttriSense AI — Flask Backend (SQLite)")
    print("═" * 50)
    app.run(debug=True, host="0.0.0.0", port=5000)