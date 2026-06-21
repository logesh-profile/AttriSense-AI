/* =====================================================================
   ATTRISENSE AI — prediction.js
   All 30 model features. Zero hardcoded defaults.
   ===================================================================== */
'use strict';

AOS.init({ once: true, duration: 600, easing: 'ease-out-quart', offset: 40 });
gsap.registerPlugin(ScrollTrigger);

/* ── DOM refs ── */
const form          = document.getElementById('predictionForm');
const predictBtn    = document.getElementById('predictBtn');
const statusDot     = document.getElementById('statusDot');
const statusText    = document.getElementById('statusText');
const analysisBadge = document.getElementById('analysisBadge');
const lastUpdated   = document.getElementById('lastUpdated');

const readinessFill   = document.getElementById('readinessFill');
const readinessValue  = document.getElementById('readinessValue');
const readinessStatus = document.getElementById('readinessStatus');
const profileFill     = document.getElementById('profileFill');
const profilePct      = document.getElementById('profilePct');
const riskFill        = document.getElementById('riskFill');
const riskPct         = document.getElementById('riskPct');
const qualityFill     = document.getElementById('qualityFill');
const qualityPct      = document.getElementById('qualityPct');
const aiStatusDot     = document.getElementById('aiStatusDot');
const aiStatusText    = document.getElementById('aiStatusText');

const checkA      = document.getElementById('checkA');
const checkB      = document.getElementById('checkB');
const checkC      = document.getElementById('checkC');
const checkD      = document.getElementById('checkD');
const checkE      = document.getElementById('checkE');
const checkACount = document.getElementById('checkACount');
const checkBCount = document.getElementById('checkBCount');
const checkCCount = document.getElementById('checkCCount');
const checkDCount = document.getElementById('checkDCount');
const checkECount = document.getElementById('checkECount');

const insightOvertimeText  = document.getElementById('insightOvertimeText');
const insightOvertimeBadge = document.getElementById('insightOvertimeBadge');
const insightCompText      = document.getElementById('insightCompText');
const insightCompBadge     = document.getElementById('insightCompBadge');
const insightTenureText    = document.getElementById('insightTenureText');
const insightTenureBadge   = document.getElementById('insightTenureBadge');
const insightSatText       = document.getElementById('insightSatText');
const insightSatBadge      = document.getElementById('insightSatBadge');
const insightOvertimeCard  = document.getElementById('insight-overtime');
const insightCompCard      = document.getElementById('insight-compensation');
const insightTenureCard    = document.getElementById('insight-tenure');
const insightSatCard       = document.getElementById('insight-satisfaction');

const snapDeptVal    = document.getElementById('snapDeptVal');
const snapDeptSub    = document.getElementById('snapDeptSub');
const snapCompVal    = document.getElementById('snapCompVal');
const snapCompSub    = document.getElementById('snapCompSub');
const snapEngageVal  = document.getElementById('snapEngageVal');
const snapEngageSub  = document.getElementById('snapEngageSub');
const snapTenureVal  = document.getElementById('snapTenureVal');
const snapTenureSub  = document.getElementById('snapTenureSub');

const profileCreatedItem = document.getElementById('profileCreatedItem');
const profileCreatedTime = document.getElementById('profileCreatedTime');
const analysisInitItem   = document.getElementById('analysisInitItem');
const analysisInitTime   = document.getElementById('analysisInitTime');
const recGenItem         = document.getElementById('recGenItem');
const recGenTime         = document.getElementById('recGenTime');

/* ─────────────────────────────────────────────────────────────────────
   SECTION FIELD MAP — all 30 model features across 5 sections
   ───────────────────────────────────────────────────────────────────── */
const sectionFields = {
  // Section A — Personal (4 fields)
  A: ['age', 'gender', 'maritalStatus', 'distanceFromHome'],

  // Section B — Professional (8 fields)
  B: ['department', 'jobRole', 'jobLevel', 'jobInvolvement',
      'businessTravel', 'educationField', 'education', 'numCompaniesWorked'],

  // Section C — Compensation (8 fields)
  C: ['monthlyIncome', 'monthlyRate', 'dailyRate', 'hourlyRate',
      'percentSalaryHike', 'stockOptionLevel', 'performanceRating', 'trainingTimesLastYear'],

  // Section D — Work Environment & Satisfaction (5 fields)
  D: ['overtime', 'workLifeBalance', 'environmentSatisfaction',
      'jobSatisfaction', 'relationshipSatisfaction'],

  // Section E — Tenure & Experience (5 fields)
  E: ['totalWorkingYears', 'yearsAtCompany', 'yearsInCurrentRole',
      'yearsSinceLastPromotion', 'yearsWithCurrManager'],
};

