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
