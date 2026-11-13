import test from 'node:test';
import assert from 'node:assert/strict';
import { isFixtureMode, createFixtureProfile } from '../src/lib/fixtures.ts';

test('isFixtureMode returns false in production', () => {
  assert.strictEqual(isFixtureMode({ NODE_ENV: 'production', VIBRA_FIXTURES: '1' }), false);
  assert.strictEqual(isFixtureMode({ NODE_ENV: 'production', VIBRA_FIXTURES: undefined }), false);
});

test('isFixtureMode returns false when flag missing in development', () => {
  assert.strictEqual(isFixtureMode({ NODE_ENV: 'development', VIBRA_FIXTURES: undefined }), false);
  assert.strictEqual(isFixtureMode({ NODE_ENV: 'development', VIBRA_FIXTURES: '0' }), false);
});

test('isFixtureMode returns true only in development with explicit flag', () => {
  assert.strictEqual(isFixtureMode({ NODE_ENV: 'development', VIBRA_FIXTURES: '1' }), true);
});

test('createFixtureProfile returns valid ProfileResponse shape', () => {
  const profile = createFixtureProfile();
  assert.ok(typeof profile.user.id === 'number');
  assert.ok(typeof profile.user.username === 'string');
  assert.ok(Array.isArray(profile.posts));
  assert.ok(profile.stats.verified === 0 || profile.stats.verified === 1);
});