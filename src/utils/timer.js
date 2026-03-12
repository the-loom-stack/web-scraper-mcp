'use strict';

function startTimer() {
  const start = Date.now();
  return {
    elapsed() {
      return Date.now() - start;
    }
  };
}

module.exports = { startTimer };
