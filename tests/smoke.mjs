/* festival-bonus-bd headless-Chrome smoke test (raw CDP, no deps).
 * Run: node tests/smoke.mjs  (from the festival-bonus-bd folder)
 * Loads index.html over file://?asof=2026-11-17, drives the real UI,
 * collects console/page errors, asserts visible state at 1440px and 390px.
 * Uses a FRESH headless_shell profile each run so stale localStorage
 * never pollutes a run. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PAGE_URL = 'file:///home/hatch/workspace/muse-project-factory/builds/festival-bonus-bd/index.html?asof=2026-11-17';
const PORT = 9233;
const PROFILE = `/tmp/fbbd-smoke-${process.pid}`;

let pass = 0, fail = 0;
const errors = [];
const netReqs = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const chrome = spawn(SHELL, ['--headless', '--no-sandbox', '--disable-gpu',
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('headless_shell did not start');
}

let msgId = 0;
const pending = new Map();
let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function click(selector) {
  await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw new Error('missing ' + ${JSON.stringify(selector)}); e.click(); return true; })()`);
}
const setVal = (sel, v) => evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

try {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE.ERROR: ' + JSON.stringify(m.params.args).slice(0, 300));
    if (m.method === 'Network.requestWillBeSent') netReqs.push(m.params.request.url);
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1500);

  /* ---- initial render: nothing pre-filled ---- */
  check('title is Festival Bonus BD', await evalJs(`document.title.includes('Festival Bonus BD')`));
  check('results show dashes before input', await evalJs(`document.querySelector('#res-per').textContent`) === '\u2014');
  check('tracker empty state visible', await evalJs(`!document.querySelector('#fest-empty').hidden`));
  check('disclaimer visible', await evalJs(`document.querySelector('.disclaimer').textContent.includes('not a legal ruling')`));
  check('no horizontal overflow at 1440px', await evalJs(`document.documentElement.scrollWidth <= 1440`));

  /* ---- calculator: 25,000 basic, 1x, 2 festivals -> 25,000 / 50,000 / 4,166.67 ---- */
  await setVal('#calc-basic', '25000');
  await sleep(300);
  check('per-festival is 25,000.00', await evalJs(`document.querySelector('#res-per').textContent`) === '\u09f325,000.00');
  check('yearly is 50,000.00', await evalJs(`document.querySelector('#res-yearly').textContent`) === '\u09f350,000.00');
  check('monthly equivalent is 4,166.67', await evalJs(`document.querySelector('#res-monthly').textContent`) === '\u09f34,166.67');

  /* ---- preset: Government applies 1x, shows note, stays editable ---- */
  await click('[data-preset="government"]');
  await sleep(300);
  check('preset note visible', await evalJs(`!document.querySelector('#preset-note').hidden`));
  check('preset keeps per-festival 25,000.00', await evalJs(`document.querySelector('#res-per').textContent`) === '\u09f325,000.00');
  await setVal('#calc-multiple', '0.5');
  await sleep(300);
  check('editable after preset: 0.5x -> 12,500.00', await evalJs(`document.querySelector('#res-per').textContent`) === '\u09f312,500.00');
  await setVal('#calc-multiple', '1');
  await sleep(300);
  check('back to 1x: 25,000.00', await evalJs(`document.querySelector('#res-per').textContent`) === '\u09f325,000.00');

  /* ---- percent rule: 50% of 25,000 = 12,500 ---- */
  await setVal('#calc-rule', 'percent');
  await setVal('#calc-percent', '50');
  await sleep(300);
  check('50% rule: per-festival 12,500.00', await evalJs(`document.querySelector('#res-per').textContent`) === '\u09f312,500.00');
  check('50% rule: yearly 25,000.00', await evalJs(`document.querySelector('#res-yearly').textContent`) === '\u09f325,000.00');

  /* ---- fixed rule: 10,000 per festival ---- */
  await setVal('#calc-rule', 'fixed');
  await setVal('#calc-fixed', '10000');
  await sleep(300);
  check('fixed rule: per-festival 10,000.00', await evalJs(`document.querySelector('#res-per').textContent`) === '\u09f310,000.00');
  check('fixed rule: yearly 20,000.00', await evalJs(`document.querySelector('#res-yearly').textContent`) === '\u09f320,000.00');

  /* ---- 1 festival per year halves the yearly total ---- */
  await setVal('#calc-rule', 'multiple');
  await setVal('#calc-multiple', '1');
  await setVal('#calc-festivals', '1');
  await sleep(300);
  check('1 festival/yr: yearly 25,000.00', await evalJs(`document.querySelector('#res-yearly').textContent`) === '\u09f325,000.00');
  await setVal('#calc-festivals', '2');
  await sleep(300);
  check('2 festivals/yr: yearly back to 50,000.00', await evalJs(`document.querySelector('#res-yearly').textContent`) === '\u09f350,000.00');

  /* ---- validation: basic 0 rejected with inline error ---- */
  await setVal('#calc-basic', '0');
  await sleep(300);
  check('basic 0 shows inline error', await evalJs(`!document.querySelector('#calc-basic-error').hidden && document.querySelector('#calc-basic-error').textContent.length > 0`));
  check('basic 0 shows dashes, not a number', await evalJs(`document.querySelector('#res-per').textContent`) === '\u2014');
  await setVal('#calc-basic', '25000');
  await sleep(300);
  check('basic restored: per-festival 25,000.00', await evalJs(`document.querySelector('#res-per').textContent`) === '\u09f325,000.00');

  /* ---- use in tracker: fills expected amount, switches tab ---- */
  await click('#use-in-tracker');
  await sleep(300);
  check('use-in-tracker switches to tracker tab', await evalJs(`!document.querySelector('#panel-tracker').hidden`));
  check('tracker expected prefilled 25000', await evalJs(`document.querySelector('#fest-expected').value`) === '25000');

  /* ---- tracker validation: empty submit rejected ---- */
  await click('#add-festival-btn');
  await sleep(300);
  check('empty festival shows name error', await evalJs(`!document.querySelector('#fest-name-error').hidden`));
  check('no festival rows after bad add', await evalJs(`document.querySelectorAll('#fest-list .fest-row').length`) === 0);

  /* ---- add Eid-ul-Fitr 2026-12-20, expected 25,000, received 0 ---- */
  await setVal('#fest-name', 'Eid-ul-Fitr');
  await setVal('#fest-date', '2026-12-20');
  await click('#add-festival-btn');
  await sleep(300);
  check('1 festival row after add', await evalJs(`document.querySelectorAll('#fest-list .fest-row').length`) === 1);
  check('Eid status is Expected', await evalJs(`document.querySelector('#fest-list .fest-row').textContent.includes('Expected')`));
  check('Eid shows expected 25,000.00', await evalJs(`document.querySelector('#fest-list .fest-row').textContent.includes('25,000.00')`));

  /* ---- dashboard: expected 25,000, received 0, pending 25,000, next in 33 days ---- */
  await click('[data-tab="dashboard"]');
  await sleep(300);
  check('dashboard expected is 25,000.00', await evalJs(`document.querySelector('#dash-expected').textContent`) === '\u09f325,000.00');
  check('dashboard received is 0.00', await evalJs(`document.querySelector('#dash-received').textContent`) === '\u09f30.00');
  check('dashboard pending is 25,000.00', await evalJs(`document.querySelector('#dash-pending').textContent`) === '\u09f325,000.00');
  check('next festival is Eid-ul-Fitr 2026-12-20', await evalJs(`document.querySelector('#dash-next').textContent.includes('Eid-ul-Fitr')`));
  check('days to go is 33', await evalJs(`document.querySelector('#dash-days').textContent.includes('33')`));

  /* ---- mark received partial 10,000 -> status Partial ---- */
  await click('[data-tab="tracker"]');
  await sleep(300);
  await evalJs(`(() => { const row = document.querySelector('#fest-list .fest-row'); const inp = row.querySelector('.fest-received-input'); inp.value = '10000'; inp.dispatchEvent(new Event('input', { bubbles: true })); row.querySelectorAll('.btn.small')[0].click(); return true; })()`);
  await sleep(300);
  check('partial receipt: status Partial', await evalJs(`document.querySelector('#fest-list .fest-row').textContent.includes('Partial')`));
  await click('[data-tab="dashboard"]');
  await sleep(300);
  check('dashboard received is 10,000.00 after partial', await evalJs(`document.querySelector('#dash-received').textContent`) === '\u09f310,000.00');
  check('dashboard pending is 15,000.00 after partial', await evalJs(`document.querySelector('#dash-pending').textContent`) === '\u09f315,000.00');

  /* ---- add overdue festival 2026-11-01, expected 5,000 ---- */
  await click('[data-tab="tracker"]');
  await sleep(300);
  await setVal('#fest-name', 'Durga Puja');
  await setVal('#fest-date', '2026-11-01');
  await setVal('#fest-expected', '5000');
  await setVal('#fest-received', '0');
  await click('#add-festival-btn');
  await sleep(300);
  check('2 festival rows after adding overdue one', await evalJs(`document.querySelectorAll('#fest-list .fest-row').length`) === 2);
  check('overdue festival flagged Overdue', await evalJs(`[...document.querySelectorAll('#fest-list .fest-row')].find(r => r.textContent.includes('Durga Puja')).textContent.includes('Overdue')`));
  await click('[data-tab="dashboard"]');
  await sleep(300);
  check('dashboard expected now 30,000.00', await evalJs(`document.querySelector('#dash-expected').textContent`) === '\u09f330,000.00');

  /* ---- compare: add 3 scenarios, highest highlighted ---- */
  await click('[data-tab="compare"]');
  await sleep(300);
  async function addScenario(name, basic, rule, value, festivals) {
    await setVal('#scen-name', name);
    await setVal('#scen-basic', basic);
    await setVal('#scen-rule', rule);
    if (rule === 'multiple') await setVal('#scen-multiple', value);
    if (rule === 'percent') await setVal('#scen-percent', value);
    if (rule === 'fixed') await setVal('#scen-fixed', value);
    await setVal('#scen-festivals', festivals);
    await click('#add-scenario-btn');
    await sleep(300);
  }
  await addScenario('Current job', '25000', 'multiple', '1', '2');
  await addScenario('New offer', '30000', 'multiple', '0.5', '2');
  await addScenario('Fixed shop', '20000', 'fixed', '15000', '2');
  check('3 scenario cards', await evalJs(`document.querySelectorAll('#compare-table .scen-card').length`) === 3);
  check('Current job yearly is 50,000.00', await evalJs(`[...document.querySelectorAll('#compare-table .scen-card')].find(c => c.textContent.includes('Current job')).textContent.includes('50,000.00')`));
  check('New offer yearly is 30,000.00', await evalJs(`[...document.querySelectorAll('#compare-table .scen-card')].find(c => c.textContent.includes('New offer')).textContent.includes('30,000.00')`));
  check('Fixed shop yearly is 30,000.00', await evalJs(`[...document.querySelectorAll('#compare-table .scen-card')].find(c => c.textContent.includes('Fixed shop')).textContent.includes('30,000.00')`));
  check('highest badge on Current job', await evalJs(`[...document.querySelectorAll('#compare-table .scen-card')].find(c => c.textContent.includes('Current job')).textContent.includes('Highest yearly total')`));
  check('highest card has gold highlight class', await evalJs(`[...document.querySelectorAll('#compare-table .scen-card')].find(c => c.textContent.includes('Current job')).classList.contains('highest')`));

  /* ---- 4th scenario rejected by the cap ---- */
  await addScenario('Fourth', '40000', 'multiple', '1', '2');
  check('4th scenario shows cap message', await evalJs(`!document.querySelector('#scen-error').hidden && document.querySelector('#scen-error').textContent.includes('at most 3')`));
  check('still 3 scenario cards after cap', await evalJs(`document.querySelectorAll('#compare-table .scen-card').length`) === 3);

  /* ---- export -> erase -> import round-trip ---- */
  const exported = await evalJs(`window.FBBD.exportJSON()`);
  check('export JSON parses and has app id', JSON.parse(exported).app === 'festival-bonus-bd');
  check('export has 2 festivals and 3 scenarios', JSON.parse(exported).festivals.length === 2 && JSON.parse(exported).scenarios.length === 3);
  await click('[data-tab="data"]');
  await sleep(200);
  await setVal('#erase-input', 'DELETE');
  await click('#erase-btn');
  await sleep(300);
  check('erase zeroes festival rows', await evalJs(`document.querySelectorAll('#fest-list .fest-row').length`) === 0);
  check('erase zeroes scenario cards', await evalJs(`document.querySelectorAll('#compare-table .scen-card').length`) === 0);
  check('erase resets calculator to dashes', await evalJs(`document.querySelector('#res-per').textContent`) === '\u2014');
  const imp = await evalJs(`window.FBBD.importJSON(${JSON.stringify(exported)})`);
  check('import round-trip succeeds', imp && imp.ok === true);
  await sleep(300);
  check('import restores 2 festivals', await evalJs(`document.querySelectorAll('#fest-list .fest-row').length`) === 2);
  check('import restores 3 scenarios', await evalJs(`document.querySelectorAll('#compare-table .scen-card').length`) === 3);
  check('import restores calculator 25,000.00', await evalJs(`document.querySelector('#res-per').textContent`) === '\u09f325,000.00');
  const bad = await evalJs(`window.FBBD.importJSON('{"app":"wrong","v":1}')`);
  check('bad import rejected', bad && bad.ok === false);
  check('data intact after bad import', await evalJs(`document.querySelectorAll('#fest-list .fest-row').length`) === 2);
  const bad2 = await evalJs(`window.FBBD.importJSON('{"app":"festival-bonus-bd","v":1,"calculator":{"basicPaisa":-5,"rule":{"type":"multiple","multiple":1000},"festivalsPerYear":2},"scenarios":[],"festivals":[]}')`);
  check('negative-basic import rejected', bad2 && bad2.ok === false);
  check('data intact after second bad import', await evalJs(`document.querySelectorAll('#compare-table .scen-card').length`) === 3);

  /* ---- language toggle: Bengali digits + persistence ---- */
  await click('#lang-btn');
  await sleep(300);
  check('BN toggle shows Bengali title', await evalJs(`/[\\u0980-\\u09FF]/.test(document.querySelector('#app-title').textContent)`));
  check('BN toggle shows Bengali digits on per-festival', await evalJs(`document.querySelector('#res-per').textContent.includes('\\u09e8\\u09eb')`));
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1500);
  check('language persists as BN after reload', await evalJs(`/[\\u0980-\\u09FF]/.test(document.querySelector('#app-title').textContent)`));
  check('2 festivals survive reload', await evalJs(`document.querySelectorAll('#fest-list .fest-row').length`) === 2);
  await click('[data-tab="dashboard"]');
  await sleep(300);
  check('BN dashboard expected shows Bengali digits', await evalJs(`document.querySelector('#dash-expected').textContent.includes('\\u09e9\\u09e6')`));
  await click('#lang-btn');
  await sleep(300);
  check('EN toggle back restores English title', await evalJs(`document.querySelector('#app-title').textContent.includes('Festival Bonus BD')`));

  /* ---- mobile 390px ---- */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(800);
  check('390px no horizontal overflow', await evalJs(`document.documentElement.scrollWidth <= 391`));
  check('no leaf element overflows 390px viewport', await evalJs(`(() => {
    const bad = [];
    document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width > 391 || r.right > 391) bad.push(el.tagName + '.' + (el.className && el.className.baseVal === undefined ? String(el.className).split(' ')[0] : '')); });
    return bad.length === 0 ? true : bad.slice(0, 5).join(','); })()`) === true);

  /* ---- network / errors ---- */
  const nonFile = netReqs.filter((u) => !u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:') && u !== 'about:blank');
  check('zero non-file network requests', nonFile.length === 0, nonFile.join(', '));
  check('zero console/page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
} catch (e) {
  fail++;
  console.log('FAIL harness error — ' + e.message);
} finally {
  chrome.kill();
}

console.log(`\nSmoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
