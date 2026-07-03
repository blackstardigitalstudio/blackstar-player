// App version baked into the JS bundle, compared by the in-app updater against
// the latest GitHub release's version.json.
//
// IMPORTANT: bump ONLY `expo.version` in app.json when releasing. The CI
// ("Sync APP_VERSION" step in build-apk.yml) rewrites this constant from
// app.json before bundling, so the two can never drift out of sync. This local
// value is just a dev-time default.
// Made in Italy.
export const APP_VERSION = '1.0.2';

// The user's own GitHub repo is the ONLY update source (no external servers).
export const UPDATE_REPO = 'blackstardigitalstudio/blackstar-player';
