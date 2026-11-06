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

## Data migration and backup

The attached strength tracker was copied into `strength.html` and uses its existing localStorage key `strength-training-tracker-v2`. If you have previously logged workouts at a different URL, use **Backup JSON** in the old tracker, then **Import JSON** in the new strength tracker. Browser local storage does not transfer automatically across sites. The dashboard reads strength sessions logged at the new site's `strength.html`.

The dashboard has a separate **Backup hub JSON** button for manually logged and Strava-imported sessions. Keep both backup files. This version is local-device storage only; it does not synchronize workout logs between phones or browsers.

## Security and limitations

- Strava client secret is stored only as a Netlify environment variable. Do not put it into HTML, GitHub, or the README.
- Access/refresh tokens are stored in the browser's localStorage, which is convenient for a private single-user tool but less secure than server-side sessions. Do not use this design as a public multi-user app.
- OAuth state is checked on return; tokens are refreshed through Netlify Functions. Use HTTPS (Netlify provides it).
- The sync endpoint fetches all pages of activities from the last 30 days, not a complete historical archive. No webhooks or background sync.
- The app doesn't currently graph exercise progression or record structured Friday sets; Friday is a session note. Those are logical next upgrades.
- Strava API usage is subject to Strava rate limits and developer policies.
