import { describe, it, expect } from 'vitest';

const AppError = require('../../src/errors/AppError');

describe('AppError', () => {
  it('creates error with all fields', () => {
    const err = new AppError('TEST_CODE', 'test message', 400, { detail: 'extra' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe('AppError');
    expect(err.code).toBe('TEST_CODE');
    expect(err.message).toBe('test message');
    expect(err.status).toBe(400);
    expect(err.extras).toEqual({ detail: 'extra' });
    expect(err.isOperational).toBe(true);
  });

  it('defaults extras to empty object', () => {
    const err = new AppError('CODE', 'msg', 500);
    expect(err.extras).toEqual({});
  });

  it('toJSON includes all fields plus extras', () => {
    const err = new AppError('NOT_FOUND', 'thing not found', 404, { id: '123' });
    const json = err.toJSON();
    expect(json).toEqual({
      code: 'NOT_FOUND',
      message: 'thing not found',
      status: 404,
      id: '123'
    });
  });

  it('has a stack trace', () => {
    const err = new AppError('CODE', 'msg', 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AppError');
  });
});
