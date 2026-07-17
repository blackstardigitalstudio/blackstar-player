import React, { createContext, useContext, useEffect, useRef } from 'react';
import { DeviceEventEmitter, TVFocusGuideView, useTVEventHandler, View } from 'react-native';
import { androidKeyToRemote, type RemoteKey } from './keys';

// react-native-web ships neither TVFocusGuideView nor useTVEventHandler. Fall
// back to inert equivalents so screens and modals can be smoke-tested in a
// browser; on the box (react-native-tvos) the real implementations are used.
const Guide: any = TVFocusGuideView ?? View;
const useTVEvents: (h: (evt: any) => void) => void = useTVEventHandler ?? (() => {});

// TV-NATIVE build (react-native-tvos): there is NO custom focus engine — Android TV's
// native focus handles D-pad navigation and selection on its own. These are thin
// shims that keep the OLD engine API surface so every screen compiles unchanged.
// Only remote keys that are NOT tied to focus (play/pause, media, menu/back) are
// surfaced to screens, via react-native-tvos' global useTVEventHandler.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type KeyHandler = (key: RemoteKey) => boolean | void;

const noop = (..._a: any[]) => {};

const ctx = {
  register: noop,
  unregister: noop,
  requestFocus: noop,
  reportRect: noop,
  subscribe: () => noop,
  pushHandler: () => noop,
  dispatch: noop,
  setPointerMode: noop,
  activateLayer: noop,
  deactivateLayer: noop,
};

const Ctx = createContext(ctx);
export const FocusLayerContext = createContext<number>(0);

export function RemoteProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

export function useRemote() {
  return useContext(Ctx);
}

// Map react-native-tvos TV events → the app's logical RemoteKey. Deliberately does
// NOT map up/down/left/right/select: those drive focus/selection and are handled
// natively, so screens must not also react to them.
const TV_MAP: Record<string, RemoteKey> = {
  playPause: 'playpause',
  fastForward: 'fastforward',
  rewind: 'rewind',
  next: 'next',
  previous: 'prev',
  menu: 'back',
};

/** Screen-level handler for MEDIA/remote keys (play/pause, ff/rew, menu). */
export function useKeyHandler(handler: KeyHandler, _deps: React.DependencyList = []) {
  const ref = useRef(handler);
  ref.current = handler;
  useTVEvents((evt: any) => {
    const k = TV_MAP[evt?.eventType];
    if (k) ref.current(k);
  });
  // CH+/CH- are NOT delivered by the react-native-tvos TV event stream — they arrive
  // via the native onKeyDown bridge (plugins/withTVRemote emits 'BlackstarRemoteKey',
  // which only emits and calls super, so native focus is untouched). Forward ONLY the
  // channel keys: arrows/select/back stay native, and only the Player reacts to
  // channelup/channeldown (Home ignores them), so this can't disturb a screen mounted
  // underneath. Numeric-keypad zapping needs a per-screen focus gate — left for later.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('BlackstarRemoteKey', (e: { keyCode: number }) => {
      const k = androidKeyToRemote(e?.keyCode);
      if (k === 'channelup' || k === 'channeldown') ref.current(k);
    });
    return () => sub.remove();
  }, []);
}

export function useFocusLayer() {
  return 0;
}

/**
 * Modal focus trap. On TV the D-pad would otherwise wander OUT of a modal onto the
 * screen behind it. TVFocusGuideView with trapFocus in every direction keeps focus
 * inside; autoFocus lands on (and remembers) a focusable child.
 */
export function FocusLayer({ children }: { children: React.ReactNode }) {
  return (
    <Guide autoFocus trapFocusLeft trapFocusRight trapFocusUp trapFocusDown>
      {children}
    </Guide>
  );
}
