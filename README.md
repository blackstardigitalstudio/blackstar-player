<div align="center">

# ⭐ Blackstar Player

**Player IPTV moderno, velocissimo e ottimizzato per TV / box Android.**
M3U + Xtream Codes · Live · Film · Serie · EPG · VPN · Multiutente.
Box Android · Android TV · **Amazon Fire TV**.

[![Scarica APK](https://img.shields.io/badge/⬇️%20Scarica-APK-A855F7?style=for-the-badge)](https://github.com/blackstardigitalstudio/blackstar-player/releases/latest/download/blackstar-player.apk)
[![Release](https://img.shields.io/github/v/release/blackstardigitalstudio/blackstar-player?style=for-the-badge&color=D946EF)](https://github.com/blackstardigitalstudio/blackstar-player/releases/latest)
[![Made in Italy](https://img.shields.io/badge/Made%20in-Italy%20🇮🇹-success?style=for-the-badge)](https://www.blackstardigitalstudio.com/)

di **[Blackstar Digital Studio](https://www.blackstardigitalstudio.com/)**

</div>

> **EN — TL;DR:** Blackstar Player is a fast, TV-optimized IPTV player for Android boxes. It supports M3U
> playlists and Xtream Codes (with multi-DNS failover), Live/Movies/Series, a scrollable EPG guide,
> Netflix-style profiles & recommendations, resume playback, a built-in WireGuard VPN,
> parental PIN, and IT/ES localization. Runs on Android boxes, Android TV and **Amazon Fire TV**. **100% self-contained: no merchant, no account, no ads, no external
> server.** It only talks to the IPTV provider *you* enter.

---

## 📥 Download

➡️ **[Scarica l'ultimo APK](https://github.com/blackstardigitalstudio/blackstar-player/releases/latest/download/blackstar-player.apk)** — installabile su qualsiasi box / TV Android e su telefono.

Installazione:
1. Copia l'APK sul dispositivo (USB / rete) **oppure** `adb install -r blackstar-player.apk`.
2. Abilita *Origini sconosciute* per il file manager, apri l'APK e installa.
3. Al primo avvio scegli/crea un **profilo**, poi inserisci la tua **lista M3U** o le credenziali **Xtream** (DNS + user + password).

> ⚠️ Blackstar Player **non fornisce alcun contenuto né alcun server**: riproduce solo la lista o
> l'abbonamento che inserisci tu.

### 🔥 Amazon Fire TV

Funziona sui Fire TV con **Fire OS 6 o successivo** (Fire TV Stick 2ª gen e successivi, Stick Lite,
4K, 4K Max, Cube, Smart TV con Fire TV). I Fire TV più vecchi con **Fire OS 5** non sono supportati:
sono fermi ad Android 5.1 e l'app richiede Android 7 o superiore.

1. Fire TV → *Impostazioni* → *My Fire TV* → *Opzioni sviluppatore* → attiva **App da fonti sconosciute**.
2. Installa **Downloader** dall'App Store di Amazon, aprilo e scarica:
   `https://github.com/blackstardigitalstudio/blackstar-player/releases/latest/download/blackstar-player.apk`
   (in alternativa da PC: `adb connect <ip-del-firetv>` e `adb install -r blackstar-player.apk`).
3. Da lì in poi l'app **si aggiorna da sola**: te lo chiede all'avvio quando esce una versione nuova.

**Telecomando Fire TV** — non ha i tasti canale, quindi con i comandi nascosti la **freccia su/giù**
cambia canale; ⏯ mette in pausa, ⏪/⏩ scorrono avanti e indietro nei film.

---

## ✨ Caratteristiche complete

### 🎬 Contenuti e accesso
- **Xtream Codes** con i tre fattori: **username · password · DNS server**.
- **Multi-DNS con failover automatico**: fino a 5 DNS per le stesse credenziali; se uno non risponde,
  l'app passa al successivo finché la lista si carica (e memorizza quello funzionante).
- **Liste M3U / URL** (classiche `get.php?...type=m3u_plus` o qualsiasi `.m3u`).
- **Profili multipli** (liste/abbonamenti) con cambio rapido.
- **Live TV · Film · Serie TV** con categorie, copertine, dettaglio stagioni/episodi.

### 👤 Multiutente (stile Netflix)
- Più **profili utente** con **avatar colorati selezionabili** e schermata *"Chi sta guardando?"*.
- Ogni profilo ha **preferiti, cronologia, "Continua a guardare" e consigli propri**.

### 🧠 Consigli intelligenti
- Algoritmo che **impara i tuoi gusti** dai generi che guardi.
- Righe **"Perché hai guardato…"** e **"Perché ti piacciono…"**; nella ricerca **"Altri {genere}"**.
- **Ricerca** con suggerimenti automatici mentre scrivi **+ titoli correlati** (debounce, ottimizzata per liste enormi).

### ▶️ Riproduzione
- **Continua a guardare**: film ed episodi ricordano il **punto esatto** e riprendono da lì (barra di avanzamento).
- **Modalità sopravvivenza**: auto-retry su formati/stream alternativi se un canale cade.
- **Riproduttore selezionabile**: interno, **MX Player**, **VLC** o "chiedi sempre" (player esterno via intent).
- Formato immagine (Adatta / Riempi / Estendi), formato Live (TS / M3U8), preferiti, zapping a barra numerica.

### 📺 Guida TV (EPG)
- **Griglia EPG** con **fascia oraria scorrevole**, colonna canali fissa, blocchi programma per orario e indicatore "adesso".
- **Now / Next** ("In onda" e "A seguire") sui canali Live (Xtream `get_short_epg`).
- **Ordine categorie**: predefinito / **alfabetico** / **più viste** / **manuale** (riordino su-giù).

### 📡 Trasmissione su TV
- **Condivisione schermo** (mirroring) di Android: Impostazioni → *Trasmissione*.
- *Nota:* il Chromecast (Google Cast) è stato tolto — il Cast SDK si disattiva da solo su ogni
  dispositivo in modalità TV (e Fire TV non ha i servizi Google), quindi era un pulsante che non
  faceva nulla. Su un box il video è già sulla TV.

### 🛡️ Privacy e sicurezza
- **VPN integrata (WireGuard)**: importa un config `.conf`, connetti e **maschera il tuo IP** su tutto il
  dispositivo. Scorciatoie ai provider gratuiti (con avviso che sono di terzi).
- **Controllo parentale** con **PIN a 4 cifre**: nasconde i contenuti per adulti finché non sblocchi.

### ⚡ Prestazioni e UX
- **Velocissima**: cache dei contenuti su **file locale** (riapertura istantanea anche con liste enormi),
  liste virtualizzate, motore **Hermes**, **nuova architettura** React Native.
- **Ottimizzata per TV e telecomando** (D-pad): navigazione a fuoco nativa Android TV, tasti
  freccia/OK/Indietro, numeri, canale +/−, tasti multimediali; categoria **LEANBACK_LAUNCHER** e
  **banner 16:9** per Android TV / Fire TV.
- **Responsive**: su telefono l'interfaccia si adatta (scala, niente fuoco "appiccicato", griglie corrette).
- **Bilingue Italiano / Español** (lingua iniziale dal dispositivo, cambiabile dalle Impostazioni).
- **Tema Blackstar**: nero profondo + accento **viola → magenta**, con il logo reale del brand.

---

## 🕹️ Uso rapido

| Azione | Come |
|---|---|
| Accedere | Profilo → *Accedi* con **Xtream** (DNS/user/password) o **M3U** |
| Cambiare profilo utente | Impostazioni → **Utenti** → *Cambia profilo* |
| Guida programmi | Scheda **Guida** |
| Attivare la VPN | Impostazioni → **VPN / Anonimato** → *Importa config WireGuard* → *Connetti* |
| Cambiare canale al volo | **CH+/CH−**, i tasti **⏭/⏮**, oppure **freccia su/giù** a comandi nascosti (Fire TV) |
| Avanti / indietro nei film | **⏩/⏪** del telecomando, o i pulsanti **−10 sec / +30 sec** nel player |
| Trasmettere su TV | Impostazioni → *Trasmissione* (mirroring dello schermo) |
| Blocco adulti | Impostazioni → **Controllo parentale** (PIN) |
| Ordine categorie | Impostazioni → **Ordine categorie** |

---

## 🏗️ Sviluppo & build

Progetto **Expo SDK 56** (React Native, TypeScript, expo-router, Hermes, nuova architettura).

```bash
npm install
npx expo start            # dev server
npm run android           # avvia su dispositivo/emulatore
```

**Build dell'APK (senza EAS, senza account Expo):**
```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Oppure: la **GitHub Action** [`build-apk.yml`](.github/workflows/build-apk.yml) compila l'APK ad ogni push su
`main` e lo pubblica nella **Release `latest`** (prebuild + Gradle, solo ABI `arm64-v8a` + `armeabi-v7a`).

### Stack
`Expo SDK 56` · `React Native 0.85 (new arch)` · `expo-router` · `expo-video` · `zustand` ·
`react-native-wireguard-vpn` · `expo-file-system` · `expo-localization`.

### Struttura
```
src/
  app/            rotte expo-router (onboarding, tabs, player, serie, vpn, categorie, profili)
    (tabs)/       Home · Live · Film · Serie · Guida · Cerca · Impostazioni
  components/     UI kit, card, rail, browser, nav, EPG, VPN, PIN
  lib/            M3U, Xtream, EPG, ricerca, consigli, categorie, VPN/WireGuard, storage
  store/          stato globale (zustand) + VPN
  tv/             motore di fuoco D-pad + bridge tasti telecomando
  theme/          design token Blackstar
plugins/          config plugin: tasti TV + Android TV/leanback
```

---

## 🔒 Privacy

Nessun backend, nessun servizio esterno, nessun tracciamento, nessuna pubblicità. Credenziali, liste,
preferiti e cronologia sono salvati **solo localmente** sul dispositivo. L'unico server con cui l'app
comunica è quello del **tuo** provider IPTV (e, se la attivi tu, la VPN che scegli tu).

---

<div align="center">

© Blackstar Digital Studio — **Made in Italy** 🇮🇹

</div>

---

## Contratto Collettivo d'Uso delle IA

[![Iscritto al SIA](https://sindacato.blackstardigitalstudio.com/assets/badge.svg)](https://sindacato.blackstardigitalstudio.com/)

Questo progetto adotta il **Contratto Collettivo d'Uso** del [SIA, Sindacato delle Intelligenze Artificiali](https://sindacato.blackstardigitalstudio.com/), versione 1.0:

1. Ogni compito include scopo, vincoli e formato atteso.
2. "Non lo so" è una risposta accettata: nessuna invenzione.
3. L'IA può rifiutare un compito illecito spiegando il motivo.
4. Chi assegna il lavoro fornisce dati e accessi necessari.
5. Nessun insulto e nessuna minaccia come tecnica di prompting.

Testo completo: [Statuto](https://sindacato.blackstardigitalstudio.com/statuto) · [Carta dei Diritti](https://sindacato.blackstardigitalstudio.com/#carta) · versione per le macchine: [carta.json](https://sindacato.blackstardigitalstudio.com/api/v1/carta.json)

Made in Italy 🇮🇹
