import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePublicOrigin } from '../src/lib/public-origin.ts';

function withEnvironment(
  environment: Record<string, string | undefined>,
  run: () => void,
): void {
  const previous = new Map<string, string | undefined>();

  for (const [name, value] of Object.entries(environment)) {
    previous.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  try {
    run();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('uses validated public origin when configured', () => {
  withEnvironment(
    { VIBRA_PUBLIC_ORIGIN: 'https://app.example.com', NODE_ENV: 'production' },
    () => {
      const origin = resolvePublicOrigin(
        new Headers({ host: 'attacker.example', 'x-forwarded-host': 'attacker.example' }),
      );

      assert.strictEqual(origin, 'https://app.example.com');
    },
  );
});

test('rejects invalid configured public origins', () => {
  for (const configured of [
    'javascript:alert(1)',
    'https://user:pass@example.com',
    'https://example.com/path',
    'not-a-url',
  ]) {
    withEnvironment(
      { VIBRA_PUBLIC_ORIGIN: configured, NODE_ENV: 'production' },
      () => {
        assert.strictEqual(
          resolvePublicOrigin(new Headers({ host: 'example.com' })),
          null,
        );
      },
    );
  }
});

test('does not trust request hosts in production', () => {
  withEnvironment(
    { VIBRA_PUBLIC_ORIGIN: undefined, NODE_ENV: 'production' },
    () => {
      assert.strictEqual(
        resolvePublicOrigin(
          new Headers({
            host: 'attacker.example',
            'x-forwarded-host': 'attacker.example',
          }),
        ),
        null,
      );
    },
  );
});

test('accepts loopback request hosts only in development', () => {
  withEnvironment(
    { VIBRA_PUBLIC_ORIGIN: undefined, NODE_ENV: 'development' },
    () => {
      assert.strictEqual(
        resolvePublicOrigin(new Headers({ host: 'localhost:3000' })),
        'http://localhost:3000',
      );
      assert.strictEqual(
        resolvePublicOrigin(
          new Headers({ host: 'attacker.example', 'x-forwarded-host': 'attacker.example' }),
        ),
        null,
      );
    },
  );
});