import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

/**
 * Open Android's screen-cast / wireless-display settings so the user can mirror
 * the app onto a TV. Returns false if not available.
 */
export async function openCastSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const actions = ['android.settings.CAST_SETTINGS', 'android.settings.WIFI_DISPLAY_SETTINGS'];
  for (const action of actions) {
    try {
      await IntentLauncher.startActivityAsync(action);
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

/**
 * Opens the TV/box DISPLAY settings. Not a nicety: when the panel runs at 60 Hz
 * and a channel is 25 or 50 fps, the box has to repeat a frame every so often —
 * you see one frame held, again and again, and the picture reads as juddery even
 * though nothing is buffering. The cure is the device's "match content frame
 * rate" switch, which no app is allowed to flip on the user's behalf.
 */
export async function openDisplaySettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const actions = ['android.settings.DISPLAY_SETTINGS', 'android.settings.SETTINGS'];
  for (const action of actions) {
    try {
      await IntentLauncher.startActivityAsync(action);
      return true;
    } catch {
      // try the next one
    }
  }
  return false;
}
