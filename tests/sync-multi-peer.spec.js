import { test } from '@playwright/test';

test.describe.skip('multi-peer sync (requires external peer server)', () => {
  test('skipped in isolated/CI environments', async () => {});
});
