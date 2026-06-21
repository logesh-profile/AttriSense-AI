/* =====================================================================
   ATTRISENSE AI — analytics.js  (100% database-driven)
   Every value, chart, insight, recommendation, risk factor, and
   activity entry is derived from /analytics-data (SQLite).
   No hardcoded data anywhere.
   ===================================================================== */

'use strict';

/* ─────────────────────────────────────────────────────────────────────
   0. Chart.js global defaults
   ───────────────────────────────────────────────────────────────────── */
const C = {
  white:   'rgba(255,255,255,0.80)',
  dim:     'rgba(255,255,255,0.20)',
  grid:    'rgba(255,255,255,0.06)',
  border:  '#1f1f1f',
  high:    '#ff4444',
  med:     '#ff9500',
  low:     '#30d158',
  mono:    "'JetBrains Mono', monospace",
  display: "'Bricolage Grotesque', sans-serif",
};

Chart.defaults.color               = C.dim;
Chart.defaults.borderColor         = C.grid;
Chart.defaults.font.family         = C.mono;
Chart.defaults.font.size           = 11;
Chart.defaults.animation.duration  = 900;

/* Store chart instances so we can destroy & re-render on refresh */
const chartInstances = {};

/* ─────────────────────────────────────────────────────────────────────
   1. API service — single fetch point
   ───────────────────────────────────────────────────────────────────── */
