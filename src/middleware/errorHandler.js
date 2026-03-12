'use strict';

const AppError = require('../errors/AppError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: err.toJSON(),
      meta: { requestId: req.requestId }
    });
  }

  // Express JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains invalid JSON',
        status: 400
      },
      meta: { requestId: req.requestId }
    });
  }

  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      status: 500
    },
    meta: { requestId: req.requestId }
  });
}

module.exports = errorHandler;
