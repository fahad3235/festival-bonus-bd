# Festival Bonus BD — Test Results

Run date: 2026-11-18 (Asia/Dhaka). Deterministic date for the smoke test: `?asof=2026-11-17`.

## Unit tests — 14/14 pass

Command: `node tests/test.js`

```
ℹ tests 14
ℹ pass 14
ℹ fail 0
```

Coverage:

- Paisa parsing (incl. `0.01` → 1 paisa, `25,000` → 2,500,000, rejects `0`, negatives, non-numeric).
- Multiple rule, hand-verified: basic ৳25,000 × 1 = ৳25,000 per festival; × 0.5 = ৳12,500; 2 festivals → ৳50,000/yr; monthly equivalent ৳4,166.67 (416,667 paisa).
- Percent rule (50% → ৳12,500; 100% → full basic; 33.33% of ৳33,333 → ৳11,109.89) and fixed rule (৳10,000 × 2 → ৳20,000/yr, ৳1,666.67/mo).
- Multiple/percent parse + display round-trip.
- Money/number formatting, EN and Bengali digits (৳25,000.00 → ৳২৫,০০০.০০).
- Calculator and rule validation; sector presets are 1× multiple for Government/Private/Garment, `null` for Other.
- Scenario compare ordering (50,000 > 30,000 = 30,000, tie keeps insertion order) and highest flag.
- Date validation: leap year 2024-02-29 valid, 2026-02-29 invalid, 2026-04-31 invalid; `daysBetween` 2026-11-17 → 2026-12-20 = 33.
- Status derivation: same-day date is Expected (not Overdue); day before is Overdue; Partial at ৳10,000/৳25,000; Received at full; over-receipt (৳30,000/৳25,000) counts as Received.
- Next festival: earliest on/after as-of, 33 days to 2026-12-20; none when all past.
- Dashboard totals: 2026 expected ৳55,000 / received ৳35,000 / pending ৳20,000 across 3 festivals (2027 entry excluded); per-festival progress 100/0/40; over-receipt tracked as extra ৳5,000 with pending −৳5,000.
- Import validation: good data accepted (incl. fresh state with `basicPaisa: null`); 20 malformed inputs rejected (non-object, wrong app tag, wrong version, missing/negative calculator, bad rule, festivals-per-year 3, non-array scenarios/festivals, 4 scenarios, duplicate ids, invalid scenario/festival, bad date, negative received, bad lang, bad sector).
- i18n completeness: 91 keys, every key with non-empty EN and BN strings; Bengali script present in title, tabs, statuses, disclaimer.
- Default state ships empty: no dates, no amounts, validates as importable.

## Headless-Chrome smoke — 70/70 pass

Command: `node tests/smoke.mjs` (raw CDP via cached `headless_shell`, fresh profile each run, `?asof=2026-11-17`)

```
Smoke: 70 passed, 0 failed
```

Verified in the real UI:

- Initial render: title, dashes before input, tracker empty state, disclaimer, no overflow at 1440px.
- Calculator hand-verified: ৳25,000 basic, 1×, 2 festivals → per-festival ৳25,000.00, yearly ৳50,000.00, monthly ৳4,166.67.
- Government preset applies 1×, shows the "common practice" note, and stays editable (0.5× → ৳12,500.00, back to 1× → ৳25,000.00).
- Percent rule 50% → ৳12,500.00 / ৳25,000.00 yearly; fixed rule ৳10,000 → ৳10,000.00 / ৳20,000.00 yearly; 1 festival/yr halves the yearly total.
- Basic 0 → inline error, results show dashes; restoring 25,000 restores the figures.
- "Use this amount in tracker" switches to the tracker tab and prefills expected 25000.
- Empty festival submit → inline name error, 0 rows.
- Add Eid-ul-Fitr 2026-12-20 (expected ৳25,000, received ৳0) → status Expected; dashboard expected ৳25,000.00, received ৳0.00, pending ৳25,000.00, next festival Eid-ul-Fitr, 33 days to go.
- Partial receipt ৳10,000 → status Partial; dashboard received ৳10,000.00, pending ৳15,000.00.
- Overdue festival Durga Puja 2026-11-01 (expected ৳5,000, received ৳0) → flagged Overdue; dashboard expected ৳30,000.00.
- Compare: 3 scenarios added — "Current job" yearly ৳50,000.00, "New offer" and "Fixed shop" yearly ৳30,000.00 each; highest badge + gold highlight on "Current job". A 4th scenario is rejected with the cap message; card count stays 3.
- Export → erase → import round-trip: export parses with app id `festival-bonus-bd`, 2 festivals, 3 scenarios; erase zeroes festivals, scenarios, and calculator; import restores all three. Two malformed imports (wrong app tag; negative basic) rejected with data intact.
- EN/বাংলা toggle: Bengali title and Bengali digits on per-festival (২৫,০০০.০০); language persists across reload; 2 festivals survive reload; Bengali dashboard expected (৩০,০০০.০০); toggle back restores English.
- 390px: no horizontal overflow, no leaf element overflows the viewport.
- Zero non-file network requests; 0 console/page errors.

## ASCII-source check

Command: `grep -rP '[^\x00-\x7F]' index.html css js` → no matches (exit 1). All Bengali text is `\uXXXX` escapes in `js/i18n.js` (91 keys).

## Repairs made during this run

1. Real display bug (found while writing tests): `fmtNum` added thousands separators inside ISO dates, so "2026-12-20" would have rendered as "2,026-12-20". Fixed with a dedicated `dateStr` helper in `js/app.js` that only converts digits in Bengali mode. Re-ran: unit 14/14, smoke 70/70.
2. Test-side fix: wrong hand-computed percent expectation (33.33% of ৳33,333 is ৳11,109.89, not ৳11,110.89).
3. Test-side fix: `fmtNum(2026, 'bn')` groups to "২,০২৬" — expectation corrected; years/dates in the app do not use `fmtNum` (see repair 1).

No other failures. No repair cycles remaining unused beyond the one real bug fix above.
