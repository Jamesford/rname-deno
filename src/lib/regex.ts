/**
 * Matches on period or underscore separated title followed by a sequence of 4 digits starting with 19 or 20.
 */
export const movieFileName = /^(.+)[._]((?:19|20)\d{2})/i;

/**
 * Matches text followed by season and episode digits.
 */
export const tvFileName = /(.+?)s?(\d+)[ex](\d+)[ex-]{0,2}(\d+)?/i;

/**
 * Matches text followed by season and episode digits after a "/".
 */
export const tvFileNameFromPath = /([^/]+?)s?(\d+)[ex](\d+)[ex-]{0,2}(\d+)?/i;

/**
 * Matches on variations of "/sub(s|titles?)?/" within a string
 */
export const subtitlePath = /\/sub(s|titles?)?\//i;

/**
 * Matches "y:" followed by 4 digits in a string & caputre group on the digits. Case insensitive, non-global.
 */
export const definesYear = /y:(\d{4})/i;
