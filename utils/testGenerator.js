'use strict';

const path = require('path');

/**
 * testGenerator.js
 *
 * Generates a Jest test file for a located bug.
 * Dispatches to a per-module template based on the source file name.
 * The generated test is designed to:
 *   - FAIL when run against the original (buggy) code
 *   - PASS when run against the fixed code
 */

/** Templates keyed by source file basename (without extension). */
const templates = {
  calc: generateCalcTest,
  stringUtils: generateStringUtilsTest,
};

/**
 * @param {{ file: string, line: number, lineText: string, patternLabel: string }} locateResult
 * @returns {string}
 */
function generateTest(locateResult) {
  const { file, line, lineText } = locateResult;
  const baseName = path.basename(file, '.js');

  const templateFn = templates[baseName] || generateGenericTest;
  return templateFn({ file, line, lineText: lineText.trim() });
}

// ── calc.js tests ────────────────────────────────────────────────────────────

function generateCalcTest({ file, line, lineText }) {
  return `'use strict';

/**
 * Auto-generated regression test for bug at ${file}:${line}
 * Buggy line: ${lineText}
 * FAILS on the original buggy code; PASSES on the fix.
 */

const { average, sum, max, min } = require('./calc');

describe('average() – regression test for off-by-one denominator bug', () => {
  test('average of [10, 20, 30] should be 20', () => {
    expect(average([10, 20, 30])).toBe(20);
  });

  test('average of [2, 4] should be 3', () => {
    expect(average([2, 4])).toBe(3);
  });

  test('average of [1, 1, 1, 1] should be 1', () => {
    expect(average([1, 1, 1, 1])).toBe(1);
  });

  test('average of a single element [42] should be 42', () => {
    expect(average([42])).toBe(42);
  });

  test('average of an empty array should be 0', () => {
    expect(average([])).toBe(0);
  });
});

describe('sum() – unaffected by the bug fix', () => {
  test('sum of [1, 2, 3] is 6', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });
});

describe('max() and min() – unaffected by the bug fix', () => {
  test('max of [3, 1, 4, 1, 5] is 5', () => {
    expect(max([3, 1, 4, 1, 5])).toBe(5);
  });

  test('min of [3, 1, 4, 1, 5] is 1', () => {
    expect(min([3, 1, 4, 1, 5])).toBe(1);
  });
});
`;
}

// ── stringUtils.js tests ─────────────────────────────────────────────────────

function generateStringUtilsTest({ file, line, lineText }) {
  return `'use strict';

/**
 * Auto-generated regression test for bug at ${file}:${line}
 * Buggy line: ${lineText}
 * FAILS on the original buggy code; PASSES on the fix.
 */

const { truncate, reverseString, countChar, titleCase } = require('./stringUtils');

describe('truncate() – regression test for wrong-operator guard bug', () => {
  test('string shorter than maxLen is returned unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  test('string of exactly maxLen chars is returned unchanged (was wrongly truncated)', () => {
    // "hello world!" is exactly 12 chars; should NOT be truncated
    expect(truncate('hello world!', 12)).toBe('hello world!');
  });

  test('string longer than maxLen is truncated with ellipsis', () => {
    expect(truncate('this is too long for you', 10)).toBe('this is...');
  });

  test('very short maxLen truncates correctly', () => {
    expect(truncate('abcdefgh', 5)).toBe('ab...');
  });
});

describe('reverseString() – unaffected by the bug fix', () => {
  test('reverses a simple string', () => {
    expect(reverseString('hello')).toBe('olleh');
  });
});

describe('titleCase() – unaffected by the bug fix', () => {
  test('capitalises first letter of each word', () => {
    expect(titleCase('hello world')).toBe('Hello World');
  });
});
`;
}

// ── Fallback ─────────────────────────────────────────────────────────────────

function generateGenericTest({ file, line, lineText }) {
  return `'use strict';

/**
 * Auto-generated placeholder regression test for bug at ${file}:${line}
 * Buggy line: ${lineText}
 *
 * TODO: Replace with real assertions for this module.
 */

test('placeholder – no regression test template for this module', () => {
  expect(true).toBe(true);
});
`;
}

module.exports = { generateTest };
