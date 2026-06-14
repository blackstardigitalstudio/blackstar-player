/** Logical remote keys used across the app. */
export type RemoteKey =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'back'
  | 'playpause'
  | 'fastforward'
  | 'rewind'
  | 'next'
  | 'prev'
  | 'channelup'
  | 'channeldown'
  | 'info'
  | `digit:${number}`;

/** Map Android key codes (delivered by the native onKeyDown bridge) to logical keys. */
export function androidKeyToRemote(keyCode: number): RemoteKey | null {
  switch (keyCode) {
    case 19:
      return 'up';
    case 20:
      return 'down';
    case 21:
      return 'left';
    case 22:
      return 'right';
    case 23: // DPAD_CENTER
    case 66: // ENTER
    case 160: // NUMPAD_ENTER
      return 'select';
    case 4: // BACK
      return 'back';
    case 85: // MEDIA_PLAY_PAUSE
    case 126:
    case 127:
      return 'playpause';
    case 90:
      return 'fastforward';
    case 89:
      return 'rewind';
    case 87:
      return 'next';
    case 88:
      return 'prev';
    case 166:
      return 'channelup';
    case 167:
      return 'channeldown';
    case 165:
      return 'info';
    default:
      if (keyCode >= 7 && keyCode <= 16) return `digit:${keyCode - 7}`; // 0..9
      if (keyCode >= 144 && keyCode <= 153) return `digit:${keyCode - 144}`; // numpad 0..9
      return null;
  }
}

/** Map browser KeyboardEvent.key to logical keys (used on web / dev with a keyboard). */
export function webKeyToRemote(key: string): RemoteKey | null {
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'Enter':
    case ' ':
      return 'select';
    case 'Backspace':
    case 'Escape':
      return 'back';
    case 'MediaPlayPause':
      return 'playpause';
    default:
      if (/^[0-9]$/.test(key)) return `digit:${Number(key)}`;
      return null;
  }
}
