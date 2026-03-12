'use strict';

const AppError = require('../errors/AppError');

const URL_REGEX = /^https?:\/\/.+/i;

// SSRF protection: block RFC 1918, loopback, link-local, and cloud metadata addresses.
// A publicly deployed scraper must never reach internal networks.
const PRIVATE_HOSTNAME_RE = /^(localhost|.*\.local)$/i;
// Covers: 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x (AWS metadata), 0.0.0.0, IPv6 loopback
const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1$|\[::1\])/;

function assertNotPrivate(hostname) {
  if (PRIVATE_HOSTNAME_RE.test(hostname) || PRIVATE_IP_RE.test(hostname)) {
    throw new AppError(
      'SSRF_BLOCKED',
      `Hostname "${hostname}" is a private/internal address. Only public internet URLs are allowed.`,
      400
    );
  }
}

function validateUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new AppError('MISSING_URL', 'url is required and must be a string', 400);
  }

  const trimmed = input.trim();

  if (!trimmed) {
    throw new AppError('MISSING_URL', 'url must not be empty', 400);
  }

  if (trimmed.length > 2048) {
    throw new AppError('INVALID_URL', `URL is too long (${trimmed.length} chars, max 2048)`, 400);
  }

  if (!URL_REGEX.test(trimmed)) {
    const preview = trimmed.slice(0, 60);
    const suggestion = trimmed.startsWith('//') ? `https:${trimmed}` : `https://${trimmed}`;
    throw new AppError(
      'INVALID_URL',
      `URL must start with http:// or https://. Got: "${preview}". Did you mean: "${suggestion}"?`,
      400
    );
  }

  // Parse and validate — catches `http://` alone, malformed URLs, etc.
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('INVALID_URL', `URL "${trimmed.slice(0, 80)}" could not be parsed. Check for missing hostname or invalid characters.`, 400);
  }

  assertNotPrivate(parsed.hostname);

  return trimmed;
}

function validateUrls(input) {
  if (!input || !Array.isArray(input) || input.length === 0) {
    throw new AppError('MISSING_URLS', 'urls must be a non-empty array of URL strings', 400);
  }

  if (input.length > 20) {
    const splits = Math.ceil(input.length / 20);
    throw new AppError(
      'TOO_MANY_URLS',
      `You provided ${input.length} URLs but the maximum per call is 20. Split into ${splits} calls of up to 20 URLs each.`,
      400
    );
  }

  return input.map((url, i) => {
    try {
      return validateUrl(url);
    } catch (err) {
      // Re-throw with index context so the agent knows which URL failed
      throw new AppError(err.code, `urls[${i}]: ${err.message}`, err.status);
    }
  });
}

const APIFY_ID_REGEX = /^[a-zA-Z0-9~_-]+$/;

function validateApifyId(input, fieldName) {
  if (!input || typeof input !== 'string') {
    throw new AppError(`MISSING_${fieldName.toUpperCase()}`, `${fieldName} is required`, 400);
  }

  const trimmed = input.trim();

  if (trimmed.length > 100) {
    throw new AppError(`INVALID_${fieldName.toUpperCase()}`, `${fieldName} is too long (${trimmed.length} chars, max 100)`, 400);
  }

  if (!APIFY_ID_REGEX.test(trimmed)) {
    throw new AppError(
      `INVALID_${fieldName.toUpperCase()}`,
      `${fieldName} "${trimmed.slice(0, 30)}" contains invalid characters. Only letters, numbers, hyphens, underscores, and tildes are allowed.`,
      400
    );
  }

  return trimmed;
}

module.exports = { validateUrl, validateUrls, validateApifyId, URL_REGEX };