// Verify count = 30
const totalFields = Object.values(sectionFields).reduce((a, b) => a + b.length, 0); // 30

/* ── Utilities ── */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function setBar(fillEl, pctEl, value) {
  const pct = Math.round(value);
  fillEl.style.width = pct + '%';
  pctEl.textContent  = pct + '%';
}
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function isFieldFilled(id) { return getVal(id) !== ''; }
function countSection(keys) { return keys.filter(k => isFieldFilled(k)).length; }

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
      hamburger.focus();
    }
  });
}

/* ── Checklist item ── */
function updateChecklistItem(el, countEl, filled, total) {
  countEl.textContent = `${filled}/${total}`;
  if (filled === total) {
    el.classList.add('checklist-item--done');
    el.querySelector('.checklist-item__icon').innerHTML = '<i class="fa-solid fa-circle-check"></i>';
  } else {
    el.classList.remove('checklist-item--done');
    el.querySelector('.checklist-item__icon').innerHTML = '<i class="fa-regular fa-circle"></i>';
  }
}

/* ── Insight card ── */
function setInsightCard(card, textEl, badgeEl, text, badge, state) {
  textEl.textContent  = text;
  badgeEl.textContent = badge;
  card.className = 'insight-card insight-card--' + state;
  badgeEl.className = 'insight-card__badge insight-card__badge--' + (
    state === 'positive' ? 'positive' :
    state === 'warning'  ? 'warning'  :
    state === 'danger'   ? 'danger'   : 'neutral'
  );
}

/* Dept risk reference (Sales/HR/R&D only — dataset values) */
const deptRisk = {
  'Sales':                  { level: 'High', label: 'Elevated turnover history' },
  'Research & Development': { level: 'Med',  label: 'Moderate retention rate' },
  'Human Resources':        { level: 'Low',  label: 'Strong internal retention' },
};

function setStatus(dotState, text) {
  statusDot.className    = `status-badge__dot status-badge__dot--${dotState}`;
  statusText.textContent = text;
}
function setAiStatus(dotState, text) {
  aiStatusDot.className    = `ai-status__dot ai-status__dot--${dotState}`;
  aiStatusText.textContent = text;
}

/* ─────────────────────────────────────────────────────────────────────
   MASTER WORKSPACE UPDATER
   ───────────────────────────────────────────────────────────────────── */
function updateWorkspace() {
  const filledA = countSection(sectionFields.A);
  const filledB = countSection(sectionFields.B);
  const filledC = countSection(sectionFields.C);
  const filledD = countSection(sectionFields.D);
  const filledE = countSection(sectionFields.E);
  const totalFilled = filledA + filledB + filledC + filledD + filledE;
  const completion  = Math.round((totalFilled / totalFields) * 100);

  // Checklist — 5 sections
  updateChecklistItem(checkA, checkACount, filledA, sectionFields.A.length);
  updateChecklistItem(checkB, checkBCount, filledB, sectionFields.B.length);
  updateChecklistItem(checkC, checkCCount, filledC, sectionFields.C.length);
  updateChecklistItem(checkD, checkDCount, filledD, sectionFields.D.length);
  updateChecklistItem(checkE, checkECount, filledE, sectionFields.E.length);

  // Readiness meter
  readinessFill.style.width  = completion + '%';
  readinessValue.textContent = completion + '%';
  document.querySelector('.readiness-meter')?.setAttribute('aria-valuenow', completion);

  // Indicator bars
  // Risk readiness: weighted toward compensation (C) + env (D)
  const riskPctVal = Math.round(
    ((filledC / sectionFields.C.length) * 0.35 +
     (filledD / sectionFields.D.length) * 0.40 +
     (filledE / sectionFields.E.length) * 0.25) * 100
  );
  const qualityPctVal = totalFilled === 0 ? 0 : Math.min(100, Math.round(completion * 0.94));
  setBar(profileFill, profilePct, completion);
  setBar(riskFill,    riskPct,    riskPctVal);
  setBar(qualityFill, qualityPct, qualityPctVal);

  // Readiness label
  if (completion === 100) {
    readinessStatus.textContent = 'Ready';
    readinessStatus.classList.add('analysis-card__status--ready');
  } else {
    readinessStatus.textContent = 'Incomplete';
    readinessStatus.classList.remove('analysis-card__status--ready');
  }

  // AI status
  if (completion === 0)       setAiStatus('idle',   'Awaiting employee data');
  else if (completion < 40)   setAiStatus('active', 'Collecting profile data…');
  else if (completion < 80)   setAiStatus('active', 'Building risk model…');
  else if (completion < 100)  setAiStatus('active', 'Nearly ready…');
  else                        setAiStatus('active', 'Ready for analysis');

  // Header badge
  if (completion === 0)      { setStatus('idle',   'Ready for Input');          analysisBadge.className = 'status-badge'; }
  else if (completion < 100) { setStatus('active', `${completion}% Complete`);  analysisBadge.className = 'status-badge status-badge--active'; }
  else                       { setStatus('active', 'Ready to Analyze');          analysisBadge.className = 'status-badge status-badge--active'; }

  // Profile timeline entry
  if (totalFilled >= 1 && profileCreatedItem.hidden) {
    profileCreatedItem.hidden = false;
    profileCreatedItem.classList.remove('activity-item--pending');
    profileCreatedTime.textContent = formatTime(new Date());
    gsap.from(profileCreatedItem, { opacity: 0, y: 8, duration: 0.4, ease: 'power2.out' });
  }

  // Enable/disable predict button
  predictBtn.disabled = completion < 100;

  updateInsights();
  updateSnapshot();
}

/* ─────────────────────────────────────────────────────────────────────
   QUICK INSIGHTS — live signals as user fills form
   ───────────────────────────────────────────────────────────────────── */
function updateInsights() {
  // Overtime
  const ot = getVal('overtime');
  if (ot === 'Yes')
    setInsightCard(insightOvertimeCard, insightOvertimeText, insightOvertimeBadge, 'Overtime detected — elevated burnout risk', 'Risk', 'danger');
  else if (ot === 'No')
    setInsightCard(insightOvertimeCard, insightOvertimeText, insightOvertimeBadge, 'No overtime — healthy workload balance', 'OK', 'positive');
  else
    setInsightCard(insightOvertimeCard, insightOvertimeText, insightOvertimeBadge, 'Awaiting input', '—', 'neutral');

  // Compensation vs job level benchmarks
  const income = parseFloat(getVal('monthlyIncome'));
  const level  = parseInt(getVal('jobLevel'), 10);
  if (!isNaN(income) && !isNaN(level)) {
    const bench = [0, 3500, 5500, 8000, 12000, 18000][level] || 5000;
    if (income < bench * 0.8)
      setInsightCard(insightCompCard, insightCompText, insightCompBadge, 'Below department average compensation', 'Low', 'danger');
    else if (income < bench)
      setInsightCard(insightCompCard, insightCompText, insightCompBadge, 'Slightly below market benchmark', 'Watch', 'warning');
    else
      setInsightCard(insightCompCard, insightCompText, insightCompBadge, 'Compensation is competitive', 'OK', 'positive');
  } else {
    setInsightCard(insightCompCard, insightCompText, insightCompBadge, 'Awaiting input', '—', 'neutral');
  }

  // Tenure
  const years = parseFloat(getVal('totalWorkingYears'));
  if (!isNaN(years)) {
    if (years <= 2)       setInsightCard(insightTenureCard, insightTenureText, insightTenureBadge, 'Early-career — higher attrition probability', 'Risk', 'warning');
    else if (years <= 8)  setInsightCard(insightTenureCard, insightTenureText, insightTenureBadge, 'Mid-career — moderate retention outlook', 'Stable', 'positive');
    else                  setInsightCard(insightTenureCard, insightTenureText, insightTenureBadge, 'Experienced — strong retention likelihood', 'Strong', 'positive');
  } else {
    setInsightCard(insightTenureCard, insightTenureText, insightTenureBadge, 'Awaiting input', '—', 'neutral');
  }

  // Satisfaction index: average of all 4 satisfaction scores
  const scores = ['environmentSatisfaction', 'jobSatisfaction', 'relationshipSatisfaction', 'workLifeBalance']
    .map(id => parseInt(getVal(id), 10))
    .filter(n => !isNaN(n));

  if (scores.length > 0) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 2)
      setInsightCard(insightSatCard, insightSatText, insightSatBadge, 'Elevated attrition indicators detected', 'High Risk', 'danger');
    else if (avg < 3)
      setInsightCard(insightSatCard, insightSatText, insightSatBadge, 'Mixed satisfaction signals — monitor closely', 'Medium', 'warning');
    else
      setInsightCard(insightSatCard, insightSatText, insightSatBadge, 'Positive satisfaction index', 'Low Risk', 'positive');
  } else {
    setInsightCard(insightSatCard, insightSatText, insightSatBadge, 'Awaiting input', '—', 'neutral');
  }
}

