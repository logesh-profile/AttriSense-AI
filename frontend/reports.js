/* =====================================================================
   ATTRISENSE AI — reports.js
   100% database-driven. Zero hardcoded values.
   Single source of truth: /analytics-data + /api/predictions
   ===================================================================== */
'use strict';

/* ── State ── */
let state = {
  page:      1,
  pageSize:  15,
  totalPages:1,
  total:     0,
  search:    '',
  risk:      'all',
  dept:      'all',
  pred:      'all',
  sortCol:   'timestamp',
  sortDir:   'desc',
};

let searchTimer  = null;
let toastTimer   = null;
let analyticsCache = null;

/* ── Toast ── */
function showToast(msg, icon = 'fa-circle-check') {
  const el = document.getElementById('toast');
  el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${msg}</span>`;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3000);
}

/* ── Navbar ── */
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
  window.addEventListener('resize', () => { if (activeLink) positionIndicator(activeLink); });

  hamburger?.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    hamburger.classList.toggle('is-active', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu?.classList.contains('is-open')) {
      mobileMenu.classList.remove('is-open');
      hamburger.classList.remove('is-active');
      hamburger.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-hidden', 'true');
    }
  });
}

/* ── Format helpers ── */
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('Z') ? iso : iso + 'Z');
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('Z') ? iso : iso + 'Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}
function fmtIncome(v) {
  if (v == null || v === '') return '—';
  return '$' + Number(v).toLocaleString();
}

/* ─────────────────────────────────────────────────────────────────────
   FETCH ANALYTICS DATA  (/analytics-data)
   Single source of truth — same endpoint used by analytics.js
   ───────────────────────────────────────────────────────────────────── */
async function fetchAnalyticsData() {
  try {
    const res = await fetch('/analytics-data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('analytics-data failed:', err);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   RENDER KPI CARDS  — real numbers, exact match with analytics page
   ───────────────────────────────────────────────────────────────────── */
function renderKPIs(data) {
  const attrCount = data.total - Math.round(data.total * data.retention_rate / 100);
  const retCount  = data.total - attrCount;

  animateValue('kpiTotal',    data.total,      0);
  animateValue('kpiAttrition', attrCount,      0);
  animateValue('kpiRetention', retCount,       0);
  animateValue('kpiHighRisk',  data.high_risk, 0);

  const attrPct = data.attrition_rate;
  const retPct  = data.retention_rate;
  el('kpiAttritionRate').textContent = `${attrPct}% of total`;
  el('kpiRetentionRate').textContent = `${retPct}% of total`;
  el('lastPredTime').textContent     = fmtTime(data.last_updated);
}

function animateValue(id, target, decimals) {
  const el   = document.getElementById(id);
  if (!el) return;
  const start  = performance.now();
  const dur    = 1100;
  const ease   = t => 1 - Math.pow(1 - t, 3);
  function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = (target * ease(p)).toFixed(decimals);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target.toFixed(decimals);
  }
  requestAnimationFrame(tick);
}

/* ─────────────────────────────────────────────────────────────────────
   POPULATE DEPT FILTER  — only real departments from the database
   ───────────────────────────────────────────────────────────────────── */
function populateDeptFilter(deptStats) {
  const select = document.getElementById('deptFilter');
  const depts  = Object.keys(deptStats).sort();
  depts.forEach(d => {
    const opt = document.createElement('option');
    opt.value       = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
}

/* ─────────────────────────────────────────────────────────────────────
   RENDER DEPT BREAKDOWN CARDS  — real data only
   ───────────────────────────────────────────────────────────────────── */
function renderBreakdown(deptStats) {
  const section = document.getElementById('breakdownSection');
  const grid    = document.getElementById('breakdownGrid');
  const depts   = Object.entries(deptStats);

  if (depts.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  const maxPct   = Math.max(...depts.map(([, v]) => v.attrition_pct), 1);

  grid.innerHTML = depts.map(([dept, stats]) => {
    const pct      = stats.attrition_pct;
    const barPct   = (pct / maxPct) * 100;
    const fillClass = pct >= 25 ? 'breakdown-card__fill--high'
                    : pct >= 15 ? 'breakdown-card__fill--med'
                    : '';
    return `
      <article class="breakdown-card">
        <p class="breakdown-card__dept">${dept}</p>
        <p class="breakdown-card__total">${stats.total}</p>
        <p class="breakdown-card__sub">${stats.attrition_count} attrition predicted</p>
        <div class="breakdown-card__bar">
          <div class="breakdown-card__fill ${fillClass}" style="width:0" data-target="${barPct}"></div>
        </div>
        <p class="breakdown-card__rate">${pct}% attrition rate</p>
      </article>`;
  }).join('');

  // Animate bars
  setTimeout(() => {
    grid.querySelectorAll('.breakdown-card__fill').forEach(f => {
      f.style.transition = 'width 0.9s cubic-bezier(0.16,1,0.3,1)';
      f.style.width = f.dataset.target + '%';
    });
  }, 120);
}

/* ─────────────────────────────────────────────────────────────────────
   RENDER ACTIVITY FEED  — last 10 real predictions
   ───────────────────────────────────────────────────────────────────── */
function renderActivityFeed(recent) {
  const feed = document.getElementById('activityFeed');
  if (!recent || recent.length === 0) {
    feed.innerHTML = '<li class="activity-feed__loading">No recent predictions.</li>';
    return;
  }

  feed.innerHTML = recent.map((rec, i) => {
    const isAttr = rec.prediction === 'Yes';
    const role   = rec.jobRole || rec.job_role || '—';
    const dept   = rec.department || '—';
    const income = rec.monthlyIncome || rec.monthly_income;

    return `
      <li class="activity-item">
        <time class="activity-item__time">${fmtDate(rec.timestamp)}</time>
        <div class="activity-item__dot ${i === 0 ? 'activity-item__dot--pulse' : ''}"></div>
        <div class="activity-item__content">
          <p class="activity-item__title">
            ${isAttr ? '⚠ Attrition Predicted' : '✓ Retention Predicted'}
            — ${dept} · ${role}
          </p>
          <p class="activity-item__desc">
            Risk:
            <strong style="color:${rec.risk_level === 'High' ? 'var(--c-risk-high)' : rec.risk_level === 'Medium' ? 'var(--c-risk-med)' : 'var(--c-risk-low)'}">${rec.risk_level}</strong>
            &nbsp;·&nbsp; Probability: ${rec.probability_yes}%
            &nbsp;·&nbsp; Income: ${fmtIncome(income)}
          </p>
        </div>
        <span class="activity-item__tag ${isAttr ? 'activity-item__tag--risk' : 'activity-item__tag--safe'}">
          ${isAttr ? 'At Risk' : 'Retained'}
        </span>
      </li>`;
  }).join('');
}

/* ─────────────────────────────────────────────────────────────────────
   FETCH PREDICTION TABLE  (/api/predictions)
   ───────────────────────────────────────────────────────────────────── */
async function fetchPredictions() {
  const params = new URLSearchParams({
    page:       state.page,
    page_size:  state.pageSize,
    sort_col:   state.sortCol,
    sort_dir:   state.sortDir,
  });
  if (state.search) params.set('search', state.search);
  if (state.risk !== 'all') params.set('risk', state.risk);
  if (state.dept !== 'all') params.set('department', state.dept);

  // prediction filter handled client-side (not in backend API)
  try {
    const res = await fetch('/api/predictions?' + params.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('api/predictions failed:', err);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   RENDER TABLE
   ───────────────────────────────────────────────────────────────────── */
async function renderTable() {
  const tbody   = document.getElementById('tableBody');
  const emptyEl = document.getElementById('emptyState');
  const paginEl = document.getElementById('pagination');
  const countEl = document.getElementById('filterCount');

  tbody.innerHTML = `<tr><td colspan="12"><div class="table-loader"><span class="table-loader__spinner"></span> Loading…</div></td></tr>`;
  emptyEl.hidden  = true;
  paginEl.hidden  = true;

  const data = await fetchPredictions();
  if (!data || !data.success) {
    tbody.innerHTML = `<tr><td colspan="12" style="padding:32px;text-align:center;color:var(--c-white-20);font-family:var(--font-mono);font-size:12px;">Failed to load records. Check Flask is running.</td></tr>`;
    return;
  }

  state.totalPages = data.total_pages;
  state.total      = data.total;
  state.page       = Math.min(state.page, data.total_pages);

  countEl.textContent = `${data.total} record${data.total !== 1 ? 's' : ''}`;

  // Apply client-side prediction filter if selected
  let rows = data.rows;
  if (state.pred !== 'all') {
    rows = rows.filter(r => r.prediction === state.pred);
  }

  if (data.total === 0 || rows.length === 0) {
    tbody.innerHTML = '';
    emptyEl.hidden  = data.total > 0; // only show full empty state if DB is empty
    if (data.total > 0 && rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="padding:32px;text-align:center;color:var(--c-white-20);font-family:var(--font-mono);font-size:12px;">No records match the active filters.</td></tr>`;
    }
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const isAttr   = r.prediction === 'Yes';
    const riskKey  = (r.risk_level || '').toLowerCase();
    const isOT     = r.overtime === 'Yes';
    const tenure   = r.total_working_years != null ? r.total_working_years + ' yrs' : '—';

    return `
      <tr>
        <td class="cell-id">#${r.id}</td>
        <td class="cell-time">${fmtDate(r.timestamp)} ${fmtTime(r.timestamp)}</td>
        <td>
          <span class="cell-result cell-result--${isAttr ? 'yes' : 'no'}">
            <i class="fa-solid fa-${isAttr ? 'triangle-exclamation' : 'circle-check'}"></i>
            ${isAttr ? 'Yes' : 'No'}
          </span>
        </td>
        <td><span class="risk-pill risk-pill--${riskKey}">${r.risk_level || '—'}</span></td>
        <td class="cell-prob">${r.probability_yes != null ? r.probability_yes + '%' : '—'}</td>
        <td>${r.department || '—'}</td>
        <td>${r.job_role || '—'}</td>
        <td>${r.age || '—'}</td>
        <td>${r.gender || '—'}</td>
        <td>${fmtIncome(r.monthly_income)}</td>
        <td class="${isOT ? 'cell-ot-yes' : 'cell-ot-no'}">${r.overtime || '—'}</td>
        <td>${tenure}</td>
      </tr>`;
  }).join('');

  // GSAP row animation
  if (typeof gsap !== 'undefined') {
    gsap.from(tbody.querySelectorAll('tr'), { opacity: 0, y: 5, duration: 0.3, stagger: 0.02, ease: 'power2.out' });
  }

  // Pagination
  if (data.total_pages > 1) {
    renderPagination(data.total_pages);
    paginEl.hidden = false;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   PAGINATION
   ───────────────────────────────────────────────────────────────────── */
function renderPagination(totalPages) {
  const pageButtons = document.getElementById('pageButtons');
  const prevBtn     = document.getElementById('prevBtn');
  const nextBtn     = document.getElementById('nextBtn');

  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= totalPages;

  const maxBtns  = 5;
  let start = Math.max(1, state.page - 2);
  let end   = Math.min(totalPages, start + maxBtns - 1);
  start     = Math.max(1, end - maxBtns + 1);

  let html = '';
  for (let p = start; p <= end; p++) {
    html += `<button class="page-num-btn ${p === state.page ? 'is-active' : ''}" data-page="${p}">${p}</button>`;
  }
  pageButtons.innerHTML = html;
}

function initPagination() {
  document.getElementById('prevBtn').addEventListener('click', () => {
    if (state.page > 1) { state.page--; renderTable(); }
  });
  document.getElementById('nextBtn').addEventListener('click', () => {
    if (state.page < state.totalPages) { state.page++; renderTable(); }
  });
  document.getElementById('pageButtons').addEventListener('click', e => {
    const btn = e.target.closest('.page-num-btn');
    if (!btn) return;
    state.page = parseInt(btn.dataset.page, 10);
    renderTable();
    document.getElementById('tableWrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

/* ─────────────────────────────────────────────────────────────────────
   FILTERS
   ───────────────────────────────────────────────────────────────────── */
function initFilters() {
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page   = 1;
      renderTable();
    }, 350);
  });
  document.getElementById('riskFilter').addEventListener('change', e => {
    state.risk = e.target.value;
    state.page = 1;
    renderTable();
  });
  document.getElementById('deptFilter').addEventListener('change', e => {
    state.dept = e.target.value;
    state.page = 1;
    renderTable();
  });
  document.getElementById('predFilter').addEventListener('change', e => {
    state.pred = e.target.value;
    state.page = 1;
    renderTable();
  });
  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('riskFilter').value  = 'all';
    document.getElementById('deptFilter').value  = 'all';
    document.getElementById('predFilter').value  = 'all';
    state = { ...state, search: '', risk: 'all', dept: 'all', pred: 'all', page: 1 };
    renderTable();
  });
}

