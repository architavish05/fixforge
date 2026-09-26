'use strict';

/**
 * stringUtils.js – string manipulation utilities
 *
 * NOTE: This module contains ONE deliberate bug.
 * truncate() uses `>=` instead of `>` as the length guard — strings whose
 * length exactly equals maxLen are unnecessarily truncated.
 */

/**
 * Reverses a string.
 * @param {string} str
 * @returns {string}
 */
function reverseString(str) {
  return str.split('').reverse().join('');
}

/**
 * Counts how many times a character appears in a string.
 * @param {string} str
 * @param {string} char
 * @returns {number}
 */
function countChar(str, char) {
  return str.split('').filter(c => c === char).length;
}

/**
 * Truncates a string to at most maxLen characters, appending '...' if cut.
 * Strings shorter than maxLen are returned unchanged.
 * BUG: guard uses >= instead of > — strings whose length EQUALS maxLen
 * are unnecessarily truncated.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (str.length >= maxLen) { // <-- BUG: should be `str.length > maxLen`
    return str.slice(0, maxLen - 3) + '...';
  }
  return str;
}

/**
 * Capitalises the first letter of every word.
 * @param {string} str
 * @returns {string}
 */
function titleCase(str) {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

module.exports = { reverseString, countChar, truncate, titleCase };
