/* =====================================================================
   ATTRISENSE AI — script.js
   Premium storytelling animations: GSAP ScrollTrigger + Intersection Observer
   ===================================================================== */

/* ── 1. GSAP SETUP ──────────────────────────────────────────────────── */
gsap.registerPlugin(ScrollTrigger);

/* ── 2. NAVBAR ──────────────────────────────────────────────────────── */
const navbar    = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navDrawer = document.getElementById('navDrawer');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('is-scrolled', window.scrollY > 40);
}, { passive: true });

navToggle?.addEventListener('click', () => {
  const isOpen = navDrawer.classList.toggle('is-open');
  navToggle.classList.toggle('is-active', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
  navDrawer.setAttribute('aria-hidden', String(!isOpen));
  document.body.classList.toggle('nav-open', isOpen);
});

navDrawer?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navDrawer.classList.remove('is-open');
    navToggle.classList.remove('is-active');
    navToggle.setAttribute('aria-expanded', 'false');
    navDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('nav-open');
  });
});

// Smooth scroll for anchor links
document.querySelectorAll('.scroll-link, a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const hash = link.getAttribute('href');
    if (!hash || hash === '#') return;
    const target = document.querySelector(hash);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

/* ── 3. JOURNEY CARD — cycling highlight ─────────────────────────────── */
const journeySteps = document.querySelectorAll('.journey-step');
let currentStep = 0;

function activateStep(index) {
  journeySteps.forEach((s, i) => s.classList.toggle('is-active', i === index));
}

if (journeySteps.length) {
  activateStep(0);
  setInterval(() => {
    currentStep = (currentStep + 1) % journeySteps.length;
    activateStep(currentStep);
  }, 1800);
}

/* ── 4. RISK RING ANIMATION ──────────────────────────────────────────── */
const riskArc = document.getElementById('riskArc');
const riskPct = document.getElementById('riskPct');

function animateRisk(targetPct) {
  const circ = 314.16; // 2 * π * 50
  const offset = circ - (targetPct / 100) * circ;

  if (riskArc) {
    setTimeout(() => {
      riskArc.style.strokeDashoffset = offset;
    }, 300);
  }

  if (riskPct) {
    const duration = 1600;
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      riskPct.textContent = Math.round(eased * targetPct);
      if (t < 1) requestAnimationFrame(tick);
      else riskPct.textContent = targetPct;
    }
    setTimeout(() => requestAnimationFrame(tick), 300);
  }
}

// Trigger when risk card scrolls into view
const riskCard = document.querySelector('.risk-card');
if (riskCard) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateRisk(78);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  observer.observe(riskCard);
}

/* ── 5. VERTICAL FLOW — scroll-driven step reveal ────────────────────── */
const flowSteps   = document.querySelectorAll('.flow-step');
const flowLineFill = document.getElementById('flowLineFill');

if (flowSteps.length && flowLineFill) {
  ScrollTrigger.create({
    trigger: '#how-it-works',
    start: 'top 80%',
    end: 'bottom 20%',
    scrub: 0.5,
    onUpdate(self) {
      const pct = Math.min(self.progress * 100, 100);
      flowLineFill.style.height = pct + '%';

      const activeIndex = Math.floor(self.progress * flowSteps.length);
      flowSteps.forEach((step, i) => {
        step.classList.toggle('is-active', i <= activeIndex - 1);
      });
    }
  });

  // Initial animate first step
  ScrollTrigger.create({
    trigger: '#how-it-works',
    start: 'top 75%',
    once: true,
    onEnter() {
      flowSteps[0]?.classList.add('is-active');
    }
  });
}

/* ── 6. GSAP SECTION REVEALS ─────────────────────────────────────────── */
// Solution section
gsap.from('.solution__text', {
  scrollTrigger: { trigger: '.solution', start: 'top 75%' },
  opacity: 0, y: 40, duration: 0.9, ease: 'power3.out'
});
gsap.from('.risk-card', {
  scrollTrigger: { trigger: '.solution', start: 'top 70%' },
  opacity: 0, y: 50, duration: 1, ease: 'power3.out', delay: 0.2
});

// Signal nodes stagger
gsap.from('.signal-node', {
  scrollTrigger: { trigger: '.signals', start: 'top 70%' },
  opacity: 0,
  scale: 0.6,
  duration: 0.6,
  stagger: { each: 0.06, from: 'random' },
  ease: 'back.out(1.4)'
});
gsap.from('.signal-center', {
  scrollTrigger: { trigger: '.signals', start: 'top 70%' },
  opacity: 0, scale: 0.5, duration: 0.8, ease: 'back.out(1.6)'
});

// Analytics cards
gsap.from('.insight-card', {
  scrollTrigger: { trigger: '.analytics-preview', start: 'top 70%' },
  opacity: 0, y: 35,
  duration: 0.8, ease: 'power3.out',
  stagger: 0.12
});

// Recs
gsap.from(['.rec-flow-block', '.rec-card'], {
  scrollTrigger: { trigger: '.recs', start: 'top 70%' },
  opacity: 0, y: 28,
  duration: 0.75, ease: 'power3.out',
  stagger: 0.1
});

// Impact title word-by-word
gsap.from('.impact__word', {
  scrollTrigger: { trigger: '.impact', start: 'top 70%' },
  opacity: 0, y: 60, rotateX: -20,
  transformOrigin: 'top center',
  duration: 0.85,
  ease: 'power4.out',
  stagger: 0.15
});
gsap.from('.impact__sub', {
  scrollTrigger: { trigger: '.impact', start: 'top 65%' },
  opacity: 0, y: 24,
  duration: 0.8, ease: 'power3.out', delay: 0.5
});

/* ── 7. DEPT BAR ANIMATIONS ──────────────────────────────────────────── */
const deptBars = document.querySelectorAll('.dept-bar');
if (deptBars.length) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.dept-bar__fill').forEach(fill => {
          const pct = fill.closest('.dept-bar').dataset.pct;
          fill.style.width = pct + '%';
        });
        observer.unobserve(entry.target.closest('.insight-card'));
      }
    });
  }, { threshold: 0.4 });
  deptBars[0]?.closest('.insight-card') && observer.observe(deptBars[0].closest('.insight-card'));
}

/* ── 8. OVERTIME BAR ANIMATION ────────────────────────────────────────── */
const overtimeVis = document.querySelector('.overtime-vis');
if (overtimeVis) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-animated');
        // Manually set heights since CSS var approach
        const highBar = entry.target.querySelector('.overtime-col--high .overtime-col__bar');
        const lowBar  = entry.target.querySelector('.overtime-col--low .overtime-col__bar');
        setTimeout(() => {
          if (highBar) highBar.style.height = '80px';
          if (lowBar)  lowBar.style.height = '34px';
        }, 200);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  observer.observe(overtimeVis);
}

/* ── 9. SALARY BAR ANIMATION ──────────────────────────────────────────── */
const salaryBands = document.querySelectorAll('.salary-band__fill');
if (salaryBands.length) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.salary-band__fill').forEach(fill => {
          const w = getComputedStyle(fill).getPropertyValue('--w').trim();
          fill.style.width = w;
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  salaryBands[0]?.closest('.insight-card') && observer.observe(salaryBands[0].closest('.insight-card'));
}

/* ── 10. RETENTION LINE ANIMATION ────────────────────────────────────── */
const retentionLine = document.querySelector('.retention-line');
const retentionDot  = document.querySelector('.retention-dot');
if (retentionLine) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        retentionLine.classList.add('is-animated');
        retentionDot?.classList.add('is-animated');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  observer.observe(retentionLine.closest('.insight-card'));
}

/* ── 11. IMPACT STAT COUNTERS ────────────────────────────────────────── */
function animateCounter(el) {
  const target   = parseFloat(el.dataset.count);
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const suffix   = el.dataset.suffix || '';
  const duration = 1800;
  const start    = performance.now();

  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (eased * target).toFixed(decimals) + suffix;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target.toFixed(decimals) + suffix;
  }
  requestAnimationFrame(tick);
}

const counterEls = document.querySelectorAll('[data-count]');
if (counterEls.length) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counterEls.forEach(el => observer.observe(el));
}

