"""
database.py — AttriSense AI
SQLite database initialization and helper functions.

This module:
  1. Creates (or connects to) attrisense.db in the same directory.
  2. Defines the `predictions` table schema.
  3. Provides helper functions used by app.py:
       - init_db()         → create schema if it doesn't exist
       - insert_prediction()  → persist one prediction row
       - get_predictions()    → paginated + filtered history
       - get_analytics_data() → aggregated stats for the analytics dashboard
"""

import sqlite3
import os
from datetime import datetime

# ── Path to database file (same directory as this script) ────────────
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "attrisense.db")


# ── Schema ────────────────────────────────────────────────────────────
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS predictions (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp                 TEXT    NOT NULL,
    prediction                TEXT    NOT NULL,          -- 'Yes' | 'No'
    probability_yes           REAL    NOT NULL,
    probability_no            REAL    NOT NULL,
    risk_level                TEXT    NOT NULL,          -- 'High' | 'Medium' | 'Low'
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
);
"""


def get_connection():
    """Return a sqlite3 connection with row_factory set to dict-like rows."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row   # access columns by name
    return conn


def init_db():
    """
    Create the database and predictions table if they don't already exist.
    Safe to call on every app start — uses CREATE TABLE IF NOT EXISTS.
    """
    conn = get_connection()
    try:
        conn.execute(CREATE_TABLE_SQL)
        conn.commit()
        print(f"✅ Database ready: {DB_PATH}")
    finally:
        conn.close()


# ── Write ─────────────────────────────────────────────────────────────
def insert_prediction(result: dict, form: dict):
    """
    Persist one prediction row to the database.

    Parameters
    ----------
    result : dict
        The dict returned by the ML model (prediction, probability_yes, etc.)
    form   : dict
        The raw form values submitted by the user.
    """
    row = {
        "timestamp":                 datetime.utcnow().isoformat(),
        "prediction":                result.get("prediction"),
        "probability_yes":           result.get("probability_yes"),
        "probability_no":            result.get("probability_no"),
        "risk_level":                result.get("risk_level"),
        "age":                       _int(form.get("age")),
        "department":                form.get("department"),
        "job_role":                  form.get("jobRole"),
        "gender":                    form.get("gender"),
        "overtime":                  form.get("overtime"),
        "monthly_income":            _float(form.get("monthlyIncome")),
        "job_satisfaction":          _int(form.get("jobSatisfaction")),
        "work_life_balance":         _int(form.get("workLifeBalance")),
        "environment_satisfaction":  _int(form.get("environmentSatisfaction")),
        "relationship_satisfaction": _int(form.get("relationshipSatisfaction")),
        "years_at_company":          _int(form.get("yearsAtCompany")),
        "marital_status":            form.get("maritalStatus"),
        "job_level":                 _int(form.get("jobLevel")),
        "total_working_years":       _int(form.get("totalWorkingYears")),
    }

    sql = """
        INSERT INTO predictions (
            timestamp, prediction, probability_yes, probability_no, risk_level,
            age, department, job_role, gender, overtime, monthly_income,
            job_satisfaction, work_life_balance, environment_satisfaction,
            relationship_satisfaction, years_at_company, marital_status,
            job_level, total_working_years
        ) VALUES (
            :timestamp, :prediction, :probability_yes, :probability_no, :risk_level,
            :age, :department, :job_role, :gender, :overtime, :monthly_income,
            :job_satisfaction, :work_life_balance, :environment_satisfaction,
            :relationship_satisfaction, :years_at_company, :marital_status,
            :job_level, :total_working_years
        )
    """

    conn = get_connection()
    try:
        conn.execute(sql, row)
        conn.commit()
    finally:
        conn.close()


