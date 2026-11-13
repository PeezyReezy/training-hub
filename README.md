# Training Hub — phone-first Netlify deployment

## Deploy from your phone

1. Unzip `training-hub-netlify.zip` in iPhone Files. The folder contains `index.html`, `strength.html`, `netlify.toml`, and `netlify/functions/`.
2. The easiest reliable deployment for serverless functions is to upload the **whole folder to a GitHub repository** (GitHub web interface or an iOS Git client), then in Netlify choose **Add new project → Import an existing project → GitHub**. Build command: leave blank. Publish directory: `.`. Netlify reads `netlify.toml` and deploys the functions.
3. A drag-and-drop static deploy may publish the HTML without building Netlify Functions. Use the Git-connected workflow for Strava.
4. Open the Netlify URL on your phone. Use Safari Share → Add to Home Screen for app-like access.

## Connect Strava

1. Go to https://www.strava.com/settings/api and create an API application. Set **Authorization Callback Domain** to your Netlify hostname only (e.g. `my-training-hub.netlify.app`, without `https://` or a path). Strava may require a website URL and application details.
2. In Netlify project settings, add environment variables `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` using the values from Strava. Make them available to Functions. Trigger a redeploy after saving.
3. In the deployed app, tap **Connect Strava**, authorize, and then **Sync runs**. This imports all activities from the last 30 days per sync, retaining only runs. It does not continuously sync in the background.
4. The Strava app may initially have athlete authorization restrictions until Strava reviews it. For a personal app, connecting the app owner's account is the intended use.

If syncing fails, the app distinguishes expired authorization, missing Netlify Functions, rate limits, and temporary service errors. A missing-functions message means the site needs a Git-connected Netlify deployment with Functions enabled. Disconnecting and reconnecting Strava retains previously imported runs. HTML or empty server responses are reported as service errors rather than browser JSON parsing errors.

Run the Strava client regression checks with Node.js: `node --test test/strava-api.test.cjs`. These use mocked responses and do not require Strava credentials.

## Data migration and backup

To log strength from the dashboard, choose **Strength**, select **Strength A — Tuesday** or **Strength B — Sunday**, choose the session date, and tap **Start workout**. The tracker opens that workout and date, including an existing session if one is already saved. New sessions prefill each exercise's weights and reps from its latest earlier entry on the same workout day. Completed sets and notes are not copied. Adjust the values and mark your sets complete; existing sessions keep their saved values, including blanks.

Browser regression checks require Playwright and Chromium: `node --test test/strength-flow.browser.cjs`. For a system Chromium installation, set `CHROMIUM_PATH` to its executable path. The tests start their own local static server and use isolated browser storage.

The attached strength tracker was copied into `strength.html` and uses its existing localStorage key `strength-training-tracker-v2`. If you have previously logged workouts at a different URL, use **Backup JSON** in the old tracker, then **Import JSON** in the new strength tracker. Browser local storage does not transfer automatically across sites. The dashboard reads strength sessions logged at the new site's `strength.html`.

The dashboard has a separate **Backup hub JSON** button for manually logged and Strava-imported sessions. Keep both backup files. This version is local-device storage only; it does not synchronize workout logs between phones or browsers.

## Strength insights

Open **Insights** from the tabs on the dashboard or strength tracker. Choose an exercise from Strength A or Strength B; the two workouts keep separate histories, including exercises shared by both. The chart defaults to the full logged history and supports inclusive From/To date filters.

Exercises with numeric weights default to the heaviest completed set per session. Exercises without numeric weights default to average reps per completed set. Use **Measure** to switch between weight and reps, including for mixed histories. Unchecked sets (including prefilled suggestions) never affect the trend. Bands and BW remain visible in session history. Numeric weights without units are treated as lb, and explicit kg entries are converted to lb. Reps such as `8 / side` count as 8 per side; timed entries and ranges are kept in history without being interpreted as rep counts. Averages exclude sets without a numeric rep count.

Select a chart point for its date and value, or a history date to reopen that workout. Insights reads the existing local strength log without modifying it. The exercise catalog is shared with the tracker.

Regression checks: `node --test test/insights-data.test.cjs test/strava-api.test.cjs`; browser checks: `CHROMIUM_PATH=/usr/bin/chromium node --test test/strength-flow.browser.cjs` (requires Playwright and Chromium).

## Security and limitations

- Strava client secret is stored only as a Netlify environment variable. Do not put it into HTML, GitHub, or the README.
- Access/refresh tokens are stored in the browser's localStorage, which is convenient for a private single-user tool but less secure than server-side sessions. Do not use this design as a public multi-user app.
- OAuth state is checked on return; tokens are refreshed through Netlify Functions. Use HTTPS (Netlify provides it).
- The sync endpoint fetches all pages of activities from the last 30 days, not a complete historical archive. No webhooks or background sync.
- Insights covers the exercises in the two strength workouts. Friday remains a session note rather than structured sets.
- Strava API usage is subject to Strava rate limits and developer policies.
