# Bug Report – Incorrect Average Calculation

**Module:** `sample-app/calc.js`
**Function:** `average()`
**Severity:** High
**Reported by:** QA Team
**Date:** 2025-01-15

---

## Summary

The `average()` function returns wrong results for any array with more than one element.

## Steps to Reproduce

1. Import `calc.js` and call `average([10, 20, 30])`.
2. Observe the returned value.

## Expected Behaviour

`average([10, 20, 30])` should return `20` — the arithmetic mean of 10, 20, and 30.

## Actual Behaviour

`average([10, 20, 30])` returns `30` instead of `20`.

## Additional Examples

| Input | Expected | Actual |
|---|---|---|
| `[2, 4]` | `3` | `6` |
| `[1, 1, 1, 1]` | `1` | `1.333...` |
| `[100]` | `100` | `0` (division by zero, returns `Infinity`) |

## Impact

Any feature that relies on computing an average (e.g. grade summaries, statistics dashboards, report aggregations) will silently produce incorrect results without throwing an error, making the bug difficult to notice in production.

## Notes

- `sum()`, `max()`, and `min()` in the same file all appear to work correctly.
- The bug only manifests when the input array has more than one element.
- Single-element arrays produce `Infinity` (or `NaN` on some runtimes) rather than the element's own value.
