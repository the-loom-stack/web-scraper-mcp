'use strict';

class AppError extends Error {
  constructor(code, message, status, extras = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.extras = extras;
    this.isOperational = true;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      ...this.extras
    };
  }
}

module.exports = AppError;
