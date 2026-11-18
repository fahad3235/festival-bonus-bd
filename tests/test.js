/* festival-bonus-bd unit tests - node:test + assert/strict. Run: node tests/test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');
const I18N = require('../js/i18n.js');

const TAKA = '\u09f3';

test('paisa parsing: no float error', () => {
  assert.equal(L.toPaisa('25000'), 2500000);
  assert.equal(L.toPaisa('25000.50'), 2500050);
  assert.equal(L.toPaisa('0.01'), 1);
  assert.equal(L.toPaisa('19.99'), 1999);
  assert.equal(L.toPaisa(25000), 2500000);
  assert.equal(L.toPaisa('25,000'), 2500000);
  assert.equal(L.toPaisa('0'), null);
  assert.equal(L.toPaisa('-5'), null);
  assert.equal(L.toPaisa('abc'), null);
  assert.equal(L.toPaisa(''), null);
  assert.equal(L.toPaisaNonNeg('0'), 0);
  assert.equal(L.toPaisaNonNeg(''), null);
  assert.equal(L.toPaisaNonNeg('-1'), null);
});

test('multiple rule: hand-verified 25,000 basic', () => {
  // basic 25,000 x 1 = 25,000 per festival; 2 festivals -> 50,000/yr
  const r = L.calcBonus(2500000, { type: 'multiple', multiple: 1000 }, 2);
  assert.equal(r.perFestival, 2500000);
  assert.equal(r.yearly, 5000000);
  assert.equal(r.monthly, 416667); // 5,000,000 / 12 = 416,666.67 -> 416,667 paisa = 4,166.67
  // 0.5x
  const h = L.calcBonus(2500000, { type: 'multiple', multiple: 500 }, 2);
  assert.equal(h.perFestival, 1250000);
  assert.equal(h.yearly, 2500000);
  assert.equal(h.monthly, 208333); // 2,500,000 / 12 = 208,333.33
  // 1 festival only
  const one = L.calcBonus(2500000, { type: 'multiple', multiple: 1000 }, 1);
  assert.equal(one.yearly, 2500000);
  assert.equal(one.monthly, 208333);
});

test('percent and fixed rules', () => {
  const pct = L.calcBonus(2500000, { type: 'percent', percent: 5000 }, 2); // 50%
  assert.equal(pct.perFestival, 1250000);
  assert.equal(pct.yearly, 2500000);
  const pct100 = L.calcBonus(3000000, { type: 'percent', percent: 10000 }, 1);
  assert.equal(pct100.perFestival, 3000000);
  const pctOdd = L.calcBonus(3333300, { type: 'percent', percent: 3333 }, 1); // 33.33% of 33,333 -> 11,109.89 -> 1,110,989 paisa
  assert.equal(pctOdd.perFestival, 1110989);
  const fix = L.calcBonus(2500000, { type: 'fixed', fixedPaisa: 1000000 }, 2);
  assert.equal(fix.perFestival, 1000000);
  assert.equal(fix.yearly, 2000000);
  assert.equal(fix.monthly, 166667); // 2,000,000 / 12 = 166,666.67
});

test('multiple / percent parsing and display round-trip', () => {
  assert.equal(L.parseMultiple('1'), 1000);
  assert.equal(L.parseMultiple('0.5'), 500);
  assert.equal(L.parseMultiple('1.25'), 1250);
  assert.equal(L.parseMultiple('0'), null);
  assert.equal(L.parseMultiple('-1'), null);
  assert.equal(L.parseMultiple('x'), null);
  assert.equal(L.parsePercent('50'), 5000);
  assert.equal(L.parsePercent('100'), 10000);
  assert.equal(L.parsePercent('0'), null);
  assert.equal(L.multipleDisplay(1000), '1');
  assert.equal(L.multipleDisplay(500), '0.5');
  assert.equal(L.multipleDisplay(1250), '1.25');
  assert.equal(L.percentDisplay(5000), '50');
  assert.equal(L.percentDisplay(10000), '100');
});

test('money and number formatting', () => {
  assert.equal(L.fmtMoney(2500000, 'en'), TAKA + '25,000.00');
  assert.equal(L.fmtMoney(416667, 'en'), TAKA + '4,166.67');
  assert.equal(L.fmtMoney(0, 'en'), TAKA + '0.00');
  assert.equal(L.fmtMoney(null, 'en'), TAKA + '\u2014');
  assert.equal(L.fmtMoney(2500000, 'bn'), TAKA + '\u09e8\u09eb,\u09e6\u09e6\u09e6.\u09e6\u09e6');
  assert.equal(L.fmtMoney(-150000, 'en'), '-' + TAKA + '1,500.00');
  assert.equal(L.fmtNum(2026, 'en'), '2,026');
  assert.equal(L.fmtNum(2026, 'bn'), '\u09e8,\u09e6\u09e8\u09ec'); // grouped, like 1,234,567 -> Bengali digits
  assert.equal(L.fmtNum(33, 'bn'), '\u09e9\u09e9');
  assert.equal(L.toBnDigits('123'), '\u09e7\u09e8\u09e9');
});

test('calculator and rule validation', () => {
  assert.deepEqual(L.validateCalculator(2500000, { type: 'multiple', multiple: 1000 }, 2), []);
  assert.deepEqual(L.validateCalculator(0, { type: 'multiple', multiple: 1000 }, 2), ['basic']);
  assert.deepEqual(L.validateCalculator(-1, { type: 'multiple', multiple: 1000 }, 2), ['basic']);
  assert.deepEqual(L.validateCalculator(2500000, { type: 'multiple', multiple: 0 }, 2), ['multiple']);
  assert.deepEqual(L.validateCalculator(2500000, { type: 'percent', percent: 0 }, 2), ['percent']);
  assert.deepEqual(L.validateCalculator(2500000, { type: 'fixed', fixedPaisa: 0 }, 2), ['fixed']);
  assert.deepEqual(L.validateCalculator(2500000, { type: 'bogus' }, 2), ['rule']);
  assert.deepEqual(L.validateCalculator(2500000, { type: 'multiple', multiple: 1000 }, 3), ['festivalsPerYear']);
  assert.deepEqual(L.PRESETS.government, { type: 'multiple', multiple: 1000 });
  assert.deepEqual(L.PRESETS.private, { type: 'multiple', multiple: 1000 });
  assert.deepEqual(L.PRESETS.garment, { type: 'multiple', multiple: 1000 });
  assert.equal(L.PRESETS.other, null);
});

test('scenario compare: ordering and highest flag', () => {
  const a = { id: 'a', name: 'A', basicPaisa: 2500000, rule: { type: 'multiple', multiple: 1000 }, festivalsPerYear: 2 }; // 50,000/yr
  const b = { id: 'b', name: 'B', basicPaisa: 3000000, rule: { type: 'multiple', multiple: 500 }, festivalsPerYear: 2 }; // 30,000/yr
  const c = { id: 'c', name: 'C', basicPaisa: 2000000, rule: { type: 'fixed', fixedPaisa: 1500000 }, festivalsPerYear: 2 }; // 30,000/yr
  const rows = L.compareScenarios([b, c, a]);
  assert.equal(rows[0].scenario.id, 'a');
  assert.equal(rows[0].highest, true);
  assert.equal(rows[0].yearly, 5000000);
  assert.equal(rows[0].monthly, 416667);
  assert.equal(rows[1].highest, false);
  assert.equal(rows[2].highest, false);
  assert.equal(rows[1].yearly, 3000000); // tie keeps insertion order: b before c
  assert.equal(rows[2].scenario.id, 'c');
  assert.deepEqual(L.compareScenarios([]), []);
  assert.deepEqual(L.validateScenario(a), []);
  assert.deepEqual(L.validateScenario({ ...a, name: '' }), ['name']);
  assert.deepEqual(L.validateScenario({ ...a, basicPaisa: 0 }), ['basic']);
});

test('date helpers', () => {
  assert.equal(L.isValidDate('2026-11-17'), true);
  assert.equal(L.isValidDate('2024-02-29'), true); // leap year
  assert.equal(L.isValidDate('2026-02-29'), false); // not a leap year
  assert.equal(L.isValidDate('2026-13-01'), false);
  assert.equal(L.isValidDate('2026-00-10'), false);
  assert.equal(L.isValidDate('2026-04-31'), false);
  assert.equal(L.isValidDate('2026-2-3'), false);
  assert.equal(L.isValidDate('not-a-date'), false);
  assert.equal(L.isValidDate(''), false);
  assert.equal(L.daysBetween('2026-11-17', '2026-12-20'), 33);
  assert.equal(L.daysBetween('2026-12-20', '2026-11-17'), -33);
  assert.equal(L.daysBetween('2026-11-17', '2026-11-17'), 0);
  assert.equal(L.daysBetween('2026-01-01', '2027-01-01'), 365);
});

test('festival status derivation incl. boundaries', () => {
  const asof = '2026-11-17';
  const base = { id: 'f1', name: 'Eid-ul-Fitr', date: '2026-12-20', expectedPaisa: 2500000, receivedPaisa: 0, paidDate: null };
  assert.equal(L.festivalStatus(base, asof), 'expected');
  assert.equal(L.festivalStatus({ ...base, date: '2026-11-17' }, asof), 'expected'); // today is not overdue
  assert.equal(L.festivalStatus({ ...base, date: '2026-11-16' }, asof), 'overdue'); // yesterday, unpaid
  assert.equal(L.festivalStatus({ ...base, date: '2026-11-01' }, asof), 'overdue');
  assert.equal(L.festivalStatus({ ...base, date: '2026-11-01', receivedPaisa: 1000000 }, asof), 'partial');
  assert.equal(L.festivalStatus({ ...base, receivedPaisa: 1000000 }, asof), 'partial');
  assert.equal(L.festivalStatus({ ...base, receivedPaisa: 2500000 }, asof), 'received');
  assert.equal(L.festivalStatus({ ...base, date: '2026-11-01', receivedPaisa: 2500000 }, asof), 'received');
  // over-receipt is allowed and counts as received, never rejected
  assert.equal(L.festivalStatus({ ...base, receivedPaisa: 3000000 }, asof), 'received');
  assert.deepEqual(L.validateFestival(base), []);
  assert.deepEqual(L.validateFestival({ ...base, name: '' }), ['name']);
  assert.deepEqual(L.validateFestival({ ...base, date: '2026-02-30' }), ['date']);
  assert.deepEqual(L.validateFestival({ ...base, expectedPaisa: -1 }), ['expected']);
  assert.deepEqual(L.validateFestival({ ...base, receivedPaisa: -5 }), ['received']);
  assert.deepEqual(L.validateFestival({ ...base, paidDate: '2026-13-01' }), ['paidDate']);
  assert.deepEqual(L.validateFestival({ ...base, paidDate: '2026-12-25' }), []);
});

test('next festival computation', () => {
  const asof = '2026-11-17';
  const fests = [
    { id: '1', name: 'Past', date: '2026-11-01', expectedPaisa: 500000, receivedPaisa: 0, paidDate: null },
    { id: '2', name: 'Soon', date: '2026-12-20', expectedPaisa: 2500000, receivedPaisa: 0, paidDate: null },
    { id: '3', name: 'Later', date: '2027-01-10', expectedPaisa: 2500000, receivedPaisa: 0, paidDate: null }
  ];
  const n = L.nextFestival(fests, asof);
  assert.equal(n.festival.name, 'Soon');
  assert.equal(n.days, 33);
  assert.equal(L.nextFestival([], asof), null);
  assert.equal(L.nextFestival([fests[0]], asof), null);
  const today = L.nextFestival([{ ...fests[1], date: '2026-11-17' }], asof);
  assert.equal(today.days, 0);
});

test('dashboard totals for a year', () => {
  const asof = '2026-11-17';
  const fests = [
    { id: '1', name: 'Eid-ul-Fitr', date: '2026-03-20', expectedPaisa: 2500000, receivedPaisa: 2500000, paidDate: '2026-03-19' },
    { id: '2', name: 'Eid-ul-Adha', date: '2026-12-20', expectedPaisa: 2500000, receivedPaisa: 1000000, paidDate: null },
    { id: '3', name: 'Durga Puja', date: '2026-10-01', expectedPaisa: 500000, receivedPaisa: 0, paidDate: null },
    { id: '4', name: 'Next year', date: '2027-03-20', expectedPaisa: 9000000, receivedPaisa: 0, paidDate: null }
  ];
  const d = L.dashboardTotals(fests, 2026, asof);
  assert.equal(d.expected, 5500000); // 25,000 + 25,000 + 5,000
  assert.equal(d.received, 3500000); // 25,000 + 10,000
  assert.equal(d.pending, 2000000);
  assert.equal(d.extra, 0);
  assert.equal(d.count, 3); // 2027 entry excluded
  assert.equal(d.next.festival.name, 'Eid-ul-Adha');
  assert.equal(d.next.days, 33);
  assert.equal(d.items[0].status, 'received');
  assert.equal(d.items[0].progress, 100);
  assert.equal(d.items[1].status, 'overdue'); // Durga Puja 2026-10-01, unpaid, past
  assert.equal(d.items[1].progress, 0);
  assert.equal(d.items[2].status, 'partial');
  assert.equal(d.items[2].progress, 40);
  // over-receipt counts as extra, pending goes negative honestly
  const over = L.dashboardTotals([{ id: 'x', name: 'X', date: '2026-05-01', expectedPaisa: 1000000, receivedPaisa: 1500000, paidDate: null }], 2026, asof);
  assert.equal(over.extra, 500000);
  assert.equal(over.pending, -500000);
  const empty = L.dashboardTotals([], 2026, asof);
  assert.equal(empty.expected, 0);
  assert.equal(empty.next, null);
});

test('import validation: good data accepted, malformed rejected', () => {
  const good = {
    app: 'festival-bonus-bd', v: 1, lang: 'en',
    calculator: { basicPaisa: 2500000, rule: { type: 'multiple', multiple: 1000 }, festivalsPerYear: 2 },
    sector: 'government',
    scenarios: [{ id: 's1', name: 'A', basicPaisa: 2500000, rule: { type: 'multiple', multiple: 1000 }, festivalsPerYear: 2 }],
    festivals: [{ id: 'f1', name: 'Eid-ul-Fitr', date: '2026-12-20', expectedPaisa: 2500000, receivedPaisa: 0, paidDate: null }]
  };
  assert.equal(L.validateImport(good).ok, true);
  assert.equal(L.validateImport({ ...good, calculator: { basicPaisa: null, rule: { type: 'multiple', multiple: 1000 }, festivalsPerYear: 2 } }).ok, true); // fresh state
  const bad = [
    null, // 1 not an object
    'nope', // 2 string
    [], // 3 array
    { ...good, app: 'other-app' }, // 4 wrong app tag
    { ...good, v: 2 }, // 5 wrong version
    { ...good, v: '1' }, // 6 version not a number
    { ...good, calculator: null }, // 7 missing calculator
    { ...good, calculator: { ...good.calculator, basicPaisa: -5 } }, // 8 negative basic
    { ...good, calculator: { ...good.calculator, rule: { type: 'multiple', multiple: 0 } } }, // 9 bad rule
    { ...good, calculator: { ...good.calculator, festivalsPerYear: 3 } }, // 10 bad festivals count
    { ...good, scenarios: 'nope' }, // 11 scenarios not an array
    { ...good, scenarios: [good.scenarios[0], good.scenarios[0], good.scenarios[0], good.scenarios[0]] }, // 12 over the 3 cap
    { ...good, scenarios: [{ ...good.scenarios[0], id: 's1' }, { ...good.scenarios[0], id: 's1' }] }, // 13 duplicate scenario id
    { ...good, scenarios: [{ ...good.scenarios[0], basicPaisa: 0 }] }, // 14 invalid scenario
    { ...good, festivals: 'nope' }, // 15 festivals not an array
    { ...good, festivals: [{ ...good.festivals[0], date: '2026-02-30' }] }, // 16 impossible date
    { ...good, festivals: [{ ...good.festivals[0], receivedPaisa: -1 }] }, // 17 negative received
    { ...good, festivals: [{ ...good.festivals[0], id: 'f1' }, { ...good.festivals[0], id: 'f1' }] }, // 18 duplicate festival id
    { ...good, lang: 'fr' }, // 19 bad language
    { ...good, sector: 'mars' } // 20 bad sector
  ];
  bad.forEach((b, i) => {
    assert.equal(L.validateImport(b).ok, false, 'malformed input #' + (i + 1) + ' should be rejected');
  });
});

test('i18n completeness', () => {
  const keys = Object.keys(I18N);
  assert.ok(keys.length >= 80, 'expected 80+ keys, got ' + keys.length);
  keys.forEach((k) => {
    const e = I18N[k];
    assert.equal(typeof e.en, 'string', k + ' missing en');
    assert.equal(typeof e.bn, 'string', k + ' missing bn');
    assert.ok(e.en.length > 0, k + ' empty en');
    assert.ok(e.bn.length > 0, k + ' empty bn');
  });
  // Bengali strings really contain Bengali script
  assert.ok(/[\u0980-\u09FF]/.test(I18N.appTitle.bn));
  assert.ok(/[\u0980-\u09FF]/.test(I18N.tabCalculator.bn));
  assert.ok(/[\u0980-\u09FF]/.test(I18N.statusOverdue.bn));
  assert.ok(/[\u0980-\u09FF]/.test(I18N.disclaimer.bn));
});

test('default state ships empty: no dates, no amounts', () => {
  const s = L.defaultState();
  assert.equal(s.app, 'festival-bonus-bd');
  assert.equal(s.v, 1);
  assert.equal(s.calculator.basicPaisa, null);
  assert.deepEqual(s.scenarios, []);
  assert.deepEqual(s.festivals, []);
  assert.equal(L.validateImport(s).ok, true);
});