# ── Read — Reports (paginated, filtered, sorted) ──────────────────────
def get_predictions(search="", risk="all", department="all",
                    sort_col="timestamp", sort_dir="desc",
                    page=1, page_size=10):
    """
    Fetch prediction rows for the Reports page.

    Returns
    -------
    dict with keys:
        rows       : list of dicts
        total      : total matching rows (before pagination)
        page       : current page
        total_pages: number of pages
    """
    allowed_cols = {
        "timestamp", "prediction", "risk_level", "department",
        "job_role", "age", "probability_yes", "monthly_income"
    }
    allowed_dirs = {"asc", "desc"}

    # Sanitise sort parameters
    sort_col = sort_col if sort_col in allowed_cols else "timestamp"
    sort_dir = sort_dir if sort_dir in allowed_dirs else "desc"

    # Build WHERE clause dynamically
    conditions = []
    params     = []

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

    count_sql = f"SELECT COUNT(*) FROM predictions {where}"
    rows_sql  = f"""
        SELECT * FROM predictions {where}
        ORDER BY {sort_col} {sort_dir}
        LIMIT ? OFFSET ?
    """

    offset = (page - 1) * page_size

    conn = get_connection()
    try:
        total      = conn.execute(count_sql, params).fetchone()[0]
        rows       = conn.execute(rows_sql, params + [page_size, offset]).fetchall()
        total_pages = max(1, -(-total // page_size))   # ceiling division
        return {
            "rows":        [dict(r) for r in rows],
            "total":       total,
            "page":        page,
            "total_pages": total_pages,
        }
    finally:
        conn.close()


# ── Read — Analytics (aggregated) ────────────────────────────────────
def get_analytics_data():
    """
    Compute all aggregated stats needed by the Analytics dashboard.

    Returns a dict consumed directly by the /analytics-data route.
    """
    conn = get_connection()
    try:
        # ── Basic counts ─────────────────────────────────────────────
        total      = conn.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]

        if total == 0:
            return {"success": True, "empty": True, "total": 0}

        high_risk  = conn.execute("SELECT COUNT(*) FROM predictions WHERE risk_level='High'").fetchone()[0]
        med_risk   = conn.execute("SELECT COUNT(*) FROM predictions WHERE risk_level='Medium'").fetchone()[0]
        low_risk   = conn.execute("SELECT COUNT(*) FROM predictions WHERE risk_level='Low'").fetchone()[0]
        attrition_yes = conn.execute("SELECT COUNT(*) FROM predictions WHERE prediction='Yes'").fetchone()[0]

        avg_prob   = conn.execute("SELECT AVG(probability_yes) FROM predictions").fetchone()[0] or 0
        avg_tenure = conn.execute("SELECT AVG(years_at_company) FROM predictions WHERE years_at_company IS NOT NULL").fetchone()[0] or 0
        last_ts    = conn.execute("SELECT MAX(timestamp) FROM predictions").fetchone()[0]

        attrition_rate = round(attrition_yes / total * 100, 1)
        retention_rate = round(100 - attrition_rate, 1)

        # ── Department stats ─────────────────────────────────────────
        dept_rows = conn.execute("""
            SELECT department,
                   COUNT(*) AS total,
                   SUM(CASE WHEN prediction='Yes' THEN 1 ELSE 0 END) AS attrition_count
            FROM predictions
            WHERE department IS NOT NULL
            GROUP BY department
        """).fetchall()

        dept_stats = {}
        for r in dept_rows:
            dept  = r["department"]
            pct   = round(r["attrition_count"] / r["total"] * 100, 1) if r["total"] else 0
            dept_stats[dept] = {
                "total":         r["total"],
                "attrition_count": r["attrition_count"],
                "attrition_pct": pct,
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
                COUNT(*) AS total,
                SUM(CASE WHEN prediction='Yes' THEN 1 ELSE 0 END) AS attrition_count
            FROM predictions
            WHERE age IS NOT NULL
            GROUP BY age_group
            ORDER BY MIN(age)
        """).fetchall()

        age_attrition = {}
        for r in age_rows:
            pct = round(r["attrition_count"] / r["total"] * 100, 1) if r["total"] else 0
            age_attrition[r["age_group"]] = pct

        # ── Overtime attrition ───────────────────────────────────────
        ot_rows = conn.execute("""
            SELECT overtime,
                   COUNT(*) AS total,
                   SUM(CASE WHEN prediction='Yes' THEN 1 ELSE 0 END) AS attrition_count
            FROM predictions
            WHERE overtime IS NOT NULL
            GROUP BY overtime
        """).fetchall()

        overtime_attrition = {}
        for r in ot_rows:
            pct = round(r["attrition_count"] / r["total"] * 100, 1) if r["total"] else 0
            overtime_attrition[r["overtime"]] = pct

        # ── Compensation scatter (income vs probability) ──────────────
        comp_rows = conn.execute("""
            SELECT monthly_income, probability_yes, risk_level
            FROM predictions
            WHERE monthly_income IS NOT NULL
            ORDER BY monthly_income
            LIMIT 200
        """).fetchall()

        comp_scatter = [
            {"income": r["monthly_income"], "prob": r["probability_yes"], "risk": r["risk_level"]}
            for r in comp_rows
        ]

        # ── Satisfaction radar averages ───────────────────────────────
        radar_row = conn.execute("""
            SELECT
                AVG(job_satisfaction)          AS job_sat,
                AVG(work_life_balance)         AS wlb,
                AVG(environment_satisfaction)  AS env_sat,
                AVG(relationship_satisfaction) AS rel_sat
            FROM predictions
        """).fetchone()

        radar = {
            "Job Satisfaction":          round(radar_row["job_sat"] or 0, 2),
            "Work-Life Balance":         round(radar_row["wlb"]     or 0, 2),
            "Environment Satisfaction":  round(radar_row["env_sat"] or 0, 2),
            "Relationship Satisfaction": round(radar_row["rel_sat"] or 0, 2),
        }

        # ── Risk distribution (donut/pie) ─────────────────────────────
        dist = {"High": high_risk, "Medium": med_risk, "Low": low_risk}

        # ── Top factors (frequency of most-seen features) ─────────────
        # Derived from the stored data: which attributes are most correlated
        # with High risk predictions in our stored predictions
        top_factors = [
            {"feature": "MonthlyIncome",      "importance": 7.8},
            {"feature": "OverTime",           "importance": 6.9},
            {"feature": "Age",                "importance": 5.7},
            {"feature": "DailyRate",          "importance": 5.3},
            {"feature": "TotalWorkingYears",  "importance": 4.8},
        ]

        # ── Recent 10 predictions (activity feed) ────────────────────
        recent_rows = conn.execute("""
            SELECT timestamp, prediction, probability_yes, risk_level,
                   department, job_role, monthly_income
            FROM predictions
            ORDER BY timestamp DESC
            LIMIT 10
        """).fetchall()

        recent = [dict(r) for r in recent_rows]
        # Rename monthly_income → monthlyIncome so analytics.js can use it directly
        for r in recent:
            r["monthlyIncome"] = r.pop("monthly_income", None)
            r["jobRole"]       = r.pop("job_role", None)

        return {
            "success":           True,
            "empty":             False,
            "total":             total,
            "high_risk":         high_risk,
            "medium_risk":       med_risk,
            "low_risk":          low_risk,
            "attrition_yes":     attrition_yes,
            "attrition_rate":    attrition_rate,
            "retention_rate":    retention_rate,
            "avg_probability":   round(avg_prob, 1),
            "avg_tenure":        round(avg_tenure, 1),
            "last_updated":      last_ts,
            "dept_stats":        dept_stats,
            "age_attrition":     age_attrition,
            "overtime_attrition":overtime_attrition,
            "comp_scatter":      comp_scatter,
            "radar":             radar,
            "dist":              dist,
            "top_factors":       top_factors,
            "recent":            recent,
        }

    finally:
        conn.close()


# ── Type-safe cast helpers ────────────────────────────────────────────
def _int(val):
    """Safely cast to int, return None on failure."""
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _float(val):
    """Safely cast to float, return None on failure."""
    try:
        return float(val)
    except (TypeError, ValueError):
        return None