import { expect } from '@playwright/test';

import { sentryTest } from '../../../utils/fixtures';
import { getExpectedReplayEvent } from '../../../utils/replayEventTemplates';
import { getReplayEvent, shouldSkipReplayTest, waitForReplayRequest } from '../../../utils/replayHelpers';

const MAX_REPLAY_DURATION = 2000;

sentryTest('keeps track of max duration across reloads', async ({ getLocalTestPath, page }) => {
  if (shouldSkipReplayTest()) {
    sentryTest.skip();
  }

  await page.route('https://dsn.ingest.sentry.io/**/*', route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'test-id' }),
    });
  });

  const reqPromise0 = waitForReplayRequest(page, 0);
  const reqPromise1 = waitForReplayRequest(page, 1);

  const url = await getLocalTestPath({ testDir: __dirname });

  await page.goto(url);

  await new Promise(resolve => setTimeout(resolve, MAX_REPLAY_DURATION / 2));

  await Promise.all([page.reload(), page.click('#button1')]);

  // After the second reload, we should have a new session (because we exceeded max age)
  const reqPromise3 = waitForReplayRequest(page, 0);

  await new Promise(resolve => setTimeout(resolve, MAX_REPLAY_DURATION / 2 + 100));

  const [, , req0, req1] = await Promise.all([
    page.click('#button1'),
    page.evaluate(
      `Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: function () {
      return 'hidden';
    },
  });

  document.dispatchEvent(new Event('visibilitychange'));`,
    ),
    reqPromise0,
    reqPromise1,
  ]);

  const replayEvent0 = getReplayEvent(req0);
  expect(replayEvent0).toEqual(getExpectedReplayEvent({}));

  const replayEvent1 = getReplayEvent(req1);
  expect(replayEvent1).toEqual(
    getExpectedReplayEvent({
      segment_id: 1,
    }),
  );

  const replayEvent3 = getReplayEvent(await reqPromise3);
  expect(replayEvent3).toEqual(getExpectedReplayEvent({}));
});
