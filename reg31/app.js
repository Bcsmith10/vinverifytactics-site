/* REG 31 Assistant — private tool. Everything runs in this browser; nothing is uploaded.
   Verifier info, job log and the unfinished draft live in this phone's localStorage. Photos are never saved. */
(function () {
'use strict';

const $ = (id) => document.getElementById(id);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------------- VIN helpers ---------------- */
const TR = {A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9};
const WT = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
function vinChars(v) { return /^[A-HJ-NPR-Z0-9]{17}$/.test(v); }
function checkDigit(v) {
  let s = 0;
  for (let i = 0; i < 17; i++) {
    const c = v[i];
    const val = /\d/.test(c) ? +c : TR[c];
    if (val === undefined) return null;
    s += val * WT[i];
  }
  const r = s % 11;
  return r === 10 ? 'X' : String(r);
}
function vinValid(v) { return vinChars(v) && checkDigit(v) === v[8]; }
const YEARSEQ = 'ABCDEFGHJKLMNPRSTVWXY123456789';
function yearsFromVin(v) {
  if (v.length < 10) return [];
  const i = YEARSEQ.indexOf(v[9]);
  if (i < 0) return [];
  return [1980 + i, 2010 + i];
}

/* ---------------- State collection ---------------- */
const IDS = ['vin','cat','year','make','model','btm','wheels','motive','gvwr','engno','ohv_type','estwt','camplen','campwid','axles',
  'plate_type','plate_no','plate_state','plate_exp','s1','s1_other','s2','s2_other','s3','s3_other','s4_vin','s4_eng','s5','s5_page',
  's6_status','s6_ind','odo','odo_unit','odo_digits','docvin','s8_type','s8_cond','s9','s9_family','btmva','remarks',
  'loc_mode','loc_street','loc_city','loc_state','exec_at','exec_date'];
const CHECKS = ['odo_none','f_door','f_air'];

function collect() {
  const S = {};
  IDS.forEach((id) => { S[id] = ($(id).value || '').trim(); });
  CHECKS.forEach((id) => { S[id] = $(id).checked; });
  S.vin = S.vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
  S.docvin = S.docvin.toUpperCase().replace(/[^A-Z0-9]/g, '');
  S.gate = Array.from(document.querySelectorAll('.gate')).map((c) => c.checked);
  S.st = settings();
  return S;
}
function settings() { return Object.assign({ name:'', lic:'', addr:'', city:'', state:'CA', phone:'', email:'' }, LS.get('vvt_reg31_settings', {})); }

/* ---------------- Validation ---------------- */
function evaluate(S) {
  const stops = [], miss = [], warns = [];
  const yr = parseInt(S.year, 10) || 0;
  const needStar = (code, what) => { if (['illegible','cannot','altered','missing','none'].includes(code)) stops.push(what + ' is marked "' + code + '" — the form says refer to CHP.'); };

  if (S.gate.some(Boolean)) stops.push('A pre-check item applies. Per the REG 31 notes, this vehicle goes to the DMV or CHP, not a private verifier.');

  // VIN
  if (!S.vin) miss.push('VIN');
  else if (S.vin.length < 17) {
    if (yr >= 1981 || !yr) stops.push('VIN is shorter than 17 characters on a 1981-or-newer vehicle — refer to CHP.');
  } else if (!vinChars(S.vin)) miss.push('VIN has an invalid character (I, O and Q are never used)');
  else if (checkDigit(S.vin) !== S.vin[8]) {
    if (yr >= 1981 || !yr) stops.push('VIN check digit does not pass (position 9 should be ' + checkDigit(S.vin) + '). Re-read the VIN on the car; if it truly reads this way, it is a VIN problem — refer to CHP.');
  }

  if (!S.cat) miss.push('Category');
  if (!S.year) miss.push('Model year');
  if (!S.make) miss.push('Make');
  if (!S.model) miss.push('Model or series');
  if (!S.btm) miss.push('Body type model (BTM)');
  if (!S.wheels) miss.push('Number of wheels');
  if (!S.motive) miss.push('Motive power (fuel)');
  if ((S.cat === 'moto' || S.cat === 'ohv') && !S.engno) miss.push('Engine number (required for motorcycles and OHVs)');
  if (S.cat === 'ohv' && !S.ohv_type) miss.push('OHV complying / non-complying');
  if (S.plate_type === 'plate' && !S.plate_no) miss.push('Plate number');
  if (S.cat === 'moto') warns.push('Motorcycle: used motorcycles with no California record, and motorcycles with engine changes, must go to CHP (see the form notes).');

  ['s1','s2','s3'].forEach((k, i) => {
    if (!S[k]) miss.push('Section ' + (i + 1));
    else if (S[k] === 'other' && !S[k + '_other']) miss.push('Section ' + (i + 1) + ' "other" text');
  });

  if (!S.s4_vin) miss.push('Section 4 (VIN condition)'); else needStar(S.s4_vin, 'Section 4 VIN condition');
  if (S.cat === 'moto' || S.cat === 'ohv') { if (!S.s4_eng) miss.push('Section 4 (engine condition)'); else needStar(S.s4_eng, 'Section 4 engine condition'); }
  if (S.s4_vin && S.s4_vin !== 'ok' && !['illegible','cannot','altered','missing','none'].includes(S.s4_vin) && !S.remarks) miss.push('Remarks (explain the Section 4 choice)');

  if (!S.s6_status) miss.push('Section 6 (label status)');
  else if (['disagrees','illegible','altered','missing'].includes(S.s6_status)) stops.push('Section 6: the federal certification label is "' + S.s6_status + '" — the form says refer to CHP.');
  if (S.s6_status && S.s6_status !== 'pre1970' && !S.s6_ind) miss.push('Section 6 (what the label indicates)');
  if (S.s6_ind === 'importer' || S.s6_ind === 'other') stops.push('Section 6: a label showing an importer or another country\'s standards points to a grey-market import, which the form lists as a prohibited verification.');
  if (S.s6_ind === 'importer' && !S.remarks) miss.push('Remarks (importer name)');

  if (S.odo_none) { /* ok */ }
  else if (!/^\d{1,6}$/.test(S.odo)) miss.push('Odometer reading (digits only) or tick "No odometer"');

  if (!S.s8_type) miss.push('Section 8 (document type)');
  else if (S.s8_type === 'none') stops.push('No supporting ownership document — the form says this goes to DMV or CHP.');
  else if (S.s8_type === 'salvage') stops.push('A salvage certificate is not one of the permitted documents (title, MCO/MSO, SF 97-1, registration card).');
  if (S.s8_type && S.s8_type !== 'none' && !S.s8_cond) miss.push('Section 8 (document condition)');
  if (S.s8_cond === 'disagrees') warns.push('VIN on the vehicle disagrees with the document. The form has an owner Statement of Facts for this, but ask the DMV before proceeding.');
  if (S.s8_cond === 'remarks' && !S.remarks) miss.push('Remarks (explain the Section 8 choice)');

  if (!S.s9) miss.push('Section 9 (emission label)');
  else if (S.s9 === 'remarks' && !S.remarks) miss.push('Remarks (explain the Section 9 choice)');
  else if (S.s9 === 'none' && yr >= 1968 && S.cat !== 'ohv') warns.push('No emission label on a 1968-or-newer vehicle: double-check under the hood and on the radiator support, then explain in Remarks.');
  if (S.btm.toUpperCase() === 'VA' && !S.btmva) miss.push('BTM "VA" description');
  if (S.s5 === 'other' && !S.remarks) miss.push('Remarks (explain Section 5)');

  if (S.loc_mode === 'other' && (!S.loc_street || !S.loc_city || !S.loc_state)) miss.push('Where you verified (street, city, state)');
  if (!S.exec_date) miss.push('Date signed');
  const st = S.st;
  const stMiss = [];
  if (!st.name) stMiss.push('name'); if (!st.lic) stMiss.push('license #'); if (!st.addr) stMiss.push('address');
  if (!st.city) stMiss.push('city'); if (!st.state) stMiss.push('state'); if (!/\d{10}/.test((st.phone || '').replace(/\D/g, ''))) stMiss.push('10-digit phone'); if (!st.email) stMiss.push('email');
  if (stMiss.length) miss.push('Your verifier info (Settings): ' + stMiss.join(', '));

  return { stops, miss, warns };
}

function setStatus(el, cls, txt) { el.className = 'status ' + cls; el.textContent = txt; }

function refresh() {
  const S = collect();

  // visibility
  const mo = S.cat === 'moto' || S.cat === 'ohv';
  $('motoBox').classList.toggle('hidden', !mo);
  $('s4engWrap').classList.toggle('hidden', !mo);
  $('ohvBox').classList.toggle('hidden', S.cat !== 'ohv');
  $('trailerBox').classList.toggle('hidden', !['pti', 'cch', 'comm'].includes(S.cat));
  $('btmvaWrap').classList.toggle('hidden', S.btm.toUpperCase() !== 'VA');
  const plateOn = S.plate_type === 'plate';
  ['plate_no', 'plate_state', 'plate_exp'].forEach((id) => { $(id).disabled = !plateOn && S.plate_type !== 'dealer' && S.plate_type !== 'temp'; });
  $('loc_street').disabled = S.loc_mode === 'above'; $('loc_city').disabled = S.loc_mode === 'above'; $('loc_state').disabled = S.loc_mode === 'above';

  // VIN status + year choices
  const vs = $('vinStatus');
  if (!S.vin) setStatus(vs, '', '');
  else if (S.vin.length < 17) setStatus(vs, 'warnx', S.vin.length + ' of 17 characters');
  else if (!vinChars(S.vin)) setStatus(vs, 'bad', 'Invalid character — VINs never contain I, O or Q.');
  else if (checkDigit(S.vin) === S.vin[8]) setStatus(vs, 'ok', '✓ 17 characters, check digit passes.');
  else setStatus(vs, 'bad', '✗ Check digit fails (9th character should be ' + checkDigit(S.vin) + '). A typo is likely — compare to the car.');
  syncYears(S.vin);

  // doc vin compare
  const ds = $('docStatus');
  if (S.docvin && S.vin) {
    if (S.docvin === S.vin) { setStatus(ds, 'ok', '✓ Document VIN matches the vehicle VIN.'); if (!S.s8_cond && !$('s8_cond').dataset.touched) $('s8_cond').value = 'agrees'; }
    else { setStatus(ds, 'bad', '✗ Document VIN differs from the vehicle VIN.'); if (!$('s8_cond').dataset.touched) $('s8_cond').value = 'disagrees'; }
  } else setStatus(ds, '', '');

  const E = evaluate(collect());
  showList($('stopBox'), 'Do not sign this as a private verifier:', E.stops, true);
  showList($('missBox'), 'Still needed before the form can be created:', E.miss, false);
  showList($('warnBox'), 'Heads-up:', E.warns, false);
  const g = $('gateMsg');
  g.classList.toggle('hidden', !S.gate.some(Boolean));
  g.textContent = 'Refer this customer to the CHP (or DMV). Do not complete a verification.';
  $('make_pdf').disabled = E.stops.length > 0 || E.miss.length > 0;
  $('make_dnp').classList.toggle('hidden', E.stops.length === 0);
  saveDraft();
}
function showList(el, title, arr, isStop) {
  el.classList.toggle('hidden', !arr.length);
  el.innerHTML = '';
  if (!arr.length) return;
  const b = document.createElement('b'); b.textContent = title; el.appendChild(b);
  const ul = document.createElement('ul');
  arr.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
  el.appendChild(ul);
}

let lastVinForYears = null;
function syncYears(vin) {
  const sel = $('year');
  if (vin === lastVinForYears) return;
  lastVinForYears = vin;
  const keep = sel.value;
  const ys = vin.length >= 10 ? yearsFromVin(vin) : [];
  sel.innerHTML = '';
  if (!ys.length) {
    const o = document.createElement('option'); o.value = ''; o.textContent = vin.length >= 10 ? '10th digit not a model-year code' : 'Enter VIN first'; sel.appendChild(o);
    const manual = document.createElement('option'); manual.value = 'manual'; sel.appendChild(manual); sel.removeChild(manual);
    return;
  }
  const now = new Date().getFullYear();
  let pick = ys[0];
  // 7th character alphabetic => 2010 or newer (passenger cars/MPVs); numeric => 1980–2009. Confirm against the title.
  if (vin.length >= 7 && /[A-Z]/.test(vin[6])) pick = ys[1];
  if (pick > now + 1) pick = ys[0];
  ys.forEach((y) => { const o = document.createElement('option'); o.value = String(y); o.textContent = y + (y === pick ? ' (suggested)' : ''); sel.appendChild(o); });
  sel.value = (keep && ys.map(String).includes(keep)) ? keep : String(pick);
}

/* ---------------- Draft / settings / log ---------------- */
function saveDraft() {
  const S = {};
  IDS.forEach((id) => { if (id !== 'year') S[id] = $(id).value; });
  S.year = $('year').value;
  CHECKS.forEach((id) => { S[id] = $(id).checked; });
  S.gate = Array.from(document.querySelectorAll('.gate')).map((c) => c.checked);
  LS.set('vvt_reg31_draft', S);
}
function loadDraft() {
  const S = LS.get('vvt_reg31_draft', null);
  if (!S) return;
  IDS.forEach((id) => { if (S[id] !== undefined && id !== 'year') $(id).value = S[id]; });
  CHECKS.forEach((id) => { if (S[id] !== undefined) $(id).checked = !!S[id]; });
  (S.gate || []).forEach((v, i) => { const c = document.querySelectorAll('.gate')[i]; if (c) c.checked = !!v; });
  const v = ($('vin').value || '').toUpperCase();
  syncYears(v);
  if (S.year) { const o = Array.from($('year').options).find((x) => x.value === S.year); if (o) $('year').value = S.year; }
}
function today() { const d = new Date(); return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + '/' + d.getFullYear(); }

function loadSettingsUI() {
  const s = settings();
  $('st_name').value = s.name; $('st_lic').value = s.lic; $('st_addr').value = s.addr; $('st_city').value = s.city;
  $('st_state').value = s.state; $('st_phone').value = s.phone; $('st_email').value = s.email;
}
function saveSettingsUI() {
  LS.set('vvt_reg31_settings', {
    name: $('st_name').value.trim(), lic: $('st_lic').value.trim(), addr: $('st_addr').value.trim(), city: $('st_city').value.trim(),
    state: $('st_state').value.trim().toUpperCase(), phone: $('st_phone').value.trim(), email: $('st_email').value.trim()
  });
  $('settingsCard').classList.add('hidden');
  refresh();
}
function renderLog() {
  const log = LS.get('vvt_reg31_log', []);
  const box = $('logList'); box.innerHTML = '';
  if (!log.length) { box.textContent = 'No jobs yet.'; return; }
  log.slice().reverse().forEach((j) => {
    const d = document.createElement('div'); d.className = 'logitem';
    const b = document.createElement('b'); b.textContent = j.vin || '(no VIN)';
    d.appendChild(b); d.appendChild(document.createTextNode('  ' + (j.vehicle || '') + ' · ' + (j.city || '') + ' · ' + (j.date || '') + (j.dnp ? ' · REFERRED' : '')));
    box.appendChild(d);
  });
}
function logJob(S, dnp) {
  const log = LS.get('vvt_reg31_log', []);
  log.push({ date: today(), vin: S.vin, vehicle: [S.year, S.make, S.model].filter(Boolean).join(' '), city: S.loc_mode === 'above' ? S.st.city : S.loc_city, dnp: !!dnp });
  LS.set('vvt_reg31_log', log);
}
function logCsv() {
  const log = LS.get('vvt_reg31_log', []);
  const q = (v) => '"' + String(v || '').replace(/"/g, '""') + '"';
  const csv = ['date,vin,vehicle,city,referred'].concat(log.map((j) => [j.date, j.vin, j.vehicle, j.city, j.dnp ? 'yes' : ''].map(q).join(','))).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'reg31-job-log.csv'; a.click();
}

/* ---------------- PDF ---------------- */
// Coordinates are PDF points measured from the TOP-LEFT of Letter page 1 (Rev. 5/2025). [x, top, boxSize]
const BOX = {
  plate: { none: [24.2,125.2,7.4], dealer: [66.4,125.2,7.4], temp: [113.5,125.2,7.4] },
  ohv: { comp: [521.7,120.9,5.9], noncomp: [521.7,127.9,5.9] },
  cat: { auto: [401.3,146.2,5.9], comm: [401.3,154.0,5.9], pti: [449.7,146.2,5.9], cch: [449.7,154.0,5.9], moto: [528.5,146.2,5.9], ohv: [528.5,154.0,5.9] },
  s1: { windshield: [24.2,222.6,7.4], bodyL: [24.2,233.4,7.4], bodyR: [24.2,244.1,7.4], engine: [24.2,254.9,7.4], door: [150.3,222.6,7.4], steering: [150.3,233.4,7.4], firewall: [150.3,244.1,7.4], other: [150.3,254.9,7.4] },
  s2: { notvisible: [260.2,222.6,7.4], rosette: [260.2,233.4,7.4], round: [260.2,244.1,7.4], other: [260.2,254.9,7.4], adhesive: [358.7,222.6,7.4], na: [358.7,233.4,7.4], screws: [358.7,244.1,7.4], stamped: [358.7,254.9,7.4] },
  s3: { plate: [433.2,222.6,7.4], body: [433.2,233.4,7.4], frame: [433.2,244.1,7.4], other: [433.2,254.9,7.4], label: [506.2,222.6,7.4] },
  s4: { // [vinBox, engBox]
    ok: [[24.2,292.9],[40.9,292.9]], altered: [[24.2,304.7],[40.9,304.7]],
    illegible: [[132.7,291.5],[149.2,291.5]], missing: [[132.7,303.3],[149.3,303.3]],
    cannot: [[238.3,291.5],[255.0,291.5]], none: [[238.3,303.3],[255.0,303.3]],
    fo: [[344.0,291.5],[360.7,291.5]], remarks: [[344.0,303.3],[360.7,303.3]]
  },
  s5: { digit10: [449.7,282.6,7.4], natb: [449.7,293.4,7.4], other: [449.7,304.2,7.4] },
  s6s: { agrees: [24.2,330.7,7.4], disagrees: [24.2,341.5,7.4], illegible: [24.2,352.3,7.4], altered: [24.2,363.1,7.4], missing: [119.2,330.7,7.4], pre1970: [119.2,341.5,7.4], remarks: [119.2,352.3,7.4] },
  s6i: { fmvss: [201.0,330.7,7.4], importer: [201.0,341.5,7.4], other: [201.0,353.3,7.4], lsv: [201.0,364.1,7.4] },
  odoUnit: { miles: [423.2,379.7,7.4], km: [423.2,390.5,7.4] },
  odoDig: { 5: [495.7,379.7,7.4], 6: [495.7,390.5,7.4], digital: [495.7,401.3,7.4] },
  odoNone: [88.7,405.0,4.6],
  s8none: [277.2,419.3,4.6],
  s8t: { title: [48.3,428.3,7.4], msomco: [142.5,428.3,7.4], salvage: [213.0,428.3,7.4], sf97: [311.6,428.3,7.4], reg: [436.5,428.3,7.4] },
  s8c: { agrees: [66.4,440.0,7.4], disagrees: [167.9,440.0,7.4], remarks: [281.6,440.0,7.4] },
  s9: { epa: [24.2,471.8,7.4], both: [24.2,482.6,7.4], ca: [24.2,493.3,7.4], exempt: [24.2,505.1,7.4], caohv: [283.8,471.8,7.4], dual: [283.8,482.6,7.4], u50: [283.8,493.3,7.4], sore: [283.8,504.1,7.4], remarks: [447.2,504.1,7.4], none: [540.5,504.1,7.4] },
  dnp: [24.2,548.7,9.3], door: [286.4,548.7,9.3], air: [370.2,548.7,9.3],
  at: { above: [24.2,614.7,5.9], other: [24.2,622.5,5.9] },
  agency: [128.1,633.3,5.9]
};
const COMB = [24.2,46.0,68.0,90.0,112.5,134.9,156.7,178.6,200.9,222.9,244.9,267.0,289.0,311.0,333.0,356.5,378.5,399.1]; // 17 cells
const ODO = [[206.4,232.0],[232.0,258.0],[258.0,283.6],[292.0,315.6],[315.6,338.8],[338.8,363.0]];

/* The DMV's PDF is locked against editing (printing is allowed). So we do not edit it: we render (print) the official
   pages and draw your entries on top, then save that result as a new PDF. Coordinates are points from the top-left of page 1. */
async function buildPdf(S, opts) {
  opts = opts || {};
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  const data = await (await fetch('reg31.pdf')).arrayBuffer();
  const src = await pdfjs.getDocument({ data }).promise;
  const SC = 3.5; // ~250 dpi
  const jpgs = [];
  for (let n = 1; n <= src.numPages; n++) {
    const pg = await src.getPage(n);
    const vp = pg.getViewport({ scale: SC });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjs.AnnotationMode.DISABLE }).promise;
    if (n === 1) { ctx.save(); ctx.scale(SC, SC); drawEntries(ctx, S, opts); ctx.restore(); }
    const b64 = cv.toDataURL('image/jpeg', 0.93).split(',')[1];
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    jpgs.push(u8);
  }
  const out = await PDFLib.PDFDocument.create();
  for (const j of jpgs) {
    const img = await out.embedJpg(j);
    const p = out.addPage([612, 792]);
    p.drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
  }
  out.setTitle('REG 31 Verification of Vehicle'); out.setSubject('Printed with entries; sign by hand');
  return await out.save();
}

function drawEntries(ctx, S, opts) {
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.lineCap = 'round'; ctx.textBaseline = 'alphabetic';
  const FONT = (s) => '700 ' + s + 'px Helvetica, Arial, "Liberation Sans", sans-serif';
  const text = (str, x, baseTop, size, maxW) => {
    str = String(str == null ? '' : str); if (!str) return;
    let s = size; ctx.font = FONT(s);
    if (maxW) while (s > 6 && ctx.measureText(str).width > maxW) { s -= 0.5; ctx.font = FONT(s); }
    ctx.fillText(str, x, baseTop);
  };
  const na = (v, x, baseTop, size, maxW) => text(v || 'N/A', x, baseTop, size, maxW);
  const check = (b) => {
    if (!b) return;
    const x = b[0], t = b[1], sz = b[2] || 7.4, p = Math.max(1, sz * 0.16);
    ctx.lineWidth = 1.3; ctx.beginPath();
    ctx.moveTo(x + p, t + p); ctx.lineTo(x + sz - p, t + sz - p); ctx.moveTo(x + sz - p, t + p); ctx.lineTo(x + p, t + sz - p); ctx.stroke();
  };
  const hline = (x1, x2, top) => { ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x1, top); ctx.lineTo(x2, top); ctx.stroke(); };
  const comb = (str, baseTop, size) => {
    ctx.font = FONT(size);
    for (let i = 0; i < Math.min(str.length, 17); i++) {
      const ch = str[i], cx = (COMB[i] + COMB[i + 1]) / 2;
      ctx.fillText(ch, cx - ctx.measureText(ch).width / 2, baseTop);
    }
  };

  // header
  if (S.plate_type === 'none') { check(BOX.plate.none); text('N/A', 206, 134, 11); text('N/A', 288, 134, 11); text('N/A', 329, 134, 11); }
  else {
    if (S.plate_type === 'dealer') check(BOX.plate.dealer);
    if (S.plate_type === 'temp') check(BOX.plate.temp);
    na(S.plate_no, 206, 134, 11, 76); na(S.plate_state, 288, 134, 11, 34); na(S.plate_exp, 329, 134, 11, 58);
  }
  na(S.axles, 395, 134, 11, 54);
  if (S.motive) text(S.motive === 'NA' ? 'N/A' : S.motive, 457, 134, 11, 58);
  if (S.cat === 'ohv' && S.ohv_type) check(BOX.ohv[S.ohv_type]);
  comb(S.vin, 158.2, 12.5);
  check(BOX.cat[S.cat]);
  if (S.cat === 'moto' || S.cat === 'ohv') comb(S.engno.toUpperCase(), 183.2, 12); else text('N/A', 27, 183.2, 10);
  text(S.btm.toUpperCase(), 404, 183, 12, 112);
  text(S.year, 524, 183, 12, 62);
  text(S.make, 26, 207, 11, 106);
  text(S.model, 139, 207, 11, 104);
  na(S.gvwr, 248, 207, 10.5, 56);
  text(S.wheels, 326, 207, 11, 34);
  na(S.estwt, 367, 207, 10.5, 60);
  na(S.camplen, 478, 205.8, 9.5, 36);
  na(S.campwid, 553, 205.8, 9.5, 34);

  // sections 1-3
  check(BOX.s1[S.s1]); if (S.s1 === 'other') text(S.s1_other, 191, 260.6, 8.5, 58);
  check(BOX.s2[S.s2]); if (S.s2 === 'other') text(S.s2_other, 298.5, 260.6, 8.5, 53);
  check(BOX.s3[S.s3]); if (S.s3 === 'other') text(S.s3_other, 474, 260.6, 8.5, 103);
  // 4
  if (S.s4_vin) check(BOX.s4[S.s4_vin][0]);
  if ((S.cat === 'moto' || S.cat === 'ohv') && S.s4_eng) check(BOX.s4[S.s4_eng][1]);
  // 5
  check(BOX.s5[S.s5]); if (S.s5 === 'natb' && S.s5_page) text(S.s5_page, 566, 299.5, 8.5, 22);
  // 6
  if (S.s6_status) check(BOX.s6s[S.s6_status]);
  if (S.s6_ind && S.s6_ind !== 'na') check(BOX.s6i[S.s6_ind]);
  // 7
  check(BOX.odoUnit[S.odo_unit === 'km' ? 'km' : 'miles']);
  check(BOX.odoDig[S.odo_digits]);
  if (S.odo_none) { check(BOX.odoNone); hline(207, 363, 394); }
  else {
    const d = S.odo.replace(/\D/g, '').slice(-6), pad = 6 - d.length;
    ctx.font = FONT(20);
    for (let i = 0; i < 6; i++) {
      const a = ODO[i][0], b = ODO[i][1];
      if (i < pad) hline(a + 5, b - 5, 394);
      else { const ch = d[i - pad]; ctx.fillText(ch, (a + b) / 2 - ctx.measureText(ch).width / 2, 404); }
    }
  }
  // 8
  if (S.s8_type === 'none') check(BOX.s8none); else if (S.s8_type) { check(BOX.s8t[S.s8_type]); check(BOX.s8c[S.s8_cond]); }
  // 9
  check(BOX.s9[S.s9]);
  na(S.s9_family.toUpperCase(), 391, 535, 11, 196);
  if (S.btm.toUpperCase() === 'VA') text(S.btmva, 391, 558, 9.5, 196); else text('N/A', 391, 558, 9.5);
  // remarks
  const rem = S.remarks || 'N/A';
  ctx.font = FONT(9);
  const words = rem.split(/\s+/); const lines = []; let cur = '';
  words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width <= 352) cur = t; else { lines.push(cur); cur = w; } });
  if (cur) lines.push(cur);
  lines.slice(0, 2).forEach((ln, i) => text(ln, 26, 536.5 + i * 9.6, 9));
  if (opts.dnp) check(BOX.dnp);
  if (S.f_door) check(BOX.door);
  if (S.f_air) check(BOX.air);

  // verifier block
  const st = S.st;
  text(st.name, 26, 581, 11.5, 410);
  text(st.lic, 451, 581, 11.5, 136);
  text(st.addr, 26, 604, 11, 205);
  text(st.city, 238, 604, 11, 148);
  text(st.state, 392, 604, 11, 52);
  const ph = (st.phone || '').replace(/\D/g, '');
  if (ph.length >= 10) { text(ph.slice(0, 3), 456.2, 604, 10.5); text(ph.slice(3, 6) + '-' + ph.slice(6, 10), 485, 604, 11); }
  if (S.loc_mode === 'above') { check(BOX.at.above); text('N/A', 366, 628, 10); text('N/A', 509, 628, 10); }
  else {
    check(BOX.at.other);
    text(S.loc_street, 77, 629.2, 9.5, 280);
    text(S.loc_city, 366, 628, 10.5, 138);
    text(S.loc_state, 509, 628, 10.5, 70);
  }
  check(BOX.agency); // CA Licensed Vehicle Verifier (VV)

  // owner statement (N/A), verifier email, executed at, date — signature stays blank for your hand signature
  text('N/A', 30, 688, 11); text('N/A', 310, 688, 11); text('N/A', 511, 688, 11);
  text(st.email, 27, 752, 11, 555);
  const execAt = S.exec_at || (S.loc_mode === 'above' ? st.city + ', ' + st.state : (S.loc_city + ', ' + S.loc_state));
  text(execAt, 310, 731, 11, 192);
  text(S.exec_date, 511, 731, 11, 76);
}

window.__ocr = (f,p)=>ocr(f,p); window.__vinCand = vinCandidates; window.__buildPdf = buildPdf; window.__collect = collect; window.__evaluate = evaluate;

/* ---------------- OCR (optional suggestions; you confirm everything) ---------------- */
let workerPromise = null;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function getWorker() {
  if (!workerPromise) workerPromise = (async () => {
    if (!window.Tesseract) await loadScript('vendor/tesseract/tesseract.min.js');
    const base = new URL('vendor/tesseract/', location.href).href;
    return await Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base + 'lang', gzip: true, workerBlobURL: false });
  })();
  return workerPromise;
}
async function prepCanvas(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  let lo = 255, hi = 0; const gray = new Uint8Array(c.width * c.height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) | 0; gray[j] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const rng = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = Math.max(0, Math.min(255, ((gray[j] - lo) * 255 / rng) | 0)); d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(im, 0, 0);
  return c;
}
async function ocr(file, params) {
  const w = await getWorker();
  await w.setParameters(Object.assign({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '11' }, params || {}));
  const c = await prepCanvas(file);
  const r = await w.recognize(c);
  return r.data.text || '';
}
const CONF = { '8':'B','B':'8','5':'S','S':'5','2':'Z','Z':'2','6':'G','G':'6','0':'D','D':'0','1':'L','L':'1','7':'T','T':'7','4':'A','A':'4','3':'E','E':'3' };
function vinCandidates(raw) {
  // Only whole 17-character readings are considered (no sliding windows), so a shifted or partial read can't sneak through.
  const text = raw.toUpperCase().replace(/[^A-Z0-9\n ]/g, ' ');
  const toks = text.split(/\s+/).filter(Boolean).map((t) => t.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0'));
  const pool = new Set();
  toks.forEach((t) => { if (t.length === 17) pool.add(t); });
  for (let i = 0; i < toks.length - 1; i++) {
    if (toks[i].length + toks[i + 1].length === 17) pool.add(toks[i] + toks[i + 1]);
    if (i < toks.length - 2 && toks[i].length + toks[i + 1].length + toks[i + 2].length === 17) pool.add(toks[i] + toks[i + 1] + toks[i + 2]);
  }
  const good = [], repaired = [];
  pool.forEach((w) => {
    if (vinValid(w)) { good.push(w); return; }
    if (!vinChars(w)) return;
    const fixes = [];
    for (let p = 0; p < 17; p++) {
      const alt = CONF[w[p]]; if (!alt) continue;
      const t = w.slice(0, p) + alt + w.slice(p + 1);
      if (vinValid(t)) fixes.push(t);
    }
    if (fixes.length === 1) repaired.push(fixes[0]);
  });
  // a label line such as "VIN 1N4..." can arrive glued together: accept a 17-character end or start only if it passes the check digit
  toks.forEach((t) => { if (t.length > 17 && t.length <= 21) [t.slice(-17), t.slice(0, 17)].forEach((w) => { if (vinValid(w) && !good.includes(w)) good.push(w); }); });
  const odd = toks.filter((t) => t.length >= 14 && t.length <= 20 && t.length !== 17).slice(0, 2);
  return { good: Array.from(new Set(good)).slice(0, 3), repaired: Array.from(new Set(repaired)).slice(0, 3), odd };
}
function chips(boxId, arr, onPick, cls) {
  const box = $(boxId); box.innerHTML = '';
  arr.forEach((v) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = v; b.onclick = () => onPick(v); box.appendChild(b); });
}


/* ---- Line-finding reader (reader.js) ---- */
async function fileToCanvas(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  return c;
}
async function ocrCanvas(cv, params) {
  const w = await getWorker();
  await w.setParameters(Object.assign({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '7' }, params || {}));
  const r = await w.recognize(cv);
  return (r.data.text || '').trim();
}
const VIN_WL = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
async function readVinFromLines(img, extraLines) {
  let lines = extraLines || [];
  if (!lines.length) lines = Reader.findLines(img, 1).concat(Reader.findLines(img, -1)).filter((L) => L.n >= 15 && L.n <= 24);
  lines.sort((a, b) => Math.abs(a.n - 17) - Math.abs(b.n - 17) || b.mh - a.mh);
  const res = { good: [], repaired: [], odd: [], raw: [] };
  const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9 \n]/g, ' ').split(/\s+/).filter(Boolean).map((t) => t.replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0'));
  for (const L of lines.slice(0, 6)) {
    for (const [trim, oh] of (L.n > 17 ? [[true, 64], [true, 32], [false, 64]] : [[false, 64], [false, 32]])) {
    const cv = Reader.cleanCrop(img, L, L.sign, L.mh, trim, oh); if (!cv) continue;
    for (const psm of ['8', '7']) {
      const t = await ocrCanvas(cv, { tessedit_char_whitelist: VIN_WL, tessedit_pageseg_mode: psm });
      const r = vinCandidates(t); res.raw.push(...norm(t));
      res.good.push(...r.good); res.repaired.push(...r.repaired); res.odd.push(...r.odd);
      if (r.good.length) break;
    }
    if (res.good.length) break;
    }
    if (res.good.length) break;
  }
  const u = (a) => Array.from(new Set(a));
  res.good = u(res.good); res.repaired = u(res.repaired).filter((x) => !res.good.includes(x)); res.odd = u(res.odd);
  return res;
}
async function readOdoFromLines(img, extraLines) {
  let lines = extraLines || [];
  if (!lines.length) lines = Reader.findLines(img, 1).concat(Reader.findLines(img, -1)).filter((L) => L.n >= 3 && L.n <= 14);
  lines.sort((a, b) => b.n - a.n || b.mh - a.mh);
  const found = [];
  for (const L of lines.slice(0, 10)) {
    const cv = Reader.cleanCrop(img, L, L.sign, L.mh); if (!cv) continue;
    const t = (await ocrCanvas(cv, { tessedit_pageseg_mode: '7' })).replace(/(\d)[,\s](?=\d{3}(?!\d))/g, '$1');
    const m = t.match(/(\d{4,7})\s*(miles?|mi|km|kilometers?)?/i);
    if (m) found.push({ digits: m[1], unit: m[2] ? (/k/i.test(m[2]) ? 'km' : 'miles') : '', mh: L.mh, text: t });
  }
  found.sort((a, b) => (b.unit ? 1 : 0) - (a.unit ? 1 : 0) || (Number(b.digits.length >= 5) - Number(a.digits.length >= 5)) || Number(b.digits) - Number(a.digits));
  return found;
}
const photoCache = {};


function applyVin(kind, c, stat) {
  if (kind === 'vin') {
    chips('vinChips', c.good.concat(c.repaired), (v) => { $('vin').value = v; refresh(); });
    if (c.good.length) { $('vin').value = c.good[0]; stat.textContent = 'Read from photo — check it against the plate, character by character.'; }
    else if (c.repaired.length) stat.textContent = 'Not sure about one character. Tap the suggestion only if it matches the plate, or tap "Box the text" and try again.';
    else if (c.odd.length) stat.textContent = 'Read "' + c.odd[0] + '" (' + c.odd[0].length + ' characters) — not a valid VIN. Type it, or tap "Box the text" and try again.';
    else stat.textContent = 'Could not find the VIN. Tap "Box the text" to point at it, or type it.';
  } else {
    if (c.good.length) { $('docvin').value = c.good[0]; stat.textContent = 'Read from the document — check it against the photo.'; }
    else stat.textContent = 'Could not find a VIN on the document. Tap "Box the text", or type it.';
  }
}
function applyOdo(found, stat) {
  chips('odoChips', found.map((f) => f.digits).filter((x, i, a) => a.indexOf(x) === i).slice(0, 4), (v) => { $('odo').value = v.slice(-6); refresh(); });
  if (!found.length) { stat.textContent = 'Could not find the odometer digits. Tap "Box the text", or type it.'; return; }
  const f = found[0];
  $('odo').value = f.digits.slice(-6);
  if (f.unit) $('odo_unit').value = f.unit;
  if (f.digits.length === 6 || f.digits.length === 5) $('odo_digits').value = String(f.digits.length);
  stat.textContent = 'Read from photo: ' + f.digits + (f.unit ? ' ' + f.unit : '') + ' — make sure this is the odometer, not a trip meter or range.';
}


async function fullText(img, psm) {
  const fc = Reader.flatCanvas(img);
  return (await ocrCanvas(fc, { tessedit_char_whitelist: '', tessedit_pageseg_mode: psm || '12' })).toUpperCase();
}
const PICKUP_BTM = ['PK', 'PC', '3C', '4C', 'SP'];
async function readLabelPhoto(img, stat) {
  const [vinRes, text] = [await readVinFromLines(img), await fullText(img)];
  const notes = [];
  const typed = ($('vin').value || '').toUpperCase();
  let read = vinRes.good[0];
  const subseq = (a, b) => { let i = 0; for (const ch of b) if (ch === a[i]) i++; return i === a.length; };
  if (!read && typed.length === 17 && vinRes.raw.some((t) => t.length >= 17 && t.length <= 20 && subseq(typed, t))) read = typed;
  if (read && typed) {
    if (read === typed) { $('s6_status').value = 'agrees'; notes.push('VIN on the label matches the vehicle'); }
    else { $('s6_status').value = 'disagrees'; notes.push('VIN on the label (' + read + ') does NOT match the vehicle VIN'); }
  } else if (read) notes.push('label VIN read as ' + read + ' — enter the vehicle VIN to compare');
  else notes.push('could not read the VIN on the label — set the status yourself');
  if (/FEDERAL|FMVSS|MOTOR VEHICLE SAFETY/.test(text)) { $('s6_ind').value = 'fmvss'; notes.push('says it meets US FMVSS'); }
  else if (/CMVSS|CANADA|CANADIAN/.test(text)) { $('s6_ind').value = 'other'; notes.push('shows another country\'s standards'); }
  const g = text.match(/GVWR[^0-9]{0,14}(\d[\d,.]{2,6})\s*(KG|LBS?)?[^0-9]{0,8}\(?(\d[\d,.]{2,6})?\s*(KG|LBS?)?/);
  if (g) {
    const nums = [[g[1], g[2]], [g[3], g[4]]].filter((x) => x[0]).map((x) => ({ n: Number(x[0].replace(/[,.]/g, '')), u: x[1] || '' }));
    let lbs = (nums.find((x) => /LB/.test(x.u)) || {}).n;
    if (!lbs && nums[0] && /KG/.test(nums[0].u)) lbs = Math.round(nums[0].n * 2.2046);
    if (lbs) { notes.push('GVWR ' + lbs + ' lb'); if (PICKUP_BTM.includes(($('btm').value || '').toUpperCase())) $('gvwr').value = String(lbs); }
  }
  const d = text.match(/DATE[:\s]*([01]?\d\s*[\/-]\s*\d{2,4})/);
  if (d) notes.push('built ' + d[1].replace(/\s/g, ''));
  stat.textContent = 'From the label: ' + notes.join(' · ') + '. Confirm against the car.';
}
async function readDocPhoto(img, kind, stat) {
  const vinRes = await readVinFromLines(img);
  applyVin(kind, vinRes, stat);
  const text = await fullText(img);
  let t = '';
  if (/SALVAGE/.test(text)) t = 'salvage';
  else if (/MANUFACTURER.?S (CERTIFICATE|STATEMENT)|\bMSO\b|\bMCO\b/.test(text)) t = 'msomco';
  else if (/CERTIFICATE OF TITLE|\bTITLE\b/.test(text)) t = 'title';
  else if (/REGISTRATION/.test(text)) t = 'reg';
  if (t) { $('s8_type').value = t; stat.textContent += ' Document looks like: ' + $('s8_type').selectedOptions[0].text + '.'; }
}

async function handlePhoto(kind, file, row) {
  const th = row.querySelector('.thumb'); th.src = URL.createObjectURL(file); th.classList.remove('hidden');
  const stat = row.querySelector('.ocrstat');
  const ocrKind = row.dataset.ocr;
  if (!ocrKind) return;
  stat.textContent = 'Reading photo… (first time can take a few seconds)';
  try {
    if (ocrKind === 'vin' || ocrKind === 'docvin' || ocrKind === 'odo') {
      const cv = await fileToCanvas(file);
      const img = Reader.toGray(cv, Reader.MAXW);
      photoCache[ocrKind] = { img, cv, row };
      row.querySelector('.boxbtn').classList.remove('hidden');
      if (ocrKind === 'odo') applyOdo(await readOdoFromLines(img), stat);
      else if (ocrKind === 'docvin') await readDocPhoto(img, ocrKind, stat);
      else applyVin(ocrKind, await readVinFromLines(img), stat);
    } else if (ocrKind === 'label') {
      const cv = await fileToCanvas(file); const img = Reader.toGray(cv, Reader.MAXW);
      await readLabelPhoto(img, stat);
    } else if (ocrKind === 'emis') {
      const cv = await fileToCanvas(file); const img = Reader.toGray(cv, Reader.MAXW);
      const up = await fullText(img);
      const ca = /CALIFORNIA/.test(up), epa = /EPA|ENVIRONMENTAL PROTECTION|FEDERAL/.test(up);
      let hint = '';
      if (ca && epa) { hint = 'Label text mentions both California and EPA/federal.'; $('s9').value = 'both'; }
      else if (ca) { hint = 'Label text mentions California.'; $('s9').value = 'ca'; }
      else if (epa) { hint = 'Label text mentions EPA/federal.'; $('s9').value = 'epa'; }
      else hint = 'Could not tell from the photo.';
      setStatus($('emisHint'), 'warnx', hint + ' Confirm by reading the label.');
      const toks = (up.match(/\b[A-Z0-9][A-Z0-9.\-]{8,15}[A-Z0-9]\b/g) || []).filter((t) => /\d/.test(t) && /[A-Z]/.test(t)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 6);
      chips('emisChips', toks, (v) => { $('s9_family').value = v; refresh(); });
      const anch = up.match(/(?:ENGINE\s*FAMILY|TEST\s*GROUP|FAMILY)\s*(?:NO\.?|NUMBER|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9.\-]{7,15}[A-Z0-9])/);
      if (anch) { $('s9_family').value = anch[1]; stat.textContent = 'Read from label: ' + anch[1] + ' — confirm it against the label.'; }
      else stat.textContent = toks.length ? 'Tap the engine family / test group number if you see it.' : 'Type the engine family / test group number.';
    }
  } catch (e) {
    stat.textContent = 'Photo reading is not available right now. Type the value instead.';
  }
  refresh();
}


/* ---- "Box the text" fallback ---- */
const crop = { kind: null, rect: null, drag: null, scale: 1 };
function openCrop(kind) {
  const pc = photoCache[kind]; if (!pc) return;
  crop.kind = kind; crop.rect = null;
  const cvs = $('cropCv'); const maxW = Math.min(window.innerWidth - 24, 760);
  crop.scale = maxW / pc.cv.width; cvs.width = maxW; cvs.height = Math.round(pc.cv.height * crop.scale);
  drawCrop(); $('cropModal').classList.remove('hidden'); $('cropMsg').textContent = 'Drag a box tightly around the characters.';
}
function drawCrop() {
  const pc = photoCache[crop.kind], cvs = $('cropCv'), g = cvs.getContext('2d');
  g.drawImage(pc.cv, 0, 0, cvs.width, cvs.height);
  if (crop.rect) { const r = crop.rect; g.strokeStyle = '#F26A0F'; g.lineWidth = 3; g.strokeRect(r.x, r.y, r.w, r.h); }
}
function wireCrop() {
  const cvs = $('cropCv');
  const pos = (e) => { const b = cvs.getBoundingClientRect(); return { x: (e.clientX - b.left) * cvs.width / b.width, y: (e.clientY - b.top) * cvs.height / b.height }; };
  cvs.addEventListener('pointerdown', (e) => { cvs.setPointerCapture(e.pointerId); crop.drag = pos(e); crop.rect = { x: crop.drag.x, y: crop.drag.y, w: 0, h: 0 }; });
  cvs.addEventListener('pointermove', (e) => { if (!crop.drag) return; const p = pos(e); crop.rect = { x: Math.min(crop.drag.x, p.x), y: Math.min(crop.drag.y, p.y), w: Math.abs(p.x - crop.drag.x), h: Math.abs(p.y - crop.drag.y) }; drawCrop(); });
  const up = () => { crop.drag = null; };
  cvs.addEventListener('pointerup', up); cvs.addEventListener('pointercancel', up);
  $('cropCancel').onclick = () => $('cropModal').classList.add('hidden');
  $('cropGo').onclick = async () => {
    const r = crop.rect; if (!r || r.w < 20 || r.h < 8) { $('cropMsg').textContent = 'Draw a box around the characters first.'; return; }
    const pc = photoCache[crop.kind]; const k = pc.img.w / $('cropCv').width;
    const box = { x0: Math.round(r.x * k), y0: Math.round(r.y * k), x1: Math.round((r.x + r.w) * k), y1: Math.round((r.y + r.h) * k) };
    const lh = Math.max(14, (box.y1 - box.y0) * 0.7);
    const need = crop.kind === 'odo' ? 3 : 10;
    const mk = (sign) => {
      const found = Reader.findLinesIn(pc.img, box, sign).filter((L) => L.n >= need && L.n <= (crop.kind === 'odo' ? 14 : 19)).sort((a, b) => b.mh * b.n - a.mh * a.n)[0];
      return found ? Object.assign({}, found, { n: crop.kind === 'odo' ? found.n : 17 }) : Object.assign({ n: 17, mh: lh, sign }, box);
    };
    $('cropMsg').textContent = 'Reading…'; $('cropGo').disabled = true;
    const stat = pc.row.querySelector('.ocrstat');
    try {
      if (crop.kind === 'odo') applyOdo(await readOdoFromLines(pc.img, [mk(1), mk(-1)]), stat);
      else applyVin(crop.kind, await readVinFromLines(pc.img, [mk(1), mk(-1)]), stat);
    } catch (e) { stat.textContent = 'Could not read that box. Type the value instead.'; }
    $('cropGo').disabled = false; $('cropModal').classList.add('hidden'); refresh();
  };
}

/* ---------------- Wire up ---------------- */
function init() {
  loadSettingsUI(); wireCrop();
  loadDraft();
  if (!$('exec_date').value) $('exec_date').value = today();
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.closest('#settingsCard')) return;
    el.addEventListener('input', refresh); el.addEventListener('change', refresh);
  });
  $('s8_cond').addEventListener('change', () => { $('s8_cond').dataset.touched = '1'; });
  $('vin').addEventListener('input', () => { $('vinChips').innerHTML = ''; });
  document.querySelectorAll('.photoRow').forEach((row) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment'); inp.className = 'hidden';
    row.appendChild(inp);
    row.querySelector('.cam').addEventListener('click', () => inp.click());
    if (['vin', 'docvin', 'odo'].includes(row.dataset.ocr)) {
      const bb = document.createElement('button'); bb.type = 'button'; bb.className = 'ghost boxbtn hidden'; bb.textContent = '✂ Box the text';
      bb.addEventListener('click', () => openCrop(row.dataset.ocr)); row.insertBefore(bb, row.querySelector('.ocrstat'));
    }
    inp.addEventListener('change', () => { if (inp.files && inp.files[0]) handlePhoto(row.dataset.photo, inp.files[0], row); });
  });
  $('btnSettings').onclick = () => { $('settingsCard').classList.toggle('hidden'); $('logCard').classList.add('hidden'); };
  $('btnLog').onclick = () => { renderLog(); $('logCard').classList.toggle('hidden'); $('settingsCard').classList.add('hidden'); };
  $('saveSettings').onclick = saveSettingsUI;
  $('logCsv').onclick = logCsv;
  $('logClear').onclick = () => { if ($('logClear').dataset.arm) { LS.del('vvt_reg31_log'); delete $('logClear').dataset.arm; $('logClear').textContent = 'Clear log'; renderLog(); } else { $('logClear').dataset.arm = '1'; $('logClear').textContent = 'Tap again to confirm'; setTimeout(() => { delete $('logClear').dataset.arm; $('logClear').textContent = 'Clear log'; }, 4000); } };
  const make = async (dnp) => {
    const S = collect();
    $('make_pdf').disabled = true;
    try {
      const out = await buildPdf(S, { dnp });
      const url = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
      $('pdfLink').href = url;
      const dl = $('pdfDl'); dl.href = url; dl.download = 'REG31-' + (S.vin || 'form') + '.pdf';
      $('pdfOut').classList.remove('hidden');
      logJob(S, dnp);
      window.__lastPdf = out;
    } catch (e) { alert('Could not build the PDF: ' + e.message); }
    refresh();
  };
  $('make_pdf').onclick = () => make(false);
  $('make_dnp').onclick = () => make(true);
  $('newJob').onclick = () => { LS.del('vvt_reg31_draft'); location.reload(); };
  if (!settings().name) $('settingsCard').classList.remove('hidden');
  refresh();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', init);
})();
