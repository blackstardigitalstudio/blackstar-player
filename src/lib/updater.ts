import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { APP_VERSION, UPDATE_REPO } from './version';

// Auto-update straight from the user's own GitHub Releases — no external server,
// no store, no account. The CI publishes `blackstar-player.apk` + `version.json`
// to the "latest" release; these stable URLs always point at the newest build.
// Pinned to the fixed `latest` TAG (not the "latest release" pointer), so a
// future semver-tagged release can never redirect these to the wrong asset.
const VERSION_URL = `https://github.com/${UPDATE_REPO}/releases/download/latest/version.json`;
const APK_URL = `https://github.com/${UPDATE_REPO}/releases/download/latest/blackstar-player.apk`;

export interface UpdateInfo {
  version: string;
  notes?: string;
  apkUrl: string;
}

// Lets Settings ask the mounted UpdateGate to run a manual check + show its UI.
let manualTrigger: (() => void) | null = null;
export function setUpdateTrigger(fn: (() => void) | null) {
  manualTrigger = fn;
}
export function requestUpdateCheck() {
  manualTrigger?.();
}

/** Compare dotted versions: >0 if a>b, <0 if a<b, 0 if equal. */
export function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Returns update info when a newer version is available, or null when already
 * up to date. THROWS on a failed check (offline, GitHub down, bad manifest) so
 * the caller can tell "no update" apart from "couldn't check".
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (Platform.OS !== 'android') return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`version check HTTP ${res.status}`);
  const j: any = await res.json();
  const version = String(j?.version || '').trim().replace(/^v/i, '');
  if (!version) throw new Error('manifest has no version');
  if (cmpVersion(version, APP_VERSION) <= 0) return null; // already up to date
  // Always install from the fixed same-repo APK URL — never a URL supplied by
  // the manifest — so a tampered version.json can't redirect the install.
  return { version, notes: typeof j?.notes === 'string' ? j.notes : undefined, apkUrl: APK_URL };
}

/**
 * Downloads the new APK to the cache and launches the system installer.
 * Android shows its standard "install / update this app?" screen (the app must
 * hold REQUEST_INSTALL_PACKAGES; the user grants "install unknown apps" once).
 */
export async function downloadAndInstall(
  info: UpdateInfo,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  const target = `${FileSystem.cacheDirectory}blackstar-update.apk`;
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch {}

  const dl = FileSystem.createDownloadResumable(info.apkUrl, target, {}, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite > 0) {
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    }
  });
  const result = await dl.downloadAsync();
  // downloadAsync resolves even on a 404 body — verify the HTTP status and that
  // we actually got a non-trivial file before handing it to the installer.
  if (!result?.uri || result.status !== 200) throw new Error('download failed');
  const stat = await FileSystem.getInfoAsync(result.uri);
  if (!stat.exists || ((stat as any).size ?? 0) < 1_000_000) throw new Error('apk too small');

  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
