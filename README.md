# Festival Bonus BD

Offline, bilingual (EN / বাংলা) festival bonus calculator and tracker for Bangladeshi employees. Work out what each festival bonus should be under your employer's rule, compare up to three scenarios side by side, and track expected vs received bonuses across the year — with no festival dates and no amounts pre-filled, because Eid dates depend on moon sighting and bonus rules vary by employer.

## Problem

Festival bonuses in Bangladesh are usually one basic salary per festival, but the rule is never the same everywhere: some employers pay a multiple of basic, some a percentage, some a fixed amount, and the number of festivals per year differs too. Employees have no simple way to check what they should get, compare offers, or keep track of what actually arrived. This app answers all three with transparent integer-paisa math and nothing assumed on your behalf.

## Features

1. **Bonus calculator** — monthly basic salary (৳) + bonus rule → per-festival bonus, yearly total, monthly equivalent. Rule types: multiple of basic (1×, 0.5×, or any custom multiple), % of basic, or a fixed amount. Festivals per year: 1 or 2.
2. **Sector presets (suggestions only)** — Government / Private / Garment / Other. Each preset only pre-fills a suggested rule (1× basic per festival) and stays fully editable. The UI states plainly that these are common practice, not a legal ruling, and to confirm with your employer / HR.
3. **Scenario comparison** — save up to 3 scenarios (name + basic + rule + festivals/year) and compare them side by side; the highest yearly total is highlighted.
4. **Festival tracker** — festival entries with name (datalist suggestions: Eid-ul-Fitr, Eid-ul-Adha, Durga Puja, Christmas, Buddha Purnima, Janmashtami, Easter, Other — free text allowed), date, expected amount, received amount, optional paid date. Status is derived automatically: Expected / Partial / Received / Overdue (date passed and received < expected). Over-receipt is allowed and shown as "extra", never rejected.
5. **Dashboard** — this-year expected total, received total, pending total, next upcoming festival + days to go, and per-festival progress bars. Year filter (current year by default; entries grouped by the year of their date).
6. **Data tools** — JSON export (download), strict import (app tag `festival-bonus-bd`, version 1; every field validated; malformed input rejected with existing data intact and a clear error), typed-`DELETE` erase-all.
7. **Bilingual + offline** — EN/বাংলা toggle persisted in localStorage, Bengali digits in Bengali mode, localStorage persistence, zero network requests, 390px mobile layout. All app sources are pure ASCII: Bengali text lives as `\uXXXX` escapes in `js/i18n.js`.

## Money and dates

- All money is integer paisa (1 Taka = 100 paisa) end to end — no float rounding error. A multiple is stored in thousandths (1× = 1000), a percent in hundredths of a percent (50% = 5000).
- Dates are ISO `YYYY-MM-DD`. `?asof=YYYY-MM-DD` overrides "today" for deterministic testing (used by the smoke test).

### Hand-verified examples

- Basic ৳25,000, rule 1× basic, 2 festivals/year: per festival **৳25,000.00**, yearly **৳50,000.00**, monthly equivalent **৳4,166.67**.
- Same basic at 0.5×: per festival **৳12,500.00**, yearly **৳25,000.00**.
- Same basic at 50% of basic: per festival **৳12,500.00**, yearly **৳25,000.00**.
- Fixed ৳10,000 per festival, 2 festivals/year: yearly **৳20,000.00**, monthly **৳1,666.67**.
- Tracker: Eid-ul-Fitr 2026-12-20, expected ৳25,000, received ৳10,000 → status **Partial**, dashboard pending **৳15,000.00**; as of 2026-11-17 the next festival is **33 days** away.
- Compare: "Current job" (25,000 × 1× × 2) yearly **৳50,000.00** beats "New offer" (30,000 × 0.5× × 2) and "Fixed shop" (fixed 15,000 × 2), both **৳30,000.00** — the highest is highlighted.

## Stack

- Pure static site: HTML + CSS + vanilla JavaScript (no framework, no build step, no CDN).
- State in `localStorage` (`fbbd-state-v1`); language lives inside the same state object.
- Tests: Node's built-in `node:test` for logic, raw-CDP headless-Chrome smoke test (no dependencies).

## Prerequisites

- Any modern browser, or Node.js 18+ to run the tests.
- No accounts, keys, or network access needed.

## Install & run

```bash
# just open it
open index.html
# or serve locally
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Dev commands

```bash
node tests/test.js      # unit tests (logic only)
node tests/smoke.mjs    # headless-Chrome smoke test (needs the cached headless_shell)
grep -rP '[^\x00-\x7F]' index.html css js   # must print nothing (pure-ASCII sources)
```

## Environment

No environment variables. No secrets. Everything runs locally in the browser.

## Testing

- **Unit:** 14/14 pass (`node tests/test.js`) — paisa parsing, multiple/%/fixed math (incl. the hand-verified 25,000 / 50,000 / 4,166.67 case), formatting with Bengali digits, calculator/rule validation, scenario compare ordering and highest flag, date validation (incl. leap-year edges), status derivation (incl. the same-day boundary), next-festival computation, dashboard totals (incl. over-receipt extra), import validation (20 malformed inputs rejected), i18n completeness (91 keys), empty default state.
- **Smoke:** 70/70 pass (`node tests/smoke.mjs`) — real UI in headless Chrome with `?asof=2026-11-17`: calculator hand-verified figures, preset applies 1× and stays editable, % and fixed rules, 1-vs-2 festivals, basic-0 inline error, use-in-tracker prefill, tracker validation, dashboard totals and 33-days-to-go, partial receipt → Partial status, overdue festival flagged, 3-scenario compare with highest highlight and cap message, export → erase → import round-trip, two malformed imports rejected with data intact, EN/বাংলা toggle with Bengali digits and reload persistence, 390px no-overflow, zero non-file network requests, 0 console/page errors.
- Repairs during this run: 2 test-side fixes (one wrong hand-computed percent expectation, one grouped-year formatting expectation) and 1 real display bug found while writing the tests — `fmtNum` added thousands separators inside ISO dates ("2026-12-20" rendered as "2,026-12-20"); dates and years now render through a dedicated `dateStr` helper that only converts digits in Bengali mode.

## Deployment

Static site — publish the repo root with GitHub Pages (or any static host). No server, no build.

## Limitations

- Bonus rules vary by employer — this app calculates under the rule *you* enter; it is not a legal ruling on entitlement. Confirm your actual rule with your employer / HR.
- No festival dates are built in: Eid dates depend on moon sighting, so every date is user-entered.
- Amounts shown are gross; tax treatment varies, so confirm with your employer.
- Data is stored only in the browser's localStorage on one device; use Export to move it or keep a backup.

## Status

Complete MVP. No known bugs. See `TEST_RESULTS.md` for the full test log.
