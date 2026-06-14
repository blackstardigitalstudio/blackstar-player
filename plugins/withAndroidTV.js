/**
 * Config plugin: make the app a first-class Android TV / box citizen.
 *  - declares leanback + non-touch hardware as optional (so it installs on boxes)
 *  - adds the LEANBACK_LAUNCHER category so it shows on the TV home row
 *  - sets an app banner (reuses the launcher icon)
 * Made in Italy.
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

function ensureUsesFeature(manifest, name, required) {
  manifest['uses-feature'] = manifest['uses-feature'] || [];
  const exists = manifest['uses-feature'].some((f) => f.$ && f.$['android:name'] === name);
  if (!exists) {
    manifest['uses-feature'].push({
      $: { 'android:name': name, 'android:required': String(required) },
    });
  }
}

module.exports = function withAndroidTV(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    ensureUsesFeature(manifest, 'android.software.leanback', false);
    ensureUsesFeature(manifest, 'android.hardware.touchscreen', false);

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:banner'] = '@mipmap/ic_launcher';

    // Add LEANBACK_LAUNCHER alongside the standard launcher category.
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity['intent-filter'] = activity['intent-filter'] || [];
    for (const filter of activity['intent-filter']) {
      const hasMain = (filter.action || []).some((a) => a.$['android:name'] === 'android.intent.action.MAIN');
      if (!hasMain) continue;
      filter.category = filter.category || [];
      const hasLeanback = filter.category.some(
        (c) => c.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER',
      );
      if (!hasLeanback) {
        filter.category.push({ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } });
      }
    }

    return cfg;
  });
};
