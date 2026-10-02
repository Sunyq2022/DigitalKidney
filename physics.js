/* Exact zero-order-hold recurrence from the manuscript's vascular–tubular model. */
(function (root) {
  'use strict';
  function concentration(ca, parameters, dt) {
    const [fp, vp, ft, tt] = parameters;
    if (!(vp > 0 && tt > 0 && dt > 0 && fp >= 0 && ft >= 0 && fp + ft > 0)) throw new Error('Invalid physical parameters.');
    const a = (fp + ft) / vp, b = 1 / tt, ea = Math.exp(-a * dt), eb = Math.exp(-b * dt);
    const difference = Math.abs(a - b) < 1e-8 ? dt * ea : (eb - ea) / (a - b);
    const coupling = ft / vp * difference;
    const b1 = fp / a * (1 - ea);
    const b2 = ft / vp * fp / a * ((1 - eb) / b - difference);
    let cp = 0, ct = 0;
    return ca.map((value, index) => {
      if (index) {
        const oldCp = cp;
        cp = ea * cp + b1 * ca[index - 1];
        ct = coupling * oldCp + eb * ct + b2 * ca[index - 1];
      }
      return cp + ct;
    });
  }
  function effective(baseline, severity) {
    return [baseline[0] * (1 - severity[0]), baseline[1], baseline[2] * (1 - severity[1]), baseline[3] * (1 + 2 * severity[2]), ...baseline.slice(4)];
  }
  function enhancement(ca, parameters, dt, relaxivity) {
    const [, , , , t1, tr, angle] = parameters, cosine = Math.cos(angle * Math.PI / 180);
    const signals = concentration(ca, parameters, dt).map(c => {
      const e = Math.exp(-tr * (1 / t1 + relaxivity * c));
      return (1 - e) / (1 - cosine * e);
    });
    return signals.map(value => value / signals[0] - 1);
  }
  function quantile(values, q) {
    if (!values.length || q < 0 || q > 1) throw new Error('Invalid quantile.');
    const sorted = values.slice().sort((a, b) => a - b), index = (sorted.length - 1) * q;
    const low = Math.floor(index), high = Math.ceil(index);
    return sorted[low] + (index - low) * (sorted[high] - sorted[low]);
  }
  function backgroundFix(fields, baseline, q, clip = true) {
    const offset = [0, 1, 2].map(k => quantile(fields.map(value => value[k]), q));
    const denom = [1 - offset[0], 1 - offset[1], 1 + 2 * offset[2]];
    if (denom.some(value => value <= 0)) throw new Error('Singular background transform.');
    const corrected = fields.map(value => value.map((v, k) => clip ? Math.max(0, (v - offset[k]) / denom[k]) : (v - offset[k]) / denom[k]));
    return {severity: corrected, baseline: effective(baseline, offset), offset};
  }
  const api = {concentration, effective, enhancement, quantile, backgroundFix};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DigitalKidneyPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
