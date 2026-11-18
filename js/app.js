/* festival-bonus-bd - app (DOM layer). Pure-ASCII source: all Bengali text
 * comes from js/i18n.js. ?asof=YYYY-MM-DD overrides "today" for tests. */
'use strict';

(function () {
  var STORE_KEY = 'fbbd-state-v1';

  var params = new URLSearchParams(window.location.search);
  var ASOF = params.get('asof');
  if (!ASOF || !isValidDate(ASOF)) ASOF = todayISO();

  var state = load();
  var dashYear = ASOF.slice(0, 4);

  /* ---------- state ---------- */

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      var obj = JSON.parse(raw);
      if (!validateImport(obj).ok) return defaultState();
      return normalize(obj);
    } catch (e) {
      return defaultState();
    }
  }

  function normalize(obj) {
    var s = defaultState();
    s.lang = obj.lang === 'bn' ? 'bn' : 'en';
    s.calculator = obj.calculator;
    s.sector = obj.sector || null;
    s.scenarios = obj.scenarios || [];
    s.festivals = obj.festivals || [];
    return s;
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked: app still works in-memory */ }
  }

  /* ---------- i18n ---------- */

  function t(key) {
    var e = I18N[key];
    if (!e) return key;
    return e[state.lang] || e.en;
  }

  function applyI18n() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    document.getElementById('lang-btn').textContent = state.lang === 'en' ? t('langToBn') : t('langToEn');
  }

  /* ---------- helpers ---------- */

  function $(id) { return document.getElementById(id); }

  function el(tag, text, className) {
    var n = document.createElement(tag);
    if (text !== undefined && text !== null) n.textContent = text;
    if (className) n.className = className;
    return n;
  }

  function showErr(id, msg) {
    var n = $(id);
    if (!n) return;
    if (msg) { n.textContent = msg; n.hidden = false; } else { n.textContent = ''; n.hidden = true; }
  }

  function takaString(paisa) {
    var s = (paisa / 100).toFixed(2).replace(/\.00$/, '');
    return s;
  }

  /* Dates and years are shown as-is, with Bengali digits in bn mode.
   * (fmtNum would add thousands separators inside "2026-12-20".) */
  function dateStr(s) {
    return state.lang === 'bn' ? toBnDigits(s) : s;
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.panel').forEach(function (p) { p.hidden = true; });
    $('panel-' + name).hidden = false;
    if (name === 'dashboard') renderDashboard();
  }

  /* ---------- calculator ---------- */

  function readCalcInputs() {
    var basicRaw = $('calc-basic').value;
    var type = $('calc-rule').value;
    var rule = null;
    var ruleRaw = '';
    if (type === 'multiple') {
      ruleRaw = $('calc-multiple').value;
      var m = parseMultiple(ruleRaw);
      if (m !== null) rule = { type: 'multiple', multiple: m };
    } else if (type === 'percent') {
      ruleRaw = $('calc-percent').value;
      var p = parsePercent(ruleRaw);
      if (p !== null) rule = { type: 'percent', percent: p };
    } else {
      ruleRaw = $('calc-fixed').value;
      var f = toPaisa(ruleRaw);
      if (f !== null) rule = { type: 'fixed', fixedPaisa: f };
    }
    return {
      basicRaw: basicRaw,
      basic: toPaisa(basicRaw),
      type: type,
      rule: rule,
      ruleRaw: ruleRaw,
      festivals: parseInt($('calc-festivals').value, 10)
    };
  }

  function renderCalculator() {
    var c = readCalcInputs();
    $('calc-multiple-wrap').hidden = c.type !== 'multiple';
    $('calc-percent-wrap').hidden = c.type !== 'percent';
    $('calc-fixed-wrap').hidden = c.type !== 'fixed';

    var basicBad = c.basicRaw.trim() !== '' && c.basic === null;
    showErr('calc-basic-error', basicBad ? t('errBasic') : '');
    $('calc-basic').classList.toggle('invalid', basicBad);

    var ruleBad = c.ruleRaw.trim() !== '' && c.rule === null;
    var ruleMsg = '';
    if (ruleBad) ruleMsg = c.type === 'multiple' ? t('errMultiple') : c.type === 'percent' ? t('errPercent') : t('errFixed');
    showErr('calc-rule-error', ruleMsg);

    var errs = validateCalculator(c.basic, c.rule, c.festivals);
    if (errs.length === 0) {
      var r = calcBonus(c.basic, c.rule, c.festivals);
      $('res-per').textContent = fmtMoney(r.perFestival, state.lang);
      $('res-yearly').textContent = fmtMoney(r.yearly, state.lang);
      $('res-monthly').textContent = fmtMoney(r.monthly, state.lang);
      state.calculator.basicPaisa = c.basic;
      state.calculator.rule = c.rule;
      state.calculator.festivalsPerYear = c.festivals;
      save();
    } else {
      $('res-per').textContent = '\u2014';
      $('res-yearly').textContent = '\u2014';
      $('res-monthly').textContent = '\u2014';
    }
  }

  function syncCalculatorFromState() {
    var c = state.calculator;
    $('calc-basic').value = c.basicPaisa ? takaString(c.basicPaisa) : '';
    $('calc-rule').value = c.rule.type;
    if (c.rule.type === 'multiple') $('calc-multiple').value = multipleDisplay(c.rule.multiple);
    if (c.rule.type === 'percent') $('calc-percent').value = percentDisplay(c.rule.percent);
    if (c.rule.type === 'fixed') $('calc-fixed').value = takaString(c.rule.fixedPaisa);
    $('calc-festivals').value = String(c.festivalsPerYear);
    markPreset(state.sector);
  }

  function markPreset(sector) {
    document.querySelectorAll('.preset-btn').forEach(function (b) {
      b.classList.toggle('selected', b.getAttribute('data-preset') === sector);
    });
    $('preset-note').hidden = !(sector === 'government' || sector === 'private' || sector === 'garment');
  }

  function applyPreset(sector) {
    state.sector = sector;
    if (sector === 'other') {
      markPreset(null);
      state.sector = null;
    } else {
      var preset = PRESETS[sector];
      $('calc-rule').value = preset.type;
      $('calc-multiple').value = multipleDisplay(preset.multiple);
      markPreset(sector);
    }
    save();
    renderCalculator();
  }

  /* ---------- tracker ---------- */

  function renderFestivals() {
    var list = $('fest-list');
    list.innerHTML = '';
    var sorted = state.festivals.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
    $('fest-empty').hidden = sorted.length > 0;
    sorted.forEach(function (f) {
      var status = festivalStatus(f, ASOF);
      var li = el('li', null, 'fest-row');
      li.setAttribute('data-fest-id', f.id);

      var head = el('div', null, 'fest-row-head');
      head.appendChild(el('span', f.name, 'fest-name'));
      head.appendChild(el('span', dateStr(f.date), 'fest-date'));
      head.appendChild(el('span', t('status' + status.charAt(0).toUpperCase() + status.slice(1)), 'badge badge-' + status));
      li.appendChild(head);

      var amounts = el('div', null, 'fest-amounts');
      amounts.appendChild(el('span', t('expectedShort') + ': '));
      amounts.lastChild.appendChild(el('strong', fmtMoney(f.expectedPaisa, state.lang)));
      amounts.appendChild(el('span', t('receivedShort') + ': '));
      amounts.lastChild.appendChild(el('strong', fmtMoney(f.receivedPaisa, state.lang)));
      if (f.receivedPaisa > f.expectedPaisa) {
        amounts.appendChild(el('span', '+' + fmtMoney(f.receivedPaisa - f.expectedPaisa, state.lang) + ' ' + t('extraLabel'), 'extra-tag'));
      }
      li.appendChild(amounts);

      if (f.paidDate) li.appendChild(el('div', t('paidOn') + ' ' + dateStr(f.paidDate), 'paid-line'));

      var actions = el('div', null, 'fest-actions');
      var recvInput = el('input', null, 'mini-input fest-received-input');
      recvInput.type = 'number';
      recvInput.min = '0';
      recvInput.step = '0.01';
      recvInput.value = takaString(f.receivedPaisa);
      recvInput.setAttribute('aria-label', t('receivedLabel'));
      actions.appendChild(recvInput);

      var upd = el('button', t('updateBtn'), 'btn small');
      upd.type = 'button';
      upd.addEventListener('click', function () {
        var v = toPaisaNonNeg(recvInput.value);
        if (v === null) { rowErr.textContent = t('errReceived'); return; }
        f.receivedPaisa = v;
        save();
        renderFestivals();
        renderDashboard();
      });
      actions.appendChild(upd);

      var mark = el('button', t('markReceived'), 'btn small');
      mark.type = 'button';
      mark.addEventListener('click', function () {
        f.receivedPaisa = f.expectedPaisa;
        save();
        renderFestivals();
        renderDashboard();
      });
      actions.appendChild(mark);

      var del = el('button', t('deleteBtn'), 'btn small danger');
      del.type = 'button';
      del.classList.add('fest-del');
      del.addEventListener('click', function () {
        state.festivals = state.festivals.filter(function (x) { return x.id !== f.id; });
        save();
        renderFestivals();
        renderDashboard();
      });
      actions.appendChild(del);

      var rowErr = el('p', '', 'field-error');
      rowErr.hidden = true;
      actions.appendChild(rowErr);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  /* ---------- compare ---------- */

  function readScenInputs() {
    var type = $('scen-rule').value;
    var rule = null;
    var ruleRaw = '';
    if (type === 'multiple') {
      ruleRaw = $('scen-multiple').value;
      var m = parseMultiple(ruleRaw);
      if (m !== null) rule = { type: 'multiple', multiple: m };
    } else if (type === 'percent') {
      ruleRaw = $('scen-percent').value;
      var p = parsePercent(ruleRaw);
      if (p !== null) rule = { type: 'percent', percent: p };
    } else {
      ruleRaw = $('scen-fixed').value;
      var f = toPaisa(ruleRaw);
      if (f !== null) rule = { type: 'fixed', fixedPaisa: f };
    }
    return {
      name: $('scen-name').value.trim(),
      basic: toPaisa($('scen-basic').value),
      basicRaw: $('scen-basic').value,
      type: type,
      rule: rule,
      ruleRaw: ruleRaw,
      festivals: parseInt($('scen-festivals').value, 10)
    };
  }

  function ruleText(rule) {
    if (rule.type === 'multiple') return multipleDisplay(rule.multiple) + 'x \u00b7 ' + t('ruleMultiple');
    if (rule.type === 'percent') return percentDisplay(rule.percent) + '% \u00b7 ' + t('rulePercent');
    return fmtMoney(rule.fixedPaisa, state.lang) + ' \u00b7 ' + t('ruleFixed');
  }

  function renderCompare() {
    var grid = $('compare-table');
    grid.innerHTML = '';
    $('scen-empty').hidden = state.scenarios.length > 0;
    var rows = compareScenarios(state.scenarios);
    rows.forEach(function (r) {
      var card = el('div', null, 'scen-card' + (r.highest ? ' highest' : ''));
      card.setAttribute('data-scen-id', r.scenario.id);
      if (r.highest) card.appendChild(el('span', t('highestBadge'), 'highest-badge'));
      card.appendChild(el('h4', r.scenario.name));
      card.appendChild(el('p', ruleText(r.scenario.rule) + ' \u00b7 ' + fmtNum(r.scenario.festivalsPerYear, state.lang) + ' ' + t('festivalsLabel'), 'scen-rule-line'));
      var mk = function (label, paisa, cls) {
        var row = el('div', null, 'scen-row');
        row.appendChild(el('span', label));
        var v = el('strong', fmtMoney(paisa, state.lang));
        if (cls) v.className = cls;
        row.appendChild(v);
        return row;
      };
      card.appendChild(mk(t('perFestival'), r.perFestival));
      card.appendChild(mk(t('yearlyTotal'), r.yearly, 'scen-yearly'));
      card.appendChild(mk(t('monthlyEquiv'), r.monthly));
      var del = el('button', t('deleteBtn'), 'btn small danger scen-del');
      del.type = 'button';
      del.addEventListener('click', function () {
        state.scenarios = state.scenarios.filter(function (x) { return x.id !== r.scenario.id; });
        save();
        renderCompare();
      });
      card.appendChild(del);
      grid.appendChild(card);
    });
  }

  /* ---------- dashboard ---------- */

  function renderDashboard() {
    var years = {};
    state.festivals.forEach(function (f) { years[f.date.slice(0, 4)] = true; });
    years[ASOF.slice(0, 4)] = true;
    var yearList = Object.keys(years).sort().reverse();
    var sel = $('dash-year');
    var prev = sel.value || dashYear;
    sel.innerHTML = '';
    yearList.forEach(function (y) {
      var o = document.createElement('option');
      o.value = y;
      o.textContent = dateStr(y);
      sel.appendChild(o);
    });
    dashYear = yearList.indexOf(prev) >= 0 ? prev : ASOF.slice(0, 4);
    sel.value = dashYear;

    var d = dashboardTotals(state.festivals, dashYear, ASOF);
    $('dash-expected').textContent = fmtMoney(d.expected, state.lang);
    $('dash-received').textContent = fmtMoney(d.received, state.lang);
    $('dash-pending').textContent = fmtMoney(d.pending, state.lang);
    if (d.next) {
      $('dash-next').textContent = d.next.festival.name + ' \u00b7 ' + dateStr(d.next.festival.date);
      $('dash-days').textContent = fmtNum(d.next.days, state.lang) + ' ' + t('daysToGo');
    } else {
      $('dash-next').textContent = t('noUpcoming');
      $('dash-days').textContent = '';
    }

    var prog = $('dash-progress');
    prog.innerHTML = '';
    $('dash-empty').hidden = d.items.length > 0;
    d.items.forEach(function (it) {
      var row = el('div', null, 'progress-row');
      var head = el('div', null, 'progress-head');
      head.appendChild(el('span', it.festival.name + ' \u00b7 ' + dateStr(it.festival.date)));
      head.appendChild(el('span', fmtMoney(it.festival.receivedPaisa, state.lang) + ' / ' + fmtMoney(it.festival.expectedPaisa, state.lang) + ' \u00b7 ' + fmtNum(it.progress, state.lang) + '%'));
      row.appendChild(head);
      var bar = el('div', null, 'progress-bar');
      var fill = el('div', null, 'progress-fill' + (it.progress >= 100 ? ' full' : ''));
      fill.style.width = it.progress + '%';
      bar.appendChild(fill);
      row.appendChild(bar);
      prog.appendChild(row);
    });
  }

  /* ---------- data ---------- */

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: 'parse' }; }
    var v = validateImport(obj);
    if (!v.ok) return { ok: false, error: v.error };
    state = normalize(obj);
    save();
    syncCalculatorFromState();
    applyI18n();
    renderAll();
    return { ok: true };
  }

  /* ---------- render all ---------- */

  function renderAll() {
    renderCalculator();
    renderFestivals();
    renderCompare();
    renderDashboard();
  }

  /* ---------- wiring ---------- */

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
  });

  $('lang-btn').addEventListener('click', function () {
    state.lang = state.lang === 'en' ? 'bn' : 'en';
    save();
    applyI18n();
    renderAll();
  });

  ['calc-basic', 'calc-multiple', 'calc-percent', 'calc-fixed'].forEach(function (id) {
    $(id).addEventListener('input', renderCalculator);
  });
  $('calc-rule').addEventListener('change', renderCalculator);
  $('calc-festivals').addEventListener('change', renderCalculator);

  document.querySelectorAll('.chip[data-multiple]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      $('calc-rule').value = 'multiple';
      $('calc-multiple').value = chip.getAttribute('data-multiple');
      renderCalculator();
    });
  });

  document.querySelectorAll('.preset-btn').forEach(function (b) {
    b.addEventListener('click', function () { applyPreset(b.getAttribute('data-preset')); });
  });

  $('use-in-tracker').addEventListener('click', function () {
    var c = readCalcInputs();
    if (validateCalculator(c.basic, c.rule, c.festivals).length > 0) return;
    var r = calcBonus(c.basic, c.rule, c.festivals);
    $('fest-expected').value = takaString(r.perFestival);
    $('copied-msg').hidden = false;
    switchTab('tracker');
    $('fest-name').focus();
  });

  $('fest-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = {
      id: newId('fest'),
      name: $('fest-name').value.trim(),
      date: $('fest-date').value,
      expectedPaisa: toPaisaNonNeg($('fest-expected').value),
      receivedPaisa: $('fest-received').value.trim() === '' ? 0 : toPaisaNonNeg($('fest-received').value),
      paidDate: $('fest-paid').value || null
    };
    var errs = validateFestival(f);
    showErr('fest-name-error', errs.indexOf('name') >= 0 ? t('errName') : '');
    showErr('fest-date-error', errs.indexOf('date') >= 0 ? t('errDate') : '');
    showErr('fest-expected-error', errs.indexOf('expected') >= 0 ? t('errExpected') : '');
    showErr('fest-received-error', errs.indexOf('received') >= 0 ? t('errReceived') : '');
    showErr('fest-paid-error', errs.indexOf('paidDate') >= 0 ? t('errPaidDate') : '');
    if (errs.length > 0) return;
    state.festivals.push(f);
    save();
    $('fest-form').reset();
    $('fest-received').value = '0';
    renderFestivals();
    renderDashboard();
  });

  $('scen-rule').addEventListener('change', function () {
    var ty = $('scen-rule').value;
    $('scen-multiple-wrap').hidden = ty !== 'multiple';
    $('scen-percent-wrap').hidden = ty !== 'percent';
    $('scen-fixed-wrap').hidden = ty !== 'fixed';
  });

  $('scen-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (state.scenarios.length >= 3) {
      showErr('scen-error', t('scenCapMsg'));
      return;
    }
    var s = readScenInputs();
    var scen = {
      id: newId('scen'),
      name: s.name,
      basicPaisa: s.basic,
      rule: s.rule,
      festivalsPerYear: s.festivals
    };
    var errs = validateScenario(scen);
    showErr('scen-name-error', errs.indexOf('name') >= 0 ? t('errScenName') : '');
    showErr('scen-basic-error', errs.indexOf('basic') >= 0 ? t('errBasic') : '');
    var ruleMsg = '';
    if (errs.indexOf('multiple') >= 0) ruleMsg = t('errMultiple');
    else if (errs.indexOf('percent') >= 0) ruleMsg = t('errPercent');
    else if (errs.indexOf('fixed') >= 0) ruleMsg = t('errFixed');
    showErr('scen-error', ruleMsg);
    if (errs.length > 0) return;
    state.scenarios.push(scen);
    save();
    $('scen-form').reset();
    $('scen-multiple').value = '1';
    $('scen-percent').value = '100';
    $('scen-rule').value = 'multiple';
    $('scen-multiple-wrap').hidden = false;
    $('scen-percent-wrap').hidden = true;
    $('scen-fixed-wrap').hidden = true;
    renderCompare();
  });

  $('dash-year').addEventListener('change', function () {
    dashYear = $('dash-year').value;
    renderDashboard();
  });

  $('export-btn').addEventListener('click', function () {
    var blob = new Blob([exportJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'festival-bonus-bd.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('import-btn').addEventListener('click', function () {
    var res = importJSON($('import-text').value);
    var msg = $('import-msg');
    msg.hidden = false;
    if (res.ok) {
      msg.textContent = t('importOk');
      msg.className = 'field-msg ok';
      $('import-text').value = '';
    } else {
      msg.textContent = t('importFail');
      msg.className = 'field-msg bad';
    }
  });

  $('erase-btn').addEventListener('click', function () {
    var msg = $('erase-msg');
    msg.hidden = false;
    if ($('erase-input').value !== 'DELETE') {
      msg.textContent = t('eraseHint');
      msg.className = 'field-msg bad';
      return;
    }
    state = defaultState();
    save();
    $('erase-input').value = '';
    msg.textContent = t('erasedMsg');
    msg.className = 'field-msg ok';
    syncCalculatorFromState();
    applyI18n();
    renderAll();
  });

  /* ---------- init ---------- */

  applyI18n();
  syncCalculatorFromState();
  renderAll();

  window.FBBD = {
    exportJSON: exportJSON,
    importJSON: importJSON,
    getState: function () { return state; },
    getAsof: function () { return ASOF; }
  };
})();
