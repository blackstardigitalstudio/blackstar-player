import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { DeviceEventEmitter, TVFocusGuideView, useTVEventHandler, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
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

// Keys taken from the NATIVE onKeyDown bridge (plugins/withTVRemote emits
// 'BlackstarRemoteKey' and always calls super → it never consumes anything, so
// native focus stays untouched). react-native-tvos' own TV event stream does not
// deliver these at all:
//   • channelup/channeldown — the CH+/CH- of an Android box remote;
//   • digit:0-9 — the numeric keypad, for number-bar zapping;
//   • up/down — how you change channel on a remote that HAS no CH+/CH-, which is
//     every Amazon Fire TV remote. Only the Player acts on them (in a full-screen
//     video there is nothing above or below to move the focus to), and the focus
//     gate below keeps every other screen out of it.
// left/right/select/back are deliberately absent: those drive native focus.
function isBridgeKey(k: RemoteKey): boolean {
  return (
    k === 'channelup' ||
    k === 'channeldown' ||
    k === 'up' ||
    k === 'down' ||
    k === 'info' ||
    k.startsWith('digit:')
  );
}

/** Screen-level handler for MEDIA/remote keys (play/pause, ff/rew, zap, digits). */
export function useKeyHandler(handler: KeyHandler, _deps: React.DependencyList = []) {
  const ref = useRef(handler);
  ref.current = handler;

  // Only the screen actually on top may react. Home stays MOUNTED underneath the
  // Player, so without this gate a digit pressed while watching would also make
  // Home jump to another channel, and the Player's zap keys would fight it.
  const onTop = useRef(true);
  useFocusEffect(
    useCallback(() => {
      onTop.current = true;
      return () => {
        onTop.current = false;
      };
    }, []),
  );
  const fire = useCallback((k: RemoteKey) => {
    if (onTop.current) ref.current(k);
  }, []);

  useTVEvents((evt: any) => {
    const k = TV_MAP[evt?.eventType];
    if (k) fire(k);
  });

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('BlackstarRemoteKey', (e: { keyCode: number }) => {
      const k = androidKeyToRemote(e?.keyCode);
      if (k && isBridgeKey(k)) fire(k);
    });
    return () => sub.remove();
  }, [fire]);
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
    // flex:1 is ESSENTIAL: without it the guide sizes to content inside a
    // Modal, the backdrop's own flex:1 collapses, and the card renders glued
    // to the TOP edge half-hidden (the "pulsante aggiornamento mezzo nascosto"
    // bug — it silently misplaced the updater, PIN and TVKeyboard modals).
    <Guide style={{ flex: 1 }} autoFocus trapFocusLeft trapFocusRight trapFocusUp trapFocusDown>
      {children}
    </Guide>
  );
}
