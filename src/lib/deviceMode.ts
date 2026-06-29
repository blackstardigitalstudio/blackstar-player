import { File, Paths } from 'expo-file-system';

export type DeviceMode = 'auto' | 'tv' | 'phone';

// Stored as a tiny file so it can be read SYNCHRONOUSLY at startup (the theme
// scale is fixed at module load, so it must be available before React renders).
const FILE = 'bs-devicemode';

function file() {
  return new File(Paths.document, FILE);
}

/** Reads the saved choice synchronously. 'auto' means "not chosen yet". */
export function readDeviceMode(): DeviceMode {
  try {
    const f = file();
    if (f.exists) {
      const v = f.textSync().trim();
      if (v === 'tv' || v === 'phone') return v;
    }
  } catch {}
  return 'auto';
}

export function writeDeviceMode(mode: DeviceMode) {
  try {
    const f = file();
    if (f.exists) f.delete();
    if (mode !== 'auto') {
      f.create();
      f.write(mode);
    }
  } catch {}
}
