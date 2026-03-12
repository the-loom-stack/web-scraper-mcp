import { describe, it, expect } from 'vitest';

const { validateUrl, validateUrls, validateApifyId } = require('../../src/utils/validators');

describe('validateUrl', () => {
  it('accepts valid http URL', () => {
    expect(validateUrl('http://example.com')).toBe('http://example.com');
  });

  it('accepts valid https URL', () => {
    expect(validateUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('trims whitespace', () => {
    expect(validateUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('rejects null/undefined', () => {
    expect(() => validateUrl(null)).toThrow('url is required');
    expect(() => validateUrl(undefined)).toThrow('url is required');
  });

  it('rejects empty string', () => {
    expect(() => validateUrl('')).toThrow('url');
    expect(() => validateUrl('   ')).toThrow('url');
  });

  it('rejects non-string', () => {
    expect(() => validateUrl(123)).toThrow('url is required');
    expect(() => validateUrl({})).toThrow('url is required');
  });

  it('rejects URLs without protocol', () => {
    expect(() => validateUrl('example.com')).toThrow('URL must start with');
    expect(() => validateUrl('www.example.com')).toThrow('URL must start with');
  });

  it('rejects ftp URLs', () => {
    expect(() => validateUrl('ftp://example.com')).toThrow('URL must start with');
  });

  it('rejects URLs over 2048 characters', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2040);
    expect(() => validateUrl(longUrl)).toThrow('too long');
  });

  it('rejects localhost (SSRF protection)', () => {
    expect(() => validateUrl('http://localhost/admin')).toThrow('private');
    expect(() => validateUrl('http://localhost:6666')).toThrow('private');
  });

  it('rejects loopback IPs (SSRF protection)', () => {
    expect(() => validateUrl('http://127.0.0.1')).toThrow('private');
    expect(() => validateUrl('http://127.0.0.1:8080/secret')).toThrow('private');
  });

  it('rejects RFC 1918 private IPs (SSRF protection)', () => {
    expect(() => validateUrl('http://10.0.0.1')).toThrow('private');
    expect(() => validateUrl('http://192.168.1.1')).toThrow('private');
    expect(() => validateUrl('http://172.16.0.1')).toThrow('private');
    expect(() => validateUrl('http://172.31.255.255')).toThrow('private');
  });

  it('rejects AWS metadata endpoint (SSRF protection)', () => {
    expect(() => validateUrl('http://169.254.169.254/latest/meta-data/')).toThrow('private');
  });

  it('rejects malformed URLs that pass the regex but fail URL parsing', () => {
    expect(() => validateUrl('http://')).toThrow();
    expect(() => validateUrl('https://')).toThrow();
  });

  it('returns correct AppError code', () => {
    try {
      validateUrl('');
    } catch (e) {
      expect(e.code).toBe('MISSING_URL');
      expect(e.status).toBe(400);
    }

    try {
      validateUrl('not-a-url');
    } catch (e) {
      expect(e.code).toBe('INVALID_URL');
      expect(e.status).toBe(400);
    }
  });
});

describe('validateUrls', () => {
  it('accepts array of valid URLs', () => {
    const result = validateUrls(['https://a.com', 'https://b.com']);
    expect(result).toEqual(['https://a.com', 'https://b.com']);
  });

  it('trims each URL', () => {
    const result = validateUrls(['  https://a.com  ']);
    expect(result).toEqual(['https://a.com']);
  });

  it('rejects null/undefined', () => {
    expect(() => validateUrls(null)).toThrow('urls must be');
    expect(() => validateUrls(undefined)).toThrow('urls must be');
  });

  it('rejects non-array', () => {
    expect(() => validateUrls('https://a.com')).toThrow('urls must be');
    expect(() => validateUrls({})).toThrow('urls must be');
  });

  it('rejects empty array', () => {
    expect(() => validateUrls([])).toThrow('urls must be');
  });

  it('rejects more than 20 URLs with split guidance', () => {
    const urls = Array.from({ length: 21 }, (_, i) => `https://example${i}.com`);
    expect(() => validateUrls(urls)).toThrow('21 URLs');
    expect(() => validateUrls(urls)).toThrow('maximum');
  });

  it('validates each individual URL', () => {
    expect(() => validateUrls(['https://ok.com', 'not-a-url']))
      .toThrow('URL must start with');
  });

  it('accepts exactly 20 URLs', () => {
    const urls = Array.from({ length: 20 }, (_, i) => `https://example${i}.com`);
    expect(validateUrls(urls)).toHaveLength(20);
  });
});

describe('validateApifyId', () => {
  it('accepts alphanumeric IDs', () => {
    expect(validateApifyId('abc123XYZ', 'runId')).toBe('abc123XYZ');
  });

  it('accepts IDs with tildes, hyphens, underscores', () => {
    expect(validateApifyId('apify~my-actor_v2', 'actorId')).toBe('apify~my-actor_v2');
  });

  it('trims whitespace', () => {
    expect(validateApifyId('  abc123  ', 'runId')).toBe('abc123');
  });

  it('rejects empty/null', () => {
    expect(() => validateApifyId('', 'runId')).toThrow('runId is required');
    expect(() => validateApifyId(null, 'runId')).toThrow('runId is required');
  });

  it('rejects path traversal attempts', () => {
    expect(() => validateApifyId('../etc/passwd', 'runId')).toThrow('invalid characters');
    expect(() => validateApifyId('../../secret', 'datasetId')).toThrow('invalid characters');
  });

  it('rejects slashes', () => {
    expect(() => validateApifyId('a/b', 'runId')).toThrow('invalid characters');
  });

  it('rejects IDs over 100 characters', () => {
    expect(() => validateApifyId('a'.repeat(101), 'runId')).toThrow('too long');
  });

  it('uses fieldName in error code', () => {
    try {
      validateApifyId('', 'datasetId');
    } catch (e) {
      expect(e.code).toBe('MISSING_DATASETID');
    }

    try {
      validateApifyId('../bad', 'runId');
    } catch (e) {
      expect(e.code).toBe('INVALID_RUNID');
    }
  });
});
