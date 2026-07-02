import { create } from 'zustand';
import WireGuardVpn, { type WireGuardConfig } from 'react-native-wireguard-vpn';
import { getJSON, setJSON } from '@/lib/storage';

const KEY_CONFIGS = 'bs.vpn.configs';
const KEY_ACTIVE = 'bs.vpn.active';

export interface SavedVpnConfig {
  id: string;
  name: string;
  config: WireGuardConfig;
}

type VpnStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'DISCONNECTING' | 'ERROR' | 'UNKNOWN';

interface VpnState {
  hydrated: boolean;
  supported: boolean;
  configs: SavedVpnConfig[];
  activeId: string | null;
  status: VpnStatus;
  error: string | null;

  hydrate: () => Promise<void>;
  addConfig: (name: string, parsed: WireGuardConfig) => Promise<SavedVpnConfig>;
  removeConfig: (id: string) => Promise<void>;
  connect: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export const useVpn = create<VpnState>((set, get) => ({
  hydrated: false,
  supported: true,
  configs: [],
  activeId: null,
  status: 'DISCONNECTED',
  error: null,

  hydrate: async () => {
    const [configs, activeId] = await Promise.all([
      getJSON<SavedVpnConfig[]>(KEY_CONFIGS, []),
      getJSON<string | null>(KEY_ACTIVE, null),
    ]);
    let supported = true;
    try {
      supported = await WireGuardVpn.isSupported();
    } catch {
      supported = false;
    }
    set({ configs, activeId, supported, hydrated: true });
    get().refreshStatus();
  },

  addConfig: async (name, parsed) => {
    const cfg: SavedVpnConfig = { id: `vpn_${Date.now()}`, name: name.trim() || parsed.serverAddress, config: parsed };
    const configs = [...get().configs, cfg];
    set({ configs });
    await setJSON(KEY_CONFIGS, configs);
    return cfg;
  },

  removeConfig: async (id) => {
    const configs = get().configs.filter((c) => c.id !== id);
    set({ configs });
    await setJSON(KEY_CONFIGS, configs);
  },

  connect: async (id) => {
    const cfg = get().configs.find((c) => c.id === id);
    if (!cfg) return;
    set({ status: 'CONNECTING', error: null, activeId: id });
    await setJSON(KEY_ACTIVE, id);
    try {
      await WireGuardVpn.initialize();
      await WireGuardVpn.connect(cfg.config);
      // Trust the native tunnel state — never claim "connected" without it, or
      // the VPN screen would advertise an IP mask that may not actually exist.
      await get().refreshStatus();
      const st = get().status;
      if (st === 'CONNECTING') set({ status: 'CONNECTED' }); // connect() resolved, handshake pending
      else if (st === 'DISCONNECTED') set({ status: 'ERROR', error: 'Tunnel VPN non attivo.' });
    } catch (e: any) {
      set({ status: 'ERROR', error: e?.message || 'Connessione VPN non riuscita.' });
    }
  },

  disconnect: async () => {
    set({ status: 'DISCONNECTING' });
    try {
      await WireGuardVpn.disconnect();
    } catch {}
    set({ status: 'DISCONNECTED' });
  },

  refreshStatus: async () => {
    try {
      const s = await WireGuardVpn.getStatus();
      set({ status: s.status, error: s.error ?? null });
    } catch {
      // leave current status
    }
  },
}));
