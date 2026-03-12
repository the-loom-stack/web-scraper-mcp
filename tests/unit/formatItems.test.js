import { describe, it, expect } from 'vitest';

const { formatItems } = require('../../src/utils/formatItems');

const sampleItem = {
  url: 'https://example.com',
  metadata: { title: 'Test Page' },
  markdown: '# Hello\n\nWorld',
  text: 'Hello. World.',
  html: '<h1>Hello</h1><p>World</p>'
};

describe('formatItems', () => {
  describe('output format selection', () => {
    it('returns markdown content by default', () => {
      const result = formatItems([sampleItem]);
      expect(result[0].content).toBe('# Hello\n\nWorld');
    });

    it('returns markdown when explicitly requested', () => {
      const result = formatItems([sampleItem], 'markdown');
      expect(result[0].content).toBe('# Hello\n\nWorld');
    });

    it('returns html when requested', () => {
      const result = formatItems([sampleItem], 'html');
      expect(result[0].content).toBe('<h1>Hello</h1><p>World</p>');
    });

    it('returns text when requested', () => {
      const result = formatItems([sampleItem], 'text');
      expect(result[0].content).toBe('Hello. World.');
    });

    it('falls back to text when markdown missing and format is markdown', () => {
      const item = { ...sampleItem, markdown: undefined };
      const result = formatItems([item], 'markdown');
      expect(result[0].content).toBe('Hello. World.');
    });

    it('falls back to markdown when text missing and format is text', () => {
      const item = { ...sampleItem, text: undefined };
      const result = formatItems([item], 'text');
      expect(result[0].content).toBe('# Hello\n\nWorld');
    });

    it('returns empty string when no content fields exist', () => {
      const item = { url: 'https://empty.com' };
      const result = formatItems([item], 'markdown');
      expect(result[0].content).toBe('');
    });
  });

  describe('metadata extraction', () => {
    it('extracts url and title from metadata', () => {
      const result = formatItems([sampleItem]);
      expect(result[0].url).toBe('https://example.com');
      expect(result[0].title).toBe('Test Page');
    });

    it('falls back to item.title when metadata.title missing', () => {
      const item = { ...sampleItem, metadata: {}, title: 'Fallback Title' };
      const result = formatItems([item]);
      expect(result[0].title).toBe('Fallback Title');
    });

    it('returns empty string for missing url and title', () => {
      const item = { markdown: '# Test' };
      const result = formatItems([item]);
      expect(result[0].url).toBe('');
      expect(result[0].title).toBe('');
    });
  });

  describe('truncation', () => {
    it('does not truncate content under limit', () => {
      const result = formatItems([sampleItem]);
      expect(result[0].truncated).toBeUndefined();
      expect(result[0].originalLength).toBeUndefined();
    });

    it('truncates content over 50000 characters', () => {
      const longContent = 'x'.repeat(60000);
      const item = { url: 'https://big.com', markdown: longContent };
      const result = formatItems([item], 'markdown');

      expect(result[0].content).toHaveLength(50000);
      expect(result[0].truncated).toBe(true);
      expect(result[0].originalLength).toBe(60000);
    });

    it('truncates at exactly maxContentLength', () => {
      const exactContent = 'a'.repeat(50000);
      const item = { url: 'https://exact.com', markdown: exactContent };
      const result = formatItems([item], 'markdown');

      expect(result[0].content).toHaveLength(50000);
      expect(result[0].truncated).toBeUndefined();
    });
  });

  describe('multiple items', () => {
    it('processes all items in array', () => {
      const items = [
        { url: 'https://a.com', markdown: '# A' },
        { url: 'https://b.com', markdown: '# B' },
        { url: 'https://c.com', markdown: '# C' },
      ];
      const result = formatItems(items);
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.content)).toEqual(['# A', '# B', '# C']);
    });

    it('handles empty array', () => {
      expect(formatItems([])).toEqual([]);
    });
  });
});