/* ─────────────────────────────────────────────────────────────────────
   COLUMN SORT
   ───────────────────────────────────────────────────────────────────── */
function initSort() {
  document.querySelectorAll('.sortable[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortCol === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortCol = col;
        state.sortDir = 'desc';
      }
      document.querySelectorAll('.sortable').forEach(h => h.classList.remove('is-sorted'));
      th.classList.add('is-sorted');
      state.page = 1;
      renderTable();
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────
   REAL CSV EXPORT  — generate from current DB data
   No fake downloads. Uses /api/predictions with large page_size.
   ───────────────────────────────────────────────────────────────────── */
async function exportCSV(highRiskOnly = false) {
  showToast('Preparing export…', 'fa-spinner');

  try {
    const params = new URLSearchParams({ page: 1, page_size: 50, sort_col: 'timestamp', sort_dir: 'desc' });
    if (highRiskOnly) params.set('risk', 'High');

    const res  = await fetch('/api/predictions?' + params.toString());
    const data = await res.json();

    if (!data.success || data.rows.length === 0) {
      showToast('No data to export', 'fa-circle-xmark');
      return;
    }

    const headers = [
      'ID','Timestamp','Prediction','Risk Level','Probability (%)',
      'Department','Job Role','Age','Gender','Monthly Income',
      'Overtime','Job Satisfaction','Work Life Balance',
      'Environment Satisfaction','Total Working Years'
    ];

    const csvRows = [
      headers.join(','),
      ...data.rows.map(r => [
        r.id,
        r.timestamp,
        r.prediction,
        r.risk_level,
        r.probability_yes,
        `"${r.department || ''}"`,
        `"${r.job_role || ''}"`,
        r.age || '',
        r.gender || '',
        r.monthly_income || '',
        r.overtime || '',
        r.job_satisfaction || '',
        r.work_life_balance || '',
        r.environment_satisfaction || '',
        r.total_working_years || '',
      ].join(','))
    ];

    const blob     = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url      = URL.createObjectURL(blob);
    const link     = document.createElement('a');
    const filename = highRiskOnly
      ? `attrisense-high-risk-${new Date().toISOString().slice(0,10)}.csv`
      : `attrisense-predictions-${new Date().toISOString().slice(0,10)}.csv`;

    link.href     = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${data.rows.length} record${data.rows.length !== 1 ? 's' : ''} as CSV`, 'fa-circle-check');
  } catch (err) {
    console.error('CSV export failed:', err);
    showToast('Export failed. Try again.', 'fa-circle-xmark');
  }
}

function initExports() {
  document.getElementById('exportCsvBtn').addEventListener('click', () => exportCSV(false));
  document.getElementById('exportHighRiskBtn').addEventListener('click', () => exportCSV(true));
}

/* ─────────────────────────────────────────────────────────────────────
   GSAP ENTRANCE
   ───────────────────────────────────────────────────────────────────── */
function initGSAP() {
  if (typeof gsap === 'undefined') return;
  gsap.from('.navbar__logo',  { opacity:0, x:-12, duration:0.5,  ease:'power2.out', delay:0.05 });
  gsap.from('.hero__eyebrow', { opacity:0, y:14,  duration:0.55, ease:'power2.out', delay:0.1  });
  gsap.from('.hero__title',   { opacity:0, y:20,  duration:0.65, ease:'power3.out', delay:0.22 });
  gsap.from('.hero__sub',     { opacity:0, y:14,  duration:0.55, ease:'power2.out', delay:0.36 });
  gsap.from('.hero__meta',    { opacity:0, x:20,  duration:0.65, ease:'power2.out', delay:0.28 });
}

/* ─────────────────────────────────────────────────────────────────────
   HELPER
   ───────────────────────────────────────────────────────────────────── */
function el(id) { return document.getElementById(id); }

/* ─────────────────────────────────────────────────────────────────────
   BOOT
   ───────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initFilters();
  initPagination();
  initSort();
  initExports();
  initGSAP();

  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 500, easing: 'ease-out-cubic', once: true, offset: 40 });
  }

  // Fetch analytics data (same endpoint as analytics page — single source of truth)
  const analytics = await fetchAnalyticsData();
  analyticsCache  = analytics;

  if (!analytics || !analytics.success || analytics.empty || analytics.total === 0) {
    // Show empty state on KPIs
    ['kpiTotal','kpiAttrition','kpiRetention','kpiHighRisk'].forEach(id => {
      el(id).textContent = '0';
    });
    el('kpiAttritionRate').textContent = '—% of total';
    el('kpiRetentionRate').textContent = '—% of total';
    el('lastPredTime').textContent     = 'Never';
    document.getElementById('emptyState').hidden = false;
    document.getElementById('tableWrap').style.display = 'none';
    document.getElementById('filterBar').style.display = 'none';
    document.getElementById('export-bar') && (document.getElementById('export-bar').style.display = 'none');
    el('activityFeed').innerHTML = '<li class="activity-feed__loading">No prediction data yet.</li>';
    return;
  }

  // Render everything from real data
  renderKPIs(analytics);
  populateDeptFilter(analytics.dept_stats || {});
  renderBreakdown(analytics.dept_stats   || {});
  renderActivityFeed(analytics.recent    || []);

  // Disable export buttons if no data
  if (analytics.total === 0) {
    document.getElementById('exportCsvBtn').disabled     = true;
    document.getElementById('exportHighRiskBtn').disabled = true;
  }

  // Render table
  await renderTable();

  // Auto-refresh every 30 seconds
  setInterval(async () => {
    const fresh = await fetchAnalyticsData();
    if (fresh && fresh.success && !fresh.empty) {
      renderKPIs(fresh);
      renderActivityFeed(fresh.recent || []);
      renderBreakdown(fresh.dept_stats || {});
    }
    renderTable();
  }, 30_000);
});