/**
 * calc.js – basic calculator utilities
 *
 * NOTE: This module contains ONE deliberate bug.
 * Bug is on line 24: the average() function divides by (numbers.length - 1)
 * instead of numbers.length, producing an off-by-one error in the denominator.
 */

/**
 * Returns the sum of an array of numbers.
 * @param {number[]} numbers
 * @returns {number}
 */
function sum(numbers) {
  return numbers.reduce((acc, n) => acc + n, 0);
}

/**
 * Returns the arithmetic mean of an array of numbers.
 * BUG: divides by (numbers.length - 1) instead of numbers.length.
 * @param {number[]} numbers
 * @returns {number}
 */
function average(numbers) {
  if (numbers.length === 0) return 0;
  return sum(numbers) / (numbers.length - 1); // <-- BUG: should be numbers.length
}

/**
 * Returns the largest number in the array.
 * @param {number[]} numbers
 * @returns {number}
 */
function max(numbers) {
  if (numbers.length === 0) return -Infinity;
  return Math.max(...numbers);
}

/**
 * Returns the smallest number in the array.
 * @param {number[]} numbers
 * @returns {number}
 */
function min(numbers) {
  if (numbers.length === 0) return Infinity;
  return Math.min(...numbers);
}

module.exports = { sum, average, max, min };
