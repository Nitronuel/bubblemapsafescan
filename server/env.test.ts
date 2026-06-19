import { afterEach, describe, expect, it } from 'vitest';
import { readEnv } from './env';

describe('server env helpers', () => {
  const key = 'SAFE_SCAN_TEST_ENV';

  afterEach(() => {
    delete process.env[key];
  });

  it('trims whitespace and wrapping quotes from environment variables', () => {
    process.env[key] = ' "secret-value" ';

    expect(readEnv(key)).toBe('secret-value');
  });
});