async function fetchAnalyticsData() {
  try {
    const res = await fetch('/analytics-data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch analytics data:', err);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   2. Empty state
   ───────────────────────────────────────────────────────────────────── */
function showEmptyState() {
  document.querySelectorAll('.metric-card__value').forEach(el => {
    el.textContent = '—';
  });
  if (!document.getElementById('emptyBanner')) {
    const banner = document.createElement('div');
    banner.id = 'emptyBanner';
    banner.style.cssText = `
      background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
      border-radius:10px;padding:32px;text-align:center;
      color:rgba(255,255,255,0.30);font-family:'JetBrains Mono',monospace;
      font-size:13px;letter-spacing:0.04em;margin-bottom:24px;
    `;
    banner.innerHTML = `
      <div style="font-size:28px;margin-bottom:12px;opacity:0.4">⬡</div>
      <div style="color:rgba(255,255,255,0.60);font-family:'Bricolage Grotesque',sans-serif;font-size:17px;font-weight:600;margin-bottom:8px;">No predictions yet</div>
      <div>Run employee predictions on the <a href="predict.html" style="color:rgba(255,255,255,0.50);text-decoration:underline;">Prediction page</a> — analytics will update automatically.</div>
    `;
    const chartsSection = document.querySelector('.charts-section');
    if (chartsSection) chartsSection.prepend(banner);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   3. Metric cards
   ───────────────────────────────────────────────────────────────────── */
function renderMetrics(data) {
  const metrics = [
    { selector: '[data-metric="total"]',     value: data.total,          decimals: 0, suffix: '' },
    { selector: '[data-metric="attrition"]', value: data.attrition_rate, decimals: 1, suffix: '%' },
    { selector: '[data-metric="retention"]', value: data.retention_rate, decimals: 1, suffix: '%' },
    { selector: '[data-metric="tenure"]',    value: data.avg_tenure,     decimals: 1, suffix: ' yrs' },
  ];
  metrics.forEach(({ selector, value, decimals, suffix }) => {
    const el = document.querySelector(selector);
    if (!el) return;
    animateCounter(el, value ?? 0, decimals, suffix);
  });
}

/* ─────────────────────────────────────────────────────────────────────
   4. Animated counter
   ───────────────────────────────────────────────────────────────────── */
function animateCounter(el, target, decimals, suffix, duration = 1200) {
  const start   = performance.now();
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = (target * easeOut(p)).toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ─────────────────────────────────────────────────────────────────────
   5. Tooltip helper
   ───────────────────────────────────────────────────────────────────── */
function tip() {
  return {
    backgroundColor: '#111',
    borderColor:     C.border,
    borderWidth:     1,
    titleColor:      C.white,
    bodyColor:       C.dim,
    padding:         10,
    cornerRadius:    6,
    displayColors:   true,
    boxPadding:      4,
    titleFont:       { family: C.display, weight: '600', size: 13 },
    bodyFont:        { family: C.mono, size: 11 },
  };
}

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

/* ─────────────────────────────────────────────────────────────────────
   6a. Department Risk — Horizontal Bar
   ───────────────────────────────────────────────────────────────────── */
function renderChartDeptRisk(deptStats) {
  const ctx = document.getElementById('chartDeptRisk');
  if (!ctx) return;
  destroyChart('deptRisk');

  const depts  = Object.keys(deptStats);
  const rates  = depts.map(d => deptStats[d].attrition_pct);
  const colors = rates.map(r => r >= 25 ? C.high : r >= 15 ? C.med : 'rgba(255,255,255,0.30)');

  if (depts.length === 0) { renderPlaceholder(ctx, 'No department data yet'); return; }

  chartInstances['deptRisk'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels:   depts,
      datasets: [{ label: 'Attrition Rate (%)', data: rates, backgroundColor: colors,
                   borderColor: 'transparent', borderRadius: 4, borderSkipped: false, barThickness: 22 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { label: c => ` ${c.parsed.x}% attrition` } } },
      scales: {
        x: { grid: { color: C.grid, drawBorder: false }, ticks: { color: C.dim, callback: v => v + '%' }, max: Math.max(...rates, 30) + 5 },
        y: { grid: { display: false }, ticks: { color: C.white } },
      },
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────
   6b. Age Group Attrition — Line
   ───────────────────────────────────────────────────────────────────── */
function renderChartAgeGroup(ageAttrition) {
  const ctx = document.getElementById('chartAgeGroup');
  if (!ctx) return;
  destroyChart('ageGroup');

  const labels = Object.keys(ageAttrition);
  const values = Object.values(ageAttrition);

  if (labels.length === 0) { renderPlaceholder(ctx, 'No age data yet'); return; }

  chartInstances['ageGroup'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Attrition Rate (%)', data: values,
        borderColor: 'rgba(255,255,255,0.70)', backgroundColor: 'rgba(255,255,255,0.04)',
        pointBackgroundColor: 'rgba(255,255,255,0.80)', pointBorderColor: '#000',
        pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 7, tension: 0.4, fill: true,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { label: c => ` ${c.parsed.y}% attrition` } } },
      scales: {
        x: { grid: { color: C.grid, drawBorder: false }, ticks: { color: C.dim } },
        y: { grid: { color: C.grid, drawBorder: false }, ticks: { color: C.dim, callback: v => v + '%' } },
      },
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────
   6c. Overtime Impact — Bar
   ───────────────────────────────────────────────────────────────────── */
function renderChartOvertime(overtimeAttrition) {
  const ctx = document.getElementById('chartOvertime');
  if (!ctx) return;
  destroyChart('overtime');

  const otYes = overtimeAttrition['Yes'] ?? 0;
  const otNo  = overtimeAttrition['No']  ?? 0;

  chartInstances['overtime'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels:   ['With Overtime', 'No Overtime'],
      datasets: [{ label: 'Attrition Rate (%)', data: [otYes, otNo],
                   backgroundColor: [C.high, 'rgba(255,255,255,0.25)'],
                   borderRadius: 5, borderSkipped: false, barThickness: 40 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { label: c => ` ${c.parsed.y}% attrition` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: C.white } },
        y: { grid: { color: C.grid, drawBorder: false }, ticks: { color: C.dim, callback: v => v + '%' }, max: Math.max(otYes, otNo, 10) + 10 },
      },
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────
   6d. Compensation vs Attrition — Scatter
   Backend sends: { income, prob, risk }  → Chart.js needs { x, y }
   ───────────────────────────────────────────────────────────────────── */
function renderChartCompensation(compScatter) {
  const ctx = document.getElementById('chartCompensation');
  if (!ctx) return;
  destroyChart('compensation');

  if (!compScatter || compScatter.length === 0) {
    renderPlaceholder(ctx, 'No compensation data yet'); return;
  }

  /* Map backend shape → Chart.js shape */
  const points = compScatter.map(p => ({
    x:    p.income != null ? p.income / 1000 : (p.x ?? 0),   // convert to $k
    y:    p.prob   != null ? p.prob           : (p.y ?? 0),
    risk: p.risk   ?? 'Low',
  }));

  const pointColors = points.map(p =>
    p.risk === 'High' ? C.high : p.risk === 'Medium' ? C.med : 'rgba(255,255,255,0.50)'
  );

  chartInstances['compensation'] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Employee', data: points, backgroundColor: pointColors,
        pointRadius: 5, pointHoverRadius: 7, pointBorderColor: 'transparent',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...tip(), callbacks: { label: c => ` $${c.parsed.x.toFixed(1)}k/mo  →  ${c.parsed.y.toFixed(1)}% risk` } },
      },
      scales: {
        x: {
          grid: { color: C.grid, drawBorder: false },
          ticks: { color: C.dim, callback: v => '$' + v + 'k' },
          title: { display: true, text: 'Monthly Income (USD)', color: C.dim, font: { size: 10 } },
        },
        y: {
          grid: { color: C.grid, drawBorder: false },
          ticks: { color: C.dim, callback: v => v + '%' },
          title: { display: true, text: 'Attrition Probability (%)', color: C.dim, font: { size: 10 } },
        },
      },
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────
   6e. Satisfaction Radar
   ───────────────────────────────────────────────────────────────────── */
function renderChartSatisfaction(radar) {
  const ctx = document.getElementById('chartSatisfaction');
  if (!ctx) return;
  destroyChart('satisfaction');

  const labels = Object.keys(radar);
  const values = Object.values(radar);
  if (labels.length === 0) { renderPlaceholder(ctx, 'No satisfaction data yet'); return; }

  chartInstances['satisfaction'] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Score (1–4)', data: values,
        borderColor: 'rgba(255,255,255,0.70)', backgroundColor: 'rgba(255,255,255,0.06)',
        pointBackgroundColor: 'rgba(255,255,255,0.80)', pointRadius: 4, borderWidth: 1.5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tip() },
      scales: {
        r: { min: 0, max: 4, ticks: { stepSize: 1, display: false },
             grid: { color: C.grid }, angleLines: { color: C.grid },
             pointLabels: { color: C.dim, font: { size: 10 } } },
      },
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────
   6f. Workforce Distribution Donut — grouped by department
   Backend sends `dist` as { "Human Resources": 4, "Sales": 2, … }
   ───────────────────────────────────────────────────────────────────── */
function renderChartDistribution(dist) {
  const ctx = document.getElementById('chartDistribution');
  if (!ctx) return;
  destroyChart('distribution');

  const labels = Object.keys(dist);
  const values = Object.values(dist);
  if (labels.length === 0) { renderPlaceholder(ctx, 'No distribution data yet'); return; }

  const shades = [
    'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.65)',
    'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.30)',
    'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.10)',
  ];

  chartInstances['distribution'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values, backgroundColor: shades.slice(0, labels.length),
        borderColor: '#000', borderWidth: 3, hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: {
        legend: { display: true, position: 'right',
                  labels: { color: C.dim, boxWidth: 10, padding: 12, font: { size: 10 } } },
        tooltip: { ...tip(), callbacks: { label: c => ` ${c.label}: ${c.parsed} employees` } },
      },
      animation: { animateRotate: true, duration: 1000 },
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────
   7. Placeholder for empty charts
   ───────────────────────────────────────────────────────────────────── */
function renderPlaceholder(canvas, message) {
  const parent = canvas.parentElement;
  canvas.style.display = 'none';
  if (!parent.querySelector('.chart-placeholder')) {
    const ph = document.createElement('div');
    ph.className = 'chart-placeholder';
    ph.style.cssText = `
      display:flex;align-items:center;justify-content:center;
      height:100%;color:rgba(255,255,255,0.20);
      font-family:'JetBrains Mono',monospace;font-size:11px;
      letter-spacing:0.06em;text-transform:uppercase;
    `;
    ph.textContent = message;
    parent.appendChild(ph);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   8. Top Risk Factors — top 6, fully database-driven
   ───────────────────────────────────────────────────────────────────── */
function renderRiskFactors(topFactors) {
  const list = document.querySelector('.risk-list');
  if (!list) return;

  if (!topFactors || topFactors.length === 0) {
    list.innerHTML = `<li style="color:rgba(255,255,255,0.25);font-size:12px;padding:16px 0;text-align:center;">
      No factor data yet — run predictions to populate.
    </li>`;
    return;
  }

  /* Show top 6 (requirement), sorted descending by importance */
  const factors = [...topFactors]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 6);

  const maxPct = factors[0].importance;

  list.innerHTML = '';

  factors.forEach((f, i) => {
    const pct    = f.importance;
    const barPct = maxPct > 0 ? (pct / maxPct) * 100 : 0;
    const rank   = String(i + 1).padStart(2, '0');

    const li = document.createElement('li');
    li.className = 'risk-item';
    li.innerHTML = `
      <div class="risk-item__meta">
        <span class="risk-item__rank" aria-hidden="true">${rank}</span>
        <span class="risk-item__name">${f.feature.replace(/([A-Z])/g, ' $1').trim()}</span>
        <span class="risk-item__pct">${pct}%</span>
      </div>
      <div class="risk-item__bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100">
        <div class="risk-item__fill" style="width:0" data-target="${barPct}"></div>
      </div>
    `;
    list.appendChild(li);
  });

  /* Animate bars */
  setTimeout(() => {
    list.querySelectorAll('.risk-item__fill').forEach(fill => {
      fill.style.transition = 'width 1s cubic-bezier(0.16, 1, 0.3, 1)';
      fill.style.width      = fill.dataset.target + '%';
    });
  }, 150);
}

/* ─────────────────────────────────────────────────────────────────────
   9. AI Insights — 4 cards, all derived from real data
   ───────────────────────────────────────────────────────────────────── */
function renderInsights(data) {
  const grid = document.querySelector('.insights-grid');
  if (!grid) return;

  const insights = [];

  /* ── Insight 1: Highest-risk department ───────────────────────────── */
  const deptStats = data.dept_stats || {};
  const depts     = Object.entries(deptStats).sort((a, b) => b[1].attrition_pct - a[1].attrition_pct);
  if (depts.length > 0) {
    const [dept, stats] = depts[0];
    const sev = stats.attrition_pct >= 25 ? 'high' : stats.attrition_pct >= 15 ? 'med' : 'low';
    insights.push({
      icon: 'fa-triangle-exclamation',
      severity: sev,
      severityLabel: sev === 'high' ? 'High Priority' : sev === 'med' ? 'Medium Priority' : 'Low Priority',
      title: `${dept} Department at Risk`,
      desc:  `Attrition rate in ${dept} is ${stats.attrition_pct}% — ${stats.attrition_count ?? '?'} of ${stats.total} predicted employees flagged.`,
      dept,
      rate:  stats.attrition_pct + '%',
    });
  }

  /* ── Insight 2: Overtime multiplier ──────────────────────────────── */
  const ot = data.overtime_attrition || {};
  if (ot['Yes'] !== undefined && ot['No'] !== undefined) {
    const mult = ot['No'] > 0 ? (ot['Yes'] / ot['No']).toFixed(1) : '—';
    const sev  = ot['Yes'] >= 30 ? 'high' : 'med';
    insights.push({
      icon: 'fa-clock',
      severity: sev,
      severityLabel: sev === 'high' ? 'High Priority' : 'Medium Priority',
      title: 'Overtime Drives Attrition',
      desc:  `Employees working overtime show ${ot['Yes']}% attrition vs ${ot['No']}% without overtime — a ${mult}× multiplier on departure risk.`,
      dept:  'All Depts',
      rate:  `${mult}× risk`,
    });
  }

  /* ── Insight 3: Low-pay high-risk count ──────────────────────────── */
  const scatter = data.comp_scatter || [];
  /* Backend sends { income, prob, risk } */
  const lowPay = scatter.filter(p => {
    const inc  = p.income != null ? p.income : (p.x != null ? p.x * 1000 : 0);
    const prob = p.prob   != null ? p.prob   : (p.y ?? 0);
    return inc < 5000 && prob > 50;
  }).length;

  if (scatter.length > 0) {
    insights.push({
      icon: 'fa-sack-dollar',
      severity: 'med',
      severityLabel: 'Medium Priority',
      title: 'Compensation Disparity',
      desc:  `${lowPay} employee record(s) earn below $5k/mo with attrition probability >50%. Market benchmarking review recommended.`,
      dept:  'Compensation',
      rate:  lowPay + ' flagged',
    });
  }

  /* ── Insight 4: High-risk pool share ─────────────────────────────── */
  /* Backend sends data.dist as { High, Medium, Low } counts from risk distribution */
  const dist     = data.dist || {};
  const highRisk = dist['High'] ?? (data.high_risk ?? 0);
  const total    = data.total  ?? 0;
  if (total > 0) {
    const pct = ((highRisk / total) * 100).toFixed(1);
    const sev = highRisk / total > 0.3 ? 'high' : 'med';
    insights.push({
      icon: 'fa-chart-line',
      severity: sev,
      severityLabel: sev === 'high' ? 'High Priority' : 'Medium Priority',
      title: 'High-Risk Employee Pool',
      desc:  `${highRisk} of ${total} predicted employees (${pct}%) are classified as High attrition risk. Immediate retention action advised.`,
      dept:  'All Levels',
      rate:  pct + '% high risk',
    });
  }

  /* Fallback: still render something useful when data is sparse */
  if (insights.length === 0) {
    insights.push({
      icon: 'fa-circle-info', severity: 'low', severityLabel: 'Informational',
      title: 'Collecting Baseline Data',
      desc:  'Submit more employee predictions to generate meaningful AI insights. Each prediction enriches your analytics.',
      dept: 'All', rate: '—',
    });
  }

  grid.innerHTML = insights.map((ins, i) => `
    <article class="insight-card" data-aos="fade-up" data-aos-delay="${i * 60}">
      <div class="insight-card__icon" aria-hidden="true"><i class="fa-solid ${ins.icon}"></i></div>
      <div class="insight-card__body">
        <p class="insight-card__severity insight-card__severity--${ins.severity}">${ins.severityLabel}</p>
        <h3 class="insight-card__title">${ins.title}</h3>
        <p class="insight-card__desc">${ins.desc}</p>
      </div>
      <div class="insight-card__footer">
        <span class="insight-card__dept">${ins.dept}</span>
        <span class="insight-card__rate">${ins.rate}</span>
      </div>
    </article>
  `).join('');
}

/* ─────────────────────────────────────────────────────────────────────
   10. Recommendations — fully dynamic, generated from real analytics
   ───────────────────────────────────────────────────────────────────── */
function renderRecommendations(data) {
  const recList = document.querySelector('.rec-list');
  if (!recList) return;

  const recs = [];

  const ot     = data.overtime_attrition || {};
  const dist   = data.dist               || {};
  const depts  = Object.entries(data.dept_stats || {}).sort((a, b) => b[1].attrition_pct - a[1].attrition_pct);
  const radar  = data.radar              || {};
  const scatter = data.comp_scatter      || [];

  const avgJobSat = radar['Job Satisfaction']         ?? 0;
  const avgWLB    = radar['Work-Life Balance']         ?? 0;
  const highRisk  = dist['High'] ?? (data.high_risk   ?? 0);
  const total     = data.total   ?? 1;

  /* Rec 1 — Compensation (always shown if scatter data exists) */
  const lowPayCount = scatter.filter(p => {
    const inc  = p.income != null ? p.income : (p.x != null ? p.x * 1000 : 0);
    const prob = p.prob   != null ? p.prob   : (p.y ?? 0);
    return inc < 5000 && prob > 50;
  }).length;

  recs.push({
    priority: 1,
    priorityClass: 'rec-card__priority--1',
    title: 'Review Compensation Structure',
    desc: lowPayCount > 0
      ? `${lowPayCount} employee record(s) earn below $5k/mo with high attrition risk. Conduct immediate market benchmarking and adjust salaries below the 40th percentile.`
      : 'Regularly benchmark salaries against market rates. Even small pay adjustments significantly reduce attrition probability.',
    impact: 'High',
    impactClass: 'rec-card__impact-value--high',
  });

  /* Rec 2 — Overtime (shown when overtime attrition is elevated) */
  const otYes = ot['Yes'] ?? 0;
  const otNo  = ot['No']  ?? 0;
  if (otYes > 0 || otNo > 0) {
    const mult = otNo > 0 ? (otYes / otNo).toFixed(1) : '—';
    recs.push({
      priority: 2,
      priorityClass: 'rec-card__priority--2',
      title: 'Reduce Overtime Dependency',
      desc: otYes >= 20
        ? `Overtime employees show ${otYes}% attrition (${mult}× non-OT baseline). Audit workload distribution${depts[0] ? ' in ' + depts[0][0] : ''} and implement flexible scheduling.`
        : `Proactively manage overtime to keep attrition risk low. Current overtime attrition rate: ${otYes}%.`,
      impact: otYes >= 20 ? 'High' : 'Medium',
      impactClass: otYes >= 20 ? 'rec-card__impact-value--high' : 'rec-card__impact-value--med',
    });
  }

  /* Rec 3 — Satisfaction / engagement */
  const avgSat = (avgJobSat + avgWLB) / 2;
  recs.push({
    priority: 3,
    priorityClass: 'rec-card__priority--3',
    title: avgSat < 2.5 ? 'Urgent: Improve Employee Engagement' : 'Increase Manager Engagement',
    desc: avgSat < 2.5
      ? `Average job satisfaction (${avgJobSat.toFixed(1)}/4) and work-life balance (${avgWLB.toFixed(1)}/4) are below healthy thresholds. Mandate monthly 1:1s and implement structured career path conversations.`
      : `Job satisfaction avg: ${avgJobSat.toFixed(1)}/4 · Work-life balance avg: ${avgWLB.toFixed(1)}/4. Train managers on early attrition signals and deploy proactive check-in programmes.`,
    impact: avgSat < 2.5 ? 'High' : 'Medium',
    impactClass: avgSat < 2.5 ? 'rec-card__impact-value--high' : 'rec-card__impact-value--med',
  });

  /* Rec 4 — High-risk department focus */
  if (depts.length > 0) {
    const [topDept, topStats] = depts[0];
    recs.push({
      priority: 4,
      priorityClass: 'rec-card__priority--4',
      title: `Target ${topDept} Retention`,
      desc: `${topDept} has the highest predicted attrition rate at ${topStats.attrition_pct}%. Deploy department-specific retention incentives and schedule skip-level conversations for at-risk employees.`,
      impact: topStats.attrition_pct >= 25 ? 'High' : 'Medium',
      impactClass: topStats.attrition_pct >= 25 ? 'rec-card__impact-value--high' : 'rec-card__impact-value--med',
    });
  } else {
    recs.push({
      priority: 4,
      priorityClass: 'rec-card__priority--4',
      title: 'Work-Life Balance Initiatives',
      desc: `Current WLB average: ${avgWLB.toFixed(1)}/4. Consider remote-optional days, wellness stipends, and asynchronous work options to improve retention rates.`,
      impact: 'Medium',
      impactClass: 'rec-card__impact-value--med',
    });
  }

  recList.innerHTML = recs.map(r => `
    <article class="rec-card">
      <div class="rec-card__priority ${r.priorityClass}" aria-label="Priority ${r.priority}">P${r.priority}</div>
      <div class="rec-card__body">
        <h3 class="rec-card__title">${r.title}</h3>
        <p class="rec-card__desc">${r.desc}</p>
      </div>
      <div class="rec-card__impact">
        <span class="rec-card__impact-label">Impact</span>
        <span class="rec-card__impact-value ${r.impactClass}">${r.impact}</span>
      </div>
    </article>
  `).join('');
}

/* ─────────────────────────────────────────────────────────────────────
   11. Activity Feed — latest 10 real predictions, replacing ALL static items
   ───────────────────────────────────────────────────────────────────── */
function renderActivityFeed(recent) {
  const feed = document.querySelector('.activity-feed');
  if (!feed) return;

  if (!recent || recent.length === 0) {
    feed.innerHTML = `
      <li class="activity-item">
        <time class="activity-item__time">—</time>
        <div class="activity-item__dot" aria-hidden="true"></div>
        <div class="activity-item__content">
          <p class="activity-item__title">No prediction activity yet</p>
          <p class="activity-item__desc">Run employee predictions to populate this feed.</p>
        </div>
        <span class="activity-item__tag activity-item__tag--done">Idle</span>
      </li>`;
    return;
  }

  feed.innerHTML = recent.map((rec, i) => {
    /* Normalise field names: backend renames job_role→jobRole, monthly_income→monthlyIncome */
    const dept     = rec.department ?? 'Unknown Dept';
    const role     = rec.jobRole    ?? rec.job_role    ?? 'Unknown Role';
    const income   = rec.monthlyIncome ?? rec.monthly_income ?? 0;
    const ts       = new Date((rec.timestamp ?? '') + (rec.timestamp?.includes('Z') ? '' : 'Z'));
    const timeStr  = isNaN(ts) ? '—' : ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const isFirst  = i === 0;
    const isAttr   = rec.prediction === 'Yes';
    const riskColor = rec.risk_level === 'High' ? '#ff4444' : rec.risk_level === 'Medium' ? '#ff9500' : '#30d158';

    return `
      <li class="activity-item">
        <time class="activity-item__time" datetime="${rec.timestamp ?? ''}">${timeStr}</time>
        <div class="activity-item__dot ${isFirst ? 'activity-item__dot--pulse' : ''}" aria-hidden="true"></div>
        <div class="activity-item__content">
          <p class="activity-item__title">
            ${isAttr ? '⚠ Attrition Predicted' : '✓ Retention Predicted'}
            — ${dept} · ${role}
          </p>
          <p class="activity-item__desc">
            Risk: <strong style="color:${riskColor}">${rec.risk_level}</strong>
            &nbsp;·&nbsp; Probability: ${rec.probability_yes}%
            &nbsp;·&nbsp; Income: $${Number(income).toLocaleString()}/mo
          </p>
        </div>
        <span class="activity-item__tag ${isAttr ? 'activity-item__tag--live' : 'activity-item__tag--done'}">
          ${isAttr ? 'At Risk' : 'Retained'}
        </span>
      </li>`;
  }).join('');
}

/* ─────────────────────────────────────────────────────────────────────
   12. Last-updated timestamp
   ───────────────────────────────────────────────────────────────────── */
function renderLastUpdated(isoString) {
  const el = document.getElementById('lastUpdated');
  if (!el) return;
  if (!isoString) { el.textContent = '—'; return; }
  const d = new Date(isoString + (isoString.includes('Z') ? '' : 'Z'));
  el.textContent = isNaN(d) ? '—' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/* ─────────────────────────────────────────────────────────────────────
   13. Master render — load + refresh
   ───────────────────────────────────────────────────────────────────── */
async function renderDashboard() {
  const data = await fetchAnalyticsData();
  if (!data || !data.success) return;

  if (data.empty || data.total === 0) {
    showEmptyState();
    return;
  }

  /* Clear empty state */
  const banner = document.getElementById('emptyBanner');
  if (banner) banner.remove();
  document.querySelectorAll('.chart-placeholder').forEach(el => el.remove());
  document.querySelectorAll('canvas').forEach(c => c.style.display = '');

  /* Update hero timestamp */
  renderLastUpdated(data.last_updated);

  /* Metrics */
  renderMetrics(data);

  /* Charts */
  renderChartDeptRisk(data.dept_stats         || {});
  renderChartAgeGroup(data.age_attrition      || {});
  renderChartOvertime(data.overtime_attrition || {});
  renderChartCompensation(data.comp_scatter   || []);
  renderChartSatisfaction(data.radar          || {});
  /* Workforce distribution: donut should show dept totals, not risk counts */
  const deptDist = {};
  Object.entries(data.dept_stats || {}).forEach(([d, s]) => { deptDist[d] = s.total; });
  renderChartDistribution(Object.keys(deptDist).length > 0 ? deptDist : (data.dist || {}));

  /* Sidebar panels */
  renderInsights(data);
  renderRiskFactors(data.top_factors || []);
  renderRecommendations(data);

  /* Activity feed — replaces all static HTML items */
  renderActivityFeed(data.recent || []);
}

/* ─────────────────────────────────────────────────────────────────────
   14. Navbar
   ───────────────────────────────────────────────────────────────────── */
function initNavbar() {
  const navbar     = document.getElementById('navbar');
  const hamburger  = document.getElementById('navHamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const indicator  = document.getElementById('navIndicator');
  const activeLink = document.querySelector('.navbar__link--active');

  const onScroll = () => navbar.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function positionIndicator(link) {
    if (!link || !indicator) return;
    const navRect  = link.closest('.navbar__nav').getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    indicator.style.left  = (linkRect.left - navRect.left) + 'px';
    indicator.style.width = linkRect.width + 'px';
  }
  if (activeLink) positionIndicator(activeLink);

  document.querySelectorAll('.navbar__link').forEach(link => {
    link.addEventListener('mouseenter', () => positionIndicator(link));
    link.addEventListener('mouseleave', () => { if (activeLink) positionIndicator(activeLink); });
  });

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('is-open');
      hamburger.classList.toggle('is-active', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      mobileMenu.setAttribute('aria-hidden', String(!isOpen));
    });
  }

  window.addEventListener('resize', () => { if (activeLink) positionIndicator(activeLink); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu?.classList.contains('is-open')) {
      mobileMenu.classList.remove('is-open');
      hamburger.classList.remove('is-active');
      hamburger.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-hidden', 'true');
      hamburger.focus();
    }
  });
}

/* ─────────────────────────────────────────────────────────────────────
   15. GSAP entrance animations
   ───────────────────────────────────────────────────────────────────── */
function initGSAP() {
  if (typeof gsap === 'undefined') return;
  gsap.from('.hero__eyebrow', { opacity: 0, y: 14, duration: 0.55, ease: 'power2.out', delay: 0.1  });
  gsap.from('.hero__title',   { opacity: 0, y: 20, duration: 0.65, ease: 'power3.out', delay: 0.22 });
  gsap.from('.hero__sub',     { opacity: 0, y: 14, duration: 0.55, ease: 'power2.out', delay: 0.36 });
  gsap.from('.hero__meta',    { opacity: 0, x: 20, duration: 0.65, ease: 'power2.out', delay: 0.28 });
  gsap.from('.navbar__logo',  { opacity: 0, x:-12, duration: 0.5,  ease: 'power2.out', delay: 0.05 });
}

/* ─────────────────────────────────────────────────────────────────────
   16. Card hover lift (GSAP)
   ───────────────────────────────────────────────────────────────────── */
function initCardHover() {
  if (typeof gsap === 'undefined') return;
  ['.metric-card', '.insight-card', '.rec-card', '.chart-card'].forEach(sel => {
    document.querySelectorAll(sel).forEach(card => {
      card.addEventListener('mouseenter', () => gsap.to(card, { y: -3, duration: 0.22, ease: 'power2.out'   }));
      card.addEventListener('mouseleave', () => gsap.to(card, { y:  0, duration: 0.28, ease: 'power2.inOut' }));
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────
   17. Auto-refresh every 30 seconds
   ───────────────────────────────────────────────────────────────────── */
function initAutoRefresh() {
  setInterval(renderDashboard, 30_000);
}

/* ─────────────────────────────────────────────────────────────────────
   18. Boot
   ───────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initGSAP();
  initCardHover();

  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 500, easing: 'ease-out-cubic', once: true, offset: 40 });
  }

  renderDashboard();
  initAutoRefresh();
});