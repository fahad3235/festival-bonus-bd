/* festival-bonus-bd - pure logic (no DOM). Node-testable.
 * Money is integer paisa everywhere (1 Taka = 100 paisa) so no float
 * rounding error ever appears. Dates are ISO yyyy-mm-dd strings.
 * `asof` is always an ISO date string (today, or the ?asof= override). */
'use strict';

var TAKA = '\u09f3'; // U+09F3, ASCII-escaped so this file stays pure ASCII

/* ---------- formatting ---------- */

function toBnDigits(s) {
  return String(s).replace(/[0-9]/g, function (d) {
    return String.fromCharCode(0x09e6 + Number(d));
  });
}

function groupInt(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* Format a plain number (integer or decimal) with thousands separators. */
function fmtNum(n, lang) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '\u2014';
  var parts = String(n).split('.');
  var out = groupInt(parts[0]);
  if (parts.length > 1) out += '.' + parts[1];
  if (lang === 'bn') out = toBnDigits(out);
  return out;
}

/* Format integer paisa as Taka with 2 decimals, e.g. 2500000 -> Tk 25,000.00 */
function fmtMoney(paisa, lang) {
  if (paisa === null || paisa === undefined || !Number.isFinite(paisa)) return TAKA + '\u2014';
  var sign = paisa < 0 ? '-' : '';
  var abs = Math.abs(Math.round(paisa));
  var taka = Math.floor(abs / 100);
  var ps = abs % 100;
  var s = sign + TAKA + groupInt(String(taka)) + '.' + (ps < 10 ? '0' : '') + ps;
  if (lang === 'bn') s = toBnDigits(s);
  return s;
}

/* ---------- parsing ---------- */

/* Taka input (string/number) -> integer paisa, or null when not a positive amount. */
function toPaisa(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/* Taka input -> integer paisa >= 0 (used for expected/received amounts), null when invalid. */
function toPaisaNonNeg(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/* Multiple input ("1", "0.5") -> integer thousandths (1000 = 1x), null when invalid. */
function parseMultiple(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(String(v).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000);
}

/* Percent input ("50") -> integer hundredths of a percent (5000 = 50%), null when invalid. */
function parsePercent(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(String(v).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/* Multiple (thousandths) back to a display string, e.g. 500 -> "0.5", 1000 -> "1". */
function multipleDisplay(multiple) {
  var s = (multiple / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return s === '' ? '0' : s;
}

/* Percent (hundredths) back to a display string, e.g. 5000 -> "50". */
function percentDisplay(percent) {
  var s = (percent / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return s === '' ? '0' : s;
}

/* ---------- bonus rules ---------- */

/* A rule is { type: 'multiple', multiple: <thousandths> }
 *          | { type: 'percent', percent: <hundredths of a percent> }
 *          | { type: 'fixed', fixedPaisa: <integer paisa> } */
function validateRule(rule) {
  var errs = [];
  if (!rule || (rule.type !== 'multiple' && rule.type !== 'percent' && rule.type !== 'fixed')) {
    errs.push('rule');
    return errs;
  }
  if (rule.type === 'multiple' && !(Number.isInteger(rule.multiple) && rule.multiple > 0)) errs.push('multiple');
  if (rule.type === 'percent' && !(Number.isInteger(rule.percent) && rule.percent > 0)) errs.push('percent');
  if (rule.type === 'fixed' && !(Number.isInteger(rule.fixedPaisa) && rule.fixedPaisa > 0)) errs.push('fixed');
  return errs;
}

function perFestivalPaisa(basicPaisa, rule) {
  if (rule.type === 'multiple') return Math.round(basicPaisa * rule.multiple / 1000);
  if (rule.type === 'percent') return Math.round(basicPaisa * rule.percent / 10000);
  return rule.fixedPaisa;
}

/* -> { perFestival, yearly, monthly } in integer paisa. */
function calcBonus(basicPaisa, rule, festivalsPerYear) {
  var per = perFestivalPaisa(basicPaisa, rule);
  var yearly = per * festivalsPerYear;
  return { perFestival: per, yearly: yearly, monthly: Math.round(yearly / 12) };
}

function validateCalculator(basicPaisa, rule, festivalsPerYear) {
  var errs = [];
  if (!(Number.isInteger(basicPaisa) && basicPaisa > 0)) errs.push('basic');
  errs = errs.concat(validateRule(rule));
  if (festivalsPerYear !== 1 && festivalsPerYear !== 2) errs.push('festivalsPerYear');
  return errs;
}

/* Sector presets are suggestions only - every value stays editable and no
 * preset is a legal claim about what any employer must pay. */
var PRESETS = {
  government: { type: 'multiple', multiple: 1000 },
  private: { type: 'multiple', multiple: 1000 },
  garment: { type: 'multiple', multiple: 1000 },
  other: null
};

/* ---------- dates ---------- */

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var y = Number(s.slice(0, 4));
  var m = Number(s.slice(5, 7));
  var d = Number(s.slice(8, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  var dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function daysBetween(a, b) {
  var pa = a.split('-').map(Number);
  var pb = b.split('-').map(Number);
  var ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  var tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / 86400000);
}

function todayISO() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

/* ---------- festivals ---------- */

/* Status derivation. Over-receipt (received > expected) is allowed and counts
 * as Received; the extra is shown separately, never rejected. */
function festivalStatus(f, asof) {
  if (f.expectedPaisa > 0 && f.receivedPaisa >= f.expectedPaisa) return 'received';
  if (f.receivedPaisa > 0) return 'partial';
  if (f.date < asof) return 'overdue';
  return 'expected';
}

function validateFestival(f) {
  var errs = [];
  if (!f || typeof f.name !== 'string' || f.name.trim().length === 0 || f.name.trim().length > 60) errs.push('name');
  if (!f || !isValidDate(f.date)) errs.push('date');
  if (!f || !(Number.isInteger(f.expectedPaisa) && f.expectedPaisa >= 0)) errs.push('expected');
  if (!f || !(Number.isInteger(f.receivedPaisa) && f.receivedPaisa >= 0)) errs.push('received');
  if (f && f.paidDate !== null && f.paidDate !== undefined && f.paidDate !== '' && !isValidDate(f.paidDate)) errs.push('paidDate');
  return errs;
}

/* Earliest festival on or after asof, or null. -> { festival, days } */
function nextFestival(festivals, asof) {
  var upcoming = festivals.filter(function (f) { return f.date >= asof; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  if (upcoming.length === 0) return null;
  return { festival: upcoming[0], days: daysBetween(asof, upcoming[0].date) };
}

/* Dashboard totals for one calendar year (year of each festival's date). */
function dashboardTotals(festivals, year, asof) {
  var y = String(year);
  var list = festivals.filter(function (f) { return f.date.slice(0, 4) === y; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var expected = 0, received = 0, extra = 0;
  var items = list.map(function (f) {
    expected += f.expectedPaisa;
    received += f.receivedPaisa;
    if (f.receivedPaisa > f.expectedPaisa) extra += f.receivedPaisa - f.expectedPaisa;
    var progress = f.expectedPaisa > 0 ? Math.min(100, Math.round(f.receivedPaisa / f.expectedPaisa * 100)) : (f.receivedPaisa > 0 ? 100 : 0);
    return { festival: f, status: festivalStatus(f, asof), progress: progress };
  });
  return {
    expected: expected,
    received: received,
    pending: expected - received,
    extra: extra,
    count: list.length,
    next: nextFestival(list, asof),
    items: items
  };
}

/* ---------- scenarios ---------- */

function validateScenario(s) {
  var errs = [];
  if (!s || typeof s.name !== 'string' || s.name.trim().length === 0 || s.name.trim().length > 60) errs.push('name');
  if (!s || !(Number.isInteger(s.basicPaisa) && s.basicPaisa > 0)) errs.push('basic');
  errs = errs.concat(validateRule(s.rule));
  if (!s || (s.festivalsPerYear !== 1 && s.festivalsPerYear !== 2)) errs.push('festivalsPerYear');
  return errs;
}

/* Compare scenarios: each gets perFestival/yearly/monthly, sorted by yearly
 * descending; the first entry is the highest (ties keep insertion order). */
function compareScenarios(scenarios) {
  var rows = scenarios.map(function (s, i) {
    var c = calcBonus(s.basicPaisa, s.rule, s.festivalsPerYear);
    return { scenario: s, index: i, perFestival: c.perFestival, yearly: c.yearly, monthly: c.monthly, highest: false };
  });
  rows.sort(function (a, b) { return b.yearly - a.yearly || a.index - b.index; });
  if (rows.length > 0) rows[0].highest = true;
  return rows;
}

/* ---------- import validation ---------- */

function validateImport(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'notObject' };
  if (obj.app !== 'festival-bonus-bd') return { ok: false, error: 'app' };
  if (obj.v !== 1) return { ok: false, error: 'version' };
  if (!obj.calculator || typeof obj.calculator !== 'object') return { ok: false, error: 'calculator' };
  var c = obj.calculator;
  /* basicPaisa may be null (nothing entered yet) but never negative/non-integer. */
  if (c.basicPaisa !== null && !(Number.isInteger(c.basicPaisa) && c.basicPaisa > 0)) return { ok: false, error: 'calculator' };
  if (validateRule(c.rule).length > 0) return { ok: false, error: 'calculator' };
  if (c.festivalsPerYear !== 1 && c.festivalsPerYear !== 2) return { ok: false, error: 'calculator' };
  if (!Array.isArray(obj.scenarios)) return { ok: false, error: 'scenarios' };
  if (obj.scenarios.length > 3) return { ok: false, error: 'scenarios' };
  var scenIds = {};
  for (var i = 0; i < obj.scenarios.length; i++) {
    var s = obj.scenarios[i];
    if (validateScenario(s).length > 0) return { ok: false, error: 'scenarios' };
    if (typeof s.id !== 'string' || s.id.length === 0 || scenIds[s.id]) return { ok: false, error: 'scenarios' };
    scenIds[s.id] = true;
  }
  if (!Array.isArray(obj.festivals)) return { ok: false, error: 'festivals' };
  var festIds = {};
  for (var j = 0; j < obj.festivals.length; j++) {
    var f = obj.festivals[j];
    if (validateFestival(f).length > 0) return { ok: false, error: 'festivals' };
    if (typeof f.id !== 'string' || f.id.length === 0 || festIds[f.id]) return { ok: false, error: 'festivals' };
    festIds[f.id] = true;
  }
  if (obj.lang !== undefined && obj.lang !== 'en' && obj.lang !== 'bn') return { ok: false, error: 'lang' };
  if (obj.sector !== undefined && obj.sector !== null && !(obj.sector in PRESETS)) return { ok: false, error: 'sector' };
  return { ok: true };
}

/* ---------- state ---------- */

function defaultState() {
  return {
    app: 'festival-bonus-bd',
    v: 1,
    lang: 'en',
    calculator: { basicPaisa: null, rule: { type: 'multiple', multiple: 1000 }, festivalsPerYear: 2 },
    sector: null,
    scenarios: [],
    festivals: []
  };
}

function newId(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TAKA: TAKA,
    toBnDigits: toBnDigits,
    fmtNum: fmtNum,
    fmtMoney: fmtMoney,
    toPaisa: toPaisa,
    toPaisaNonNeg: toPaisaNonNeg,
    parseMultiple: parseMultiple,
    parsePercent: parsePercent,
    multipleDisplay: multipleDisplay,
    percentDisplay: percentDisplay,
    validateRule: validateRule,
    perFestivalPaisa: perFestivalPaisa,
    calcBonus: calcBonus,
    validateCalculator: validateCalculator,
    PRESETS: PRESETS,
    isValidDate: isValidDate,
    daysBetween: daysBetween,
    todayISO: todayISO,
    festivalStatus: festivalStatus,
    validateFestival: validateFestival,
    nextFestival: nextFestival,
    dashboardTotals: dashboardTotals,
    validateScenario: validateScenario,
    compareScenarios: compareScenarios,
    validateImport: validateImport,
    defaultState: defaultState,
    newId: newId
  };
}
