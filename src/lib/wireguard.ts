import type { WireGuardConfig } from 'react-native-wireguard-vpn';

/** Parse a standard WireGuard `.conf` (INI) into the module's config object. */
export function parseWgConf(text: string): WireGuardConfig {
  const lines = text.split(/\r?\n/);
  let section = '';
  const iface: Record<string, string> = {};
  const peer: Record<string, string> = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (/^\[interface\]$/i.test(line)) {
      section = 'i';
      continue;
    }
    if (/^\[peer\]$/i.test(line)) {
      section = 'p';
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const val = line.slice(eq + 1).trim();
    (section === 'p' ? peer : iface)[key] = val;
  }

  const split = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);
  const endpoint = peer['endpoint'] || '';
  const lastColon = endpoint.lastIndexOf(':');
  const serverAddress = lastColon > 0 ? endpoint.slice(0, lastColon) : endpoint;
  const serverPort = lastColon > 0 ? Number(endpoint.slice(lastColon + 1)) : 51820;

  if (!iface['privatekey'] || !peer['publickey'] || !serverAddress) {
    throw new Error('INVALID');
  }

  const config: WireGuardConfig = {
    privateKey: iface['privatekey'],
    publicKey: peer['publickey'],
    serverAddress,
    serverPort: serverPort || 51820,
    address: split(iface['address']),
    allowedIPs: split(peer['allowedips']) || ['0.0.0.0/0', '::/0'],
    dns: split(iface['dns']) || ['1.1.1.1'],
    mtu: iface['mtu'] ? Number(iface['mtu']) : 1420,
    presharedKey: peer['presharedkey'] || undefined,
  };
  return config;
}

/** Best-effort friendly name from an endpoint/host. */
export function nameFromConfig(c: WireGuardConfig): string {
  return c.serverAddress.replace(/^https?:\/\//, '');
}
