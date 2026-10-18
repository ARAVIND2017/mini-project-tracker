/**
 * One error type for the UI. Database RPCs raise "CODE: message" (API_SPEC.md §1);
 * the Edge Function returns { code, message }. Internal details are never shown.
 */
export type AppErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'INVALID_STATE'
  | 'GATE_NOT_MET'
  | 'DUPLICATE_PAPER'
  | 'CAPACITY_EXCEEDED'
  | 'ALREADY_EXISTS'
  | 'AUTH'
  | 'NETWORK'
  | 'UNKNOWN';

const KNOWN_CODES = new Set<string>([
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'INVALID_STATE',
  'GATE_NOT_MET',
  'DUPLICATE_PAPER',
  'CAPACITY_EXCEEDED',
  'ALREADY_EXISTS',
]);

const FALLBACK: Record<AppErrorCode, string> = {
  FORBIDDEN: 'You do not have permission to do this.',
  NOT_FOUND: 'Not found, or you do not have access to it.',
  VALIDATION: 'Some of the information is not valid.',
  INVALID_STATE: 'This action is not possible at the current stage.',
  GATE_NOT_MET: 'An earlier step must be completed first.',
  DUPLICATE_PAPER: 'Another project already has this paper approved.',
  CAPACITY_EXCEEDED: 'The semester is full.',
  ALREADY_EXISTS: 'This already exists.',
  AUTH: 'Your session has ended. Please sign in again.',
  NETWORK: 'Could not reach the server. Check your connection and try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message?: string) {
    super(message || FALLBACK[code]);
    this.name = 'AppError';
    this.code = code;
  }
}

function fromMessage(message: string): AppError | null {
  const match = /^([A-Z_]+): ([\s\S]+)$/.exec(message);
  if (match && match[1] && KNOWN_CODES.has(match[1])) {
    return new AppError(match[1] as AppErrorCode, match[2]);
  }
  return null;
}

/** Converts anything thrown by supabase-js, fetch or our code into an AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof TypeError && /fetch|network/i.test(err.message))
    return new AppError('NETWORK');
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown; status?: unknown; name?: unknown };
    if (typeof e.code === 'string' && KNOWN_CODES.has(e.code)) {
      return new AppError(
        e.code as AppErrorCode,
        typeof e.message === 'string' ? e.message : undefined,
      );
    }
    if (typeof e.message === 'string') {
      const parsed = fromMessage(e.message);
      if (parsed) return parsed;
      // PostgREST: missing privilege or RLS refusal.
      if (e.code === '42501' || /permission denied/i.test(e.message))
        return new AppError('FORBIDDEN');
      if (e.code === 'PGRST301' || e.status === 401) return new AppError('AUTH');
      if (/Failed to fetch|NetworkError/i.test(e.message)) return new AppError('NETWORK');
    }
  }
  if (import.meta.env.DEV) console.error(err);
  return new AppError('UNKNOWN');
}
