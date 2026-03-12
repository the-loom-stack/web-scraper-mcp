'use strict';

const config = require('../config');

const maxLen = config.apify.maxContentLength;

/**
 * Normalize Apify dataset items into a clean, AI-friendly shape.
 * - Truncates content at maxLen to prevent context window overflow
 * - Marks empty pages so agents know no content was returned
 */
function formatItems(items, outputFormat) {
  return items.map((item) => {
    const result = {
      url: item.url || '',
      title: item.metadata?.title || item.title || '',
    };

    const format = outputFormat || 'markdown';
    let content;

    if (format === 'markdown') {
      content = item.markdown || item.text || '';
    } else if (format === 'html') {
      content = item.html || '';
    } else {
      content = item.text || item.markdown || '';
    }

    if (content.length > maxLen) {
      result.content = content.slice(0, maxLen);
      result.truncated = true;
      result.originalLength = content.length;
    } else {
      result.content = content;
      // Flag completely empty pages so agents don't silently process blank results
      if (!content) {
        result.isEmpty = true;
      }
    }

    return result;
  });
}

module.exports = { formatItems };
