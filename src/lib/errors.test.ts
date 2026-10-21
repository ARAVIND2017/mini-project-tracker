import { AppError, toAppError } from './errors';

describe('toAppError (SEC-13)', () => {
  it('parses database RPC errors of the form "CODE: message"', () => {
    const err = toAppError({
      message: 'GATE_NOT_MET: Appoint a lead faculty first',
      code: 'P0001',
    });
    expect(err.code).toBe('GATE_NOT_MET');
    expect(err.message).toBe('Appoint a lead faculty first');
  });

  it('reads Edge Function error bodies', () => {
    const err = toAppError({
      code: 'ALREADY_EXISTS',
      message: 'An account with this email already exists',
    });
    expect(err.code).toBe('ALREADY_EXISTS');
  });

  it('maps permission errors without leaking SQL', () => {
    const err = toAppError({ message: 'permission denied for table semesters', code: '42501' });
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).not.toContain('semesters');
  });

  it('maps network failures', () => {
    expect(toAppError(new TypeError('Failed to fetch')).code).toBe('NETWORK');
  });

  it('never exposes unknown internal messages', () => {
    const err = toAppError({ message: 'relation "x" does not exist at character 15' });
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).not.toContain('relation');
  });

  it('passes AppErrors through', () => {
    const original = new AppError('VALIDATION', 'Name is required');
    expect(toAppError(original)).toBe(original);
  });
});