/* ─────────────────────────────────────────────────────────────────────
   WORKFORCE SNAPSHOT
   ───────────────────────────────────────────────────────────────────── */
function updateSnapshot() {
  // Department Risk
  const dept = getVal('department');
  if (dept && deptRisk[dept]) {
    const d = deptRisk[dept];
    snapDeptVal.textContent = d.level;
    snapDeptSub.textContent = d.label;
    document.getElementById('snapDept').classList.add('snapshot-item--active');
  } else {
    snapDeptVal.textContent = '—';
    snapDeptSub.textContent = 'Select department';
    document.getElementById('snapDept').classList.remove('snapshot-item--active');
  }

  // Compensation Position
  const income = parseFloat(getVal('monthlyIncome'));
  if (!isNaN(income)) {
    if (income < 4000)       { snapCompVal.textContent = 'Below';  snapCompSub.textContent = 'Under market rate'; }
    else if (income < 8000)  { snapCompVal.textContent = 'Market'; snapCompSub.textContent = 'At benchmark range'; }
    else if (income < 14000) { snapCompVal.textContent = 'Above';  snapCompSub.textContent = 'Above average pay'; }
    else                     { snapCompVal.textContent = 'Top';    snapCompSub.textContent = 'Top-tier compensation'; }
    document.getElementById('snapComp').classList.add('snapshot-item--active');
  } else {
    snapCompVal.textContent = '—';
    snapCompSub.textContent = 'Enter income';
    document.getElementById('snapComp').classList.remove('snapshot-item--active');
  }

  // Engagement Score (4 satisfaction fields averaged to %)
  const satIds = ['jobSatisfaction', 'environmentSatisfaction', 'relationshipSatisfaction', 'workLifeBalance'];
  const satVals = satIds.map(id => parseInt(getVal(id), 10)).filter(n => !isNaN(n));
  if (satVals.length > 0) {
    const avg = satVals.reduce((a, b) => a + b, 0) / satVals.length;
    snapEngageVal.textContent = (avg * 25).toFixed(0) + '%';
    snapEngageSub.textContent = avg >= 3 ? 'Engaged' : avg >= 2 ? 'Mixed' : 'Disengaged';
    document.getElementById('snapEngage').classList.add('snapshot-item--active');
  } else {
    snapEngageVal.textContent = '—';
    snapEngageSub.textContent = 'Rate satisfaction';
    document.getElementById('snapEngage').classList.remove('snapshot-item--active');
  }

  // Tenure Category
  const years = parseFloat(getVal('totalWorkingYears'));
  if (!isNaN(years)) {
    if (years <= 1)       { snapTenureVal.textContent = 'New Hire'; snapTenureSub.textContent = '0 – 1 year'; }
    else if (years <= 3)  { snapTenureVal.textContent = 'Junior';   snapTenureSub.textContent = '1 – 3 years'; }
    else if (years <= 7)  { snapTenureVal.textContent = 'Mid';      snapTenureSub.textContent = '3 – 7 years'; }
    else if (years <= 15) { snapTenureVal.textContent = 'Senior';   snapTenureSub.textContent = '7 – 15 years'; }
    else                  { snapTenureVal.textContent = 'Veteran';  snapTenureSub.textContent = '15+ years'; }
    document.getElementById('snapTenure').classList.add('snapshot-item--active');
  } else {
    snapTenureVal.textContent = '—';
    snapTenureSub.textContent = 'Enter working years';
    document.getElementById('snapTenure').classList.remove('snapshot-item--active');
  }
}

/* ─────────────────────────────────────────────────────────────────────
   VALIDATION STATE
   ───────────────────────────────────────────────────────────────────── */
function setFieldState(input) {
  const field = input.closest('.field');
  if (!field) return;
  if (!input.value.trim()) {
    field.classList.remove('field--valid', 'field--invalid');
    return;
  }
  if (input.checkValidity()) {
    field.classList.add('field--valid');
    field.classList.remove('field--invalid');
  } else {
    field.classList.add('field--invalid');
    field.classList.remove('field--valid');
  }
}

/* ─────────────────────────────────────────────────────────────────────
   FORM LISTENERS — every input triggers workspace update
   ───────────────────────────────────────────────────────────────────── */
form.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('input',  () => { setFieldState(el); updateWorkspace(); });
  el.addEventListener('change', () => { setFieldState(el); updateWorkspace(); });
  el.addEventListener('blur',   () => { if (el.value.trim()) setFieldState(el); });
});

/* ─────────────────────────────────────────────────────────────────────
   FORM SUBMISSION — POST to Flask /predict
   ───────────────────────────────────────────────────────────────────── */
form.addEventListener('submit', async e => {
  e.preventDefault();

  // Full validation pass
  let allValid = true;
  form.querySelectorAll('input, select').forEach(el => {
    setFieldState(el);
    if (!el.checkValidity()) allValid = false;
  });

  if (!allValid) {
    gsap.to(form, { x: -5, duration: 0.08, repeat: 5, yoyo: true, ease: 'power1.inOut',
      onComplete: () => gsap.set(form, { x: 0 }) });
    return;
  }

  // Loading state
  predictBtn.classList.add('is-loading');
  predictBtn.disabled = true;
  setStatus('processing', 'Analyzing…');
  analysisBadge.className = 'status-badge status-badge--processing';
  setAiStatus('processing', 'Running attrition model…');

  // Timeline: analysis initiated
  analysisInitItem.hidden = false;
  analysisInitItem.classList.remove('activity-item--pending');
  analysisInitTime.textContent = formatTime(new Date());
  gsap.from(analysisInitItem, { opacity: 0, y: 8, duration: 0.4, ease: 'power2.out' });
  lastUpdated.textContent = formatTime(new Date());

  try {
    const formData = new FormData(form);
    const res      = await fetch('/predict', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Server error ${res.status}`);
    }
    const data = await res.json();
    handlePredictionResult(data);
  } catch (err) {
    handlePredictionError(err);
  }
});

/* ─────────────────────────────────────────────────────────────────────
   RESULT HANDLER
   ───────────────────────────────────────────────────────────────────── */
function handlePredictionResult(data) {
  predictBtn.classList.remove('is-loading');
  predictBtn.disabled = false;

  if (!data.success) { handlePredictionError(new Error(data.error || 'Unknown error')); return; }

  setStatus('done', 'Analysis Complete');
  analysisBadge.className = 'status-badge status-badge--done';
  setAiStatus('done', 'Analysis complete');
  lastUpdated.textContent = formatTime(new Date());

  // Timeline: recommendation
  recGenItem.hidden = false;
  recGenItem.classList.remove('activity-item--pending');
  recGenItem.classList.add('activity-item--complete');
  recGenTime.textContent = formatTime(new Date());
  gsap.from(recGenItem, { opacity: 0, y: 8, duration: 0.4, ease: 'power2.out' });

  // Remove old result banner if re-submitting
  document.getElementById('resultBanner')?.remove();

  const isAttrition = data.prediction === 'Yes';
  const riskColors  = { High: '#ff4444', Medium: '#ff9500', Low: '#30d158' };
  const riskColor   = riskColors[data.risk_level] || '#fff';

  const factorsHTML = (data.top_factors || []).map(f => `
    <div class="result-factor">
      <span class="result-factor__name">${f.feature.replace(/([A-Z])/g, ' $1').trim()}</span>
      <div class="result-factor__bar-wrap">
        <div class="result-factor__bar">
          <div class="result-factor__fill" style="width:${Math.min(f.importance * 3, 100)}%"></div>
        </div>
        <span class="result-factor__pct">${f.importance}%</span>
      </div>
    </div>`).join('');

  const banner = document.createElement('div');
  banner.id        = 'resultBanner';
  banner.className = 'result-banner';
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-live', 'polite');
  banner.innerHTML = `
    <div class="result-banner__header">
      <div class="result-banner__verdict result-banner__verdict--${isAttrition ? 'yes' : 'no'}">
        <i class="fa-solid fa-${isAttrition ? 'triangle-exclamation' : 'circle-check'}"></i>
        <span>Attrition Risk: <strong>${data.prediction}</strong></span>
      </div>
      <button class="result-banner__close" onclick="this.closest('.result-banner').remove()" aria-label="Dismiss">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="result-banner__body">
      <div class="result-banner__metric">
        <span class="result-banner__metric-label">Risk Probability</span>
        <span class="result-banner__metric-value" style="color:${riskColor}">${data.probability_yes}%</span>
      </div>
      <div class="result-banner__metric">
        <span class="result-banner__metric-label">Risk Level</span>
        <span class="result-banner__metric-value" style="color:${riskColor}">${data.risk_level}</span>
      </div>
      <div class="result-banner__metric">
        <span class="result-banner__metric-label">Retention Probability</span>
        <span class="result-banner__metric-value">${data.probability_no}%</span>
      </div>
    </div>
    <div class="result-banner__factors">
      <p class="result-banner__factors-title">Top Influencing Factors</p>
      ${factorsHTML}
    </div>
    <p class="result-banner__model">Model: ${data.model_type || 'RandomForest'}</p>`;

  const predictAction = document.querySelector('.predict-action');
  predictAction.parentNode.insertBefore(banner, predictAction);
  gsap.from(banner, { opacity: 0, y: 16, duration: 0.5, ease: 'power2.out' });
  setTimeout(() => banner.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);

  updateRecommendationsFromResult(data);
}

function handlePredictionError(err) {
  predictBtn.classList.remove('is-loading');
  predictBtn.disabled = false;
  setStatus('idle', 'Error — Retry');
  setAiStatus('idle', 'Processing failed');
  console.error('Prediction API error:', err);

  document.getElementById('resultBanner')?.remove();
  const banner = document.createElement('div');
  banner.id = 'resultBanner';
  banner.className = 'result-banner result-banner--error';
  banner.innerHTML = `
    <div class="result-banner__header">
      <div class="result-banner__verdict"><i class="fa-solid fa-circle-xmark"></i><span>Prediction Failed</span></div>
      <button class="result-banner__close" onclick="this.closest('.result-banner').remove()"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <p style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:8px;">${err.message}</p>`;
  const predictAction = document.querySelector('.predict-action');
  predictAction.parentNode.insertBefore(banner, predictAction);
  gsap.from(banner, { opacity: 0, y: 10, duration: 0.4, ease: 'power2.out' });
}

function updateRecommendationsFromResult(data) {
  const setPriority = (id, level) => {
    const badge = document.getElementById(id)?.querySelector('.rec-preview-item__priority');
    if (!badge) return;
    badge.className = `rec-preview-item__priority rec-preview-item__priority--${level.toLowerCase()}`;
    badge.textContent = level;
  };
  if (data.risk_level === 'High') {
    setPriority('recComp', 'High'); setPriority('recWork', 'High'); setPriority('recManager', 'High');
    const recManagerDesc = document.querySelector('#recManager .rec-preview-item__desc');
    if (recManagerDesc) recManagerDesc.textContent = 'Urgent — schedule within 48 hours';
  } else if (data.risk_level === 'Medium') {
    setPriority('recComp', 'Med'); setPriority('recWork', 'Med'); setPriority('recManager', 'Low');
  } else {
    setPriority('recComp', 'Low'); setPriority('recWork', 'Low'); setPriority('recManager', 'Low');
  }
  gsap.from(['#recComp','#recWork','#recManager'], { opacity: 0, y: 6, duration: 0.5, stagger: 0.1, ease: 'power2.out' });
}

/* ─────────────────────────────────────────────────────────────────────
   ENTRANCE ANIMATIONS
   ───────────────────────────────────────────────────────────────────── */
function runEntranceAnimations() {
  gsap.from('.form-section', { opacity: 0, y: 20, duration: 0.6, stagger: 0.1, ease: 'power2.out', delay: 0.3 });
  gsap.from(['.analysis-card', '.snapshot-widget', '.recommendations-preview'],
    { opacity: 0, x: 20, duration: 0.7, stagger: 0.15, ease: 'power2.out', delay: 0.5 });
  gsap.from('.navbar__logo', { opacity: 0, x: -12, duration: 0.5, ease: 'power2.out', delay: 0.05 });
}

/* ─────────────────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  updateWorkspace();
  runEntranceAnimations();
  document.getElementById('initTime').textContent = formatTime(new Date());
});