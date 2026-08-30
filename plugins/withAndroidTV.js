/**
 * Config plugin: make the app a first-class Android TV / Fire TV / box citizen.
 *  - declares leanback + non-touch hardware as optional (so it installs on boxes
 *    AND on Amazon Fire TV, which refuses any app that requires a touchscreen)
 *  - adds the LEANBACK_LAUNCHER category so it shows on the TV home row
 *  - installs a real 16:9 TV banner (leanback launchers — Google TV and Fire TV's
 *    "Your apps" row — draw a banner, not the square icon: feeding them
 *    ic_launcher gets it stretched or cropped)
 * Made in Italy.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');

const BANNER_SRC = path.join(__dirname, '..', 'assets', 'images', 'tv-banner.png');
// 320x180 is the xhdpi reference size for a leanback banner; a single xhdpi
// density is what the Android TV / Fire TV guidelines ask for.
const BANNER_RES_DIR = ['app', 'src', 'main', 'res', 'drawable-xhdpi'];
const BANNER_NAME = 'tv_banner.png';
const BANNER_REF = '@drawable/tv_banner';

function withTvBannerAsset(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, ...BANNER_RES_DIR);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(BANNER_SRC, path.join(dir, BANNER_NAME));
      return cfg;
    },
  ]);
}

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
  config = withTvBannerAsset(config);
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    ensureUsesFeature(manifest, 'android.software.leanback', false);
    ensureUsesFeature(manifest, 'android.hardware.touchscreen', false);
    // A library pulls in ACCESS_WIFI_STATE, and Android turns that into an
    // IMPLIED, REQUIRED `android.hardware.wifi` feature (confirmed with `aapt2
    // dump badging` on the 1.0.39 APK). That silently locks the app out of every
    // ethernet-only TV box. Declare it explicitly as optional — the app streams
    // over whatever network the box has.
    ensureUsesFeature(manifest, 'android.hardware.wifi', false);

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:banner'] = BANNER_REF;

    // Add LEANBACK_LAUNCHER alongside the standard launcher category.
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    // Fire TV reads the banner off the launcher ACTIVITY; Google TV off the
    // application. Declare it on both so neither falls back to the square icon.
    activity.$['android:banner'] = BANNER_REF;
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