/* ── 12. SIGNALS — hover detail ──────────────────────────────────────── */
const signalDetail = document.getElementById('signalDetail');
const featureInfo = {
  'Age':                    'Younger employees (18–30) show significantly higher attrition rates.',
  'Monthly Income':         'Lowest salary band has 42% attrition — the single strongest predictor.',
  'Overtime':               'Sustained overtime more than doubles resignation probability.',
  'Job Satisfaction':       'Low satisfaction scores are among the top 3 attrition drivers.',
  'Work-Life Balance':      'Poor work-life balance correlates strongly with early exit decisions.',
  'Years At Company':       'The 2–4 year tenure window is the highest-risk period for exits.',
  'Environment Satisfaction':'Workplace environment dissatisfaction accelerates disengagement.',
  'Distance From Home':     'Long commutes compound other risk factors but are rarely standalone triggers.',
  'Performance Rating':     'Both very high and very low performers show elevated attrition rates.',
  'Job Role':               'Sales Representatives carry the highest role-specific attrition in the dataset.',
  'Department':             'Sales and Support departments account for the majority of attrition cases.',
  'Education':              'Education level modulates income expectations and satisfaction thresholds.',
};

document.querySelectorAll('.signal-node').forEach(node => {
  const feature = node.dataset.feature;
  node.addEventListener('mouseenter', () => {
    if (signalDetail && featureInfo[feature]) {
      signalDetail.innerHTML = `<strong style="color:var(--white)">${feature}:</strong> ${featureInfo[feature]}`;
    }
  });
  node.addEventListener('mouseleave', () => {
    if (signalDetail) {
      signalDetail.innerHTML = '<p class="signals__detail-hint">Hover a signal to learn more</p>';
    }
  });
});

/* ── 13. DEPT BARS — re-trigger properly ────────────────────────────── */
const deptBarCard = document.querySelector('.dept-bars')?.closest('.insight-card');
if (deptBarCard) {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.dept-bar').forEach(bar => {
          const pct = bar.dataset.pct;
          const fill = bar.querySelector('.dept-bar__fill');
          if (fill) fill.style.width = pct + '%';
        });
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  obs.observe(deptBarCard);
}

/* ── 14. SALARY BANDS — re-trigger properly ─────────────────────────── */
const salaryCard = document.querySelector('.salary-vis')?.closest('.insight-card');
if (salaryCard) {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.salary-band__fill').forEach(fill => {
          const parentStyle = fill.getAttribute('style');
          const match = parentStyle?.match(/--w:\s*([\d.]+%)/);
          if (match) fill.style.width = match[1];
        });
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  obs.observe(salaryCard);
}

/* ── 15. HOW IT WORKS — GSAP section heads ───────────────────────────── */
gsap.from('.how__head', {
  scrollTrigger: { trigger: '.how-it-works', start: 'top 80%' },
  opacity: 0, y: 30, duration: 0.8, ease: 'power3.out'
});

gsap.from('.signals__head', {
  scrollTrigger: { trigger: '.signals', start: 'top 80%' },
  opacity: 0, y: 30, duration: 0.8, ease: 'power3.out'
});

gsap.from('.recs__head', {
  scrollTrigger: { trigger: '.recs', start: 'top 80%' },
  opacity: 0, y: 30, duration: 0.8, ease: 'power3.out'
});

gsap.from('.analytics-preview__head', {
  scrollTrigger: { trigger: '.analytics-preview', start: 'top 80%' },
  opacity: 0, y: 30, duration: 0.8, ease: 'power3.out'
});

/* ── 16. IMPACT STATS ENTRANCE ───────────────────────────────────────── */
gsap.from('.impact__stat', {
  scrollTrigger: { trigger: '.impact__stats', start: 'top 80%' },
  opacity: 0, y: 24,
  duration: 0.7, ease: 'power3.out',
  stagger: 0.1
});

/* ── 17. FOOTER REVEAL ───────────────────────────────────────────────── */
gsap.from('.footer__brand, .footer__col', {
  scrollTrigger: { trigger: '.footer', start: 'top 90%' },
  opacity: 0, y: 20,
  duration: 0.6, ease: 'power3.out',
  stagger: 0.08
});