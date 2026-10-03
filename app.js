/* Browser-only educational forward simulation. No patient data or network inference. */
(function () {
  'use strict';
  const data = window.DigitalKidneyData, physics = window.DigitalKidneyPhysics;
  const slider = document.getElementById('severity'), distribution = document.getElementById('distribution');
  const colors = {normal: '#92a5a2', abnormal: '#cf942e', corrected: '#087e73'};
  let mechanism = 'flow';
  function severityVector(level) {
    return {flow: [level, 0, 0], filtration: [0, level, 0], transit: [0, 0, level], mixed: [level, level, level / 2]}[mechanism];
  }
  function plot(series) {
    const svg = document.getElementById('signal-chart'), W = 740, H = 330, margin = {left: 53, right: 20, top: 24, bottom: 47};
    const ymax = Math.max(.1, ...Object.values(series).flat()) * 1.1;
    const sx = value => margin.left + value / 300 * (W - margin.left - margin.right);
    const sy = value => H - margin.bottom - value / ymax * (H - margin.top - margin.bottom);
    const elements = [];
    for (let i = 0; i <= 4; i++) {
      const y = ymax * i / 4;
      elements.push(`<line x1="${margin.left}" y1="${sy(y)}" x2="${W - margin.right}" y2="${sy(y)}" stroke="#e8efeb"/><text x="${margin.left - 10}" y="${sy(y) + 4}" text-anchor="end" fill="#728881" font-size="12">${y.toFixed(2)}</text>`);
    }
    for (let t = 0; t <= 300; t += 60) elements.push(`<text x="${sx(t)}" y="${H - 22}" text-anchor="middle" fill="#728881" font-size="12">${t}</text>`);
    elements.push(`<text x="${W / 2}" y="${H - 1}" text-anchor="middle" fill="#597078" font-size="12">Time (s)</text><text x="${margin.left}" y="12" fill="#597078" font-size="11">S / S₀ − 1</text>`);
    for (const [name, values] of Object.entries(series)) {
      const path = values.map((value, i) => `${i ? 'L' : 'M'}${sx(data.model.times[i]).toFixed(3)},${sy(value).toFixed(3)}`).join(' ');
      elements.push(`<path d="${path}" fill="none" stroke="${colors[name]}" stroke-width="${name === 'corrected' ? 2.1 : 2.8}" ${name === 'corrected' ? 'stroke-dasharray="6 5"' : ''}/>`);
    }
    svg.innerHTML = elements.join('');
  }
  function kidneyArt(severity, diffuse) {
    const canvas = document.getElementById('hero-kidney'), ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let seed = 4126;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const points = [];
    for (let i = 0; i < 5600; i++) {
      const x = (random() * 2 - 1), y = (random() * 2 - 1), z = random() * 2 - 1;
      if (x * x / .75 + y * y / .96 + z * z / .36 > 1 || ((x - .79) ** 2 / .42 + y * y / .52 < 1)) continue;
      const px = 330 + x * 191 + z * 60 + y * 15, py = 301 + y * 215 + z * 14;
      const local = (x + .44) ** 2 + (y - .29) ** 2 < .17;
      points.push({x: px, y: py, z, affected: diffuse || local, opacity: .30 + .62 * (z + 1) / 2});
    }
    points.sort((a, b) => a.z - b.z);
    for (const p of points) {
      const color = p.affected && severity > .01 ? `rgba(206,151,53,${p.opacity * (.55 + severity / 2)})` : `rgba(13,123,111,${p.opacity})`;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5 + (p.z + 1) * .75, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#98b8ad'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(180, 437); ctx.lineTo(84, 500); ctx.lineTo(178, 500); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#597078'; ctx.font = '11px sans-serif'; ctx.fillText('SCHEMATIC POINT FIELD', 82, 519);
  }
  function render() {
    const level = Number(slider.value), severity = severityVector(level), diffuse = distribution.value === 'diffuse';
    document.getElementById('severity-value').textContent = level.toFixed(2);
    const fields = Array.from({length: 512}, (_, i) => diffuse || i >= 307 ? severity.slice() : [0, 0, 0]);
    const corrected = physics.backgroundFix(fields, data.model.baseline, .2);
    const before = physics.effective(data.model.baseline, severity);
    const after = physics.effective(corrected.baseline, corrected.severity[511]);
    const normal = physics.enhancement(data.model.aif, data.model.baseline, data.model.dt, data.model.relaxivity);
    const abnormal = physics.enhancement(data.model.aif, before, data.model.dt, data.model.relaxivity);
    const transformed = physics.enhancement(data.model.aif, after, data.model.dt, data.model.relaxivity);
    plot({normal, abnormal, corrected: transformed});
    const error = Math.max(...abnormal.map((value, i) => Math.abs(value - transformed[i])));
    const cells = [['Flow Fₚ', before[0].toFixed(4), 's⁻¹'], ['Filtration Fₜ', before[2].toFixed(4), 's⁻¹'], ['Transit Tₜ', before[3].toFixed(1), 's']];
    document.getElementById('parameter-grid').innerHTML = cells.map(([label, value, unit]) => `<div><span>${label}</span><strong>${value}</strong><small>${unit} · effective parameter</small></div>`).join('');
    document.getElementById('gauge-heading').textContent = diffuse ? 'Diffuse change can shift into the estimated baseline' : 'A normal background preserves the focal perturbation';
    document.getElementById('gauge-description').textContent = diffuse ? `Corrected severity at this point is (${corrected.severity[511].map(v => v.toFixed(2)).join(', ')}), while the baseline becomes Fₚ⁰=${corrected.baseline[0].toFixed(4)}, Fₜ⁰=${corrected.baseline[2].toFixed(4)}, Tₜ⁰=${corrected.baseline[3].toFixed(1)}. Zero corrected severity does not establish physiological recovery.` : 'With sufficient normal background, the q=0.20 quantile is zero and the focal perturbation and effective parameters are preserved. This illustrative example has no fitting error or calibration noise.';
    document.querySelector('.gauge-message').classList.toggle('diffuse', diffuse);
    document.getElementById('gauge-error').textContent = `Maximum difference between perturbed and transformed curves: ${error.toExponential(2)} · equivalent transformation`;
    kidneyArt(level, diffuse);
  }
  for (const button of document.querySelectorAll('[data-mechanism]')) button.addEventListener('click', () => {
    mechanism = button.dataset.mechanism;
    for (const other of document.querySelectorAll('[data-mechanism]')) other.setAttribute('aria-pressed', String(other === button));
    render();
  });
  slider.addEventListener('input', render); distribution.addEventListener('change', render);
  document.getElementById('reset').addEventListener('click', () => {
    slider.value = '0.4'; distribution.value = 'focal'; document.querySelector('[data-mechanism="flow"]').click();
  });
  function references() {
    const term = document.getElementById('reference-filter').value.trim().toLowerCase();
    const items = data.sources.filter(source => `${source.title} ${source.authors} ${source.venue}`.toLowerCase().includes(term));
    const list = document.getElementById('reference-list'); list.replaceChildren();
    for (const source of items) {
      const li = document.createElement('li'), a = document.createElement('a'), small = document.createElement('small');
      a.textContent = source.title; a.href = source.url; small.textContent = `${source.authors || ''} · ${source.venue}`;
      li.append(a, small); list.append(li);
    }
    document.getElementById('reference-count').textContent = `${items.length} / ${data.sources.length} sources`;
  }
  document.getElementById('reference-filter').addEventListener('input', references);
  function currentEvidence() {
    const v = data.current_study, target = document.getElementById('current-results');
    if (!v || !target) return;
    target.innerHTML = `<article class="result-card accent"><span class="small-label">Quality-guided reference · untuned replication</span><div class="large-number">${v.DICE} <span>Dice</span></div><h3>Paired gain under noise and calibration bias</h3><p>${v.N} MRI examinations and ${Number(v.FITS).toLocaleString('en-US')} method–scenario fits; joint inversion with a weak prior achieved ${v.BASE}.</p><div class="result-detail">Paired difference ${v.DELTA} [${v.LO}, ${v.HI}]<br>Functional truth and regional observations are simulated.</div></article><article class="result-card"><span class="small-label">Simulated normal controls</span><div class="large-number">${v.BASEFP}% <span>→</span> ${v.FP}%</div><h3>False positives and low-noise performance</h3><p>Normal, flow, filtration, mixed and transit scenarios are evaluated for each examination. The figure includes stronger priors, 300-step refinement and the full likelihood chart.</p><div class="result-detail">Simulated false positives do not establish patient specificity.</div></article><article class="result-card"><span class="small-label">Isotope split function · 60 reserved participants</span><div class="large-number">8.50 <span>pp MAE</span></div><h3>A measured reference for the whole-organ component</h3><p>Equal split: 16.56 pp; volume proportion: 6.26 pp. Physiological minus volume MAE: 2.23 pp [−0.42, 5.11].</p><div class="result-detail">No advantage over volume established; absolute GFR and spatial injury remain unvalidated.</div></article>`;
  }
  currentEvidence();
  references(); render();
})();
