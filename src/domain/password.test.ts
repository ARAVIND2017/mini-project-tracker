import { newPasswordSchema, passwordSchema } from './password';

describe('password rules', () => {
  it('requires length, letters and digits', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('onlyletterslong').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890').success).toBe(false);
    expect(passwordSchema.safeParse('research2026').success).toBe(true);
  });

  it('requires the confirmation to match', () => {
    expect(
      newPasswordSchema.safeParse({ password: 'research2026', confirm: 'research2027' }).success,
    ).toBe(false);
    expect(
      newPasswordSchema.safeParse({ password: 'research2026', confirm: 'research2026' }).success,
    ).toBe(true);
  });
});
