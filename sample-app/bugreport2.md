# Bug Report – String Truncation Trims Strings It Shouldn't

**Module:** `sample-app/stringUtils.js`
**Function:** `truncate()`
**Severity:** Medium
**Reported by:** Frontend Team
**Date:** 2025-01-16

---

## Summary

The `truncate()` function cuts strings that are exactly at the maximum length limit, even though strings at the limit should be returned unchanged.

## Steps to Reproduce

1. Import `stringUtils.js` and call `truncate("hello world!", 12)`.
2. Note that `"hello world!"` is exactly 12 characters long.
3. Observe the returned value.

## Expected Behaviour

`truncate("hello world!", 12)` should return `"hello world!"` — the string fits exactly within the limit and must not be modified.

## Actual Behaviour

`truncate("hello world!", 12)` returns `"hello wor..."` — the string is truncated despite fitting within the limit.

## Additional Examples

| Input | maxLen | Expected | Actual |
|---|---|---|---|
| `"hello world!"` | `12` | `"hello world!"` (no truncation) | `"hello wor..."` (wrongly cut) |
| `"short"` | `10` | `"short"` | `"short"` ✓ |
| `"this is too long"` | `10` | `"this is..."` | `"this is..."` ✓ |

## Impact

Any UI component that uses `truncate()` to fit text into a fixed-width container will incorrectly shorten strings that already fit, adding unwanted ellipsis and degrading displayed content.

## Notes

- `reverseString()`, `countChar()`, and `titleCase()` in the same file all appear to work correctly.
- Only strings whose length exactly equals `maxLen` are affected.
- Strings strictly shorter than `maxLen` are returned correctly.
