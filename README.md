# ⭐ Blackstar Player

Player **IPTV** moderno, veloce e ottimizzato per la **TV / box Android**, realizzato con Expo (React Native).
Parte del mondo **Blackstar Digital Studio**. **Made in Italy** 🇮🇹

> Blackstar Player **non fornisce alcun contenuto né alcun server**. Riproduce esclusivamente la lista
> (M3U) o l'abbonamento (Xtream) che inserisci **tu**. Nessun account, nessuna pubblicità, nessuna
> telemetria: i tuoi dati restano sul dispositivo.

---

## ✨ Caratteristiche

- **Tre modalità d'accesso**
  - **Xtream Codes** con i tre fattori: **username · password · DNS server**
  - **Lista M3U / URL** (classica `get.php?...type=m3u_plus` o qualsiasi `.m3u`)
  - Più **profili** salvati, con cambio rapido dalle Impostazioni
- **Live TV · Film · Serie TV** con categorie, copertine e dettaglio stagioni/episodi
- **Ricerca intelligente**: suggerimenti automatici mentre scrivi **+ titoli correlati / consigliati**
- **Home con consigli** ("Continua a guardare", "Consigliati per te", "Preferiti")
- **Zapping con barra numerica**: digita il numero del canale per saltarci direttamente
- **Modalità sopravvivenza**: ritenta automaticamente formati/stream alternativi se un canale cade
- **Player** con play/pausa, formato immagine (Adatta/Riempi/Estendi), preferiti e cambio canale Live
- **Ottimizzato per il telecomando** (D-pad): navigazione spaziale a fuoco, tasti freccia/OK/Indietro,
  tasti numerici e canale +/−. Funziona anche al tatto.
- **Veloce**: cache locale dei contenuti, liste virtualizzate, motore Hermes, nuova architettura RN.
- **Tema Blackstar**: nero profondo + accento **viola/magenta**, tipografia leggibile a distanza.

## 🎨 Brand

Palette derivata da Blackstar Digital Studio: base nera (`#0A0A0F`) con accento "stella" viola→magenta
(`#7C3AED → #A855F7 → #D946EF`). Vedi [`src/theme/tokens.ts`](src/theme/tokens.ts).

## 🚀 Sviluppo

```bash
npm install
npx expo start        # apre il dev server (Expo Go / dev build / web)
npm run android       # avvia su emulatore/dispositivo Android
```

Richiede Node 20+. Il progetto usa **Expo SDK 56** ed **expo-router**.

## 📦 Generare l'APK installabile

L'app è **autonoma**: l'APK si costruisce con Expo prebuild + Gradle, **senza EAS e senza account Expo**.

### A) In automatico su GitHub (consigliato)
Ad ogni push su `main`, la GitHub Action [`build-apk.yml`](.github/workflows/build-apk.yml) genera
`blackstar-player.apk` come **artifact** e lo pubblica nella **Release `latest`**. Puoi anche lanciarla a
mano da *Actions → Build Android APK → Run workflow*.

### B) In locale
```bash
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease        # Windows: .\gradlew.bat assembleRelease
# APK in: android/app/build/outputs/apk/release/app-release.apk
```

Installa l'APK sul box: `adb install -r blackstar-player.apk` oppure copialo sul dispositivo e aprilo.

## 🏗️ Struttura

```
src/
  app/                 # rotte expo-router (onboarding, tabs, player, serie)
    (tabs)/            # Home · Live · Film · Serie · Cerca · Impostazioni
  components/          # UI kit, card, rail, browser, nav rail
  lib/                 # parser M3U, client Xtream, ricerca, storage, tipi
  store/               # stato globale (zustand)
  tv/                  # motore di fuoco D-pad + bridge tasti telecomando
  theme/               # design token Blackstar
plugins/               # config plugin: tasti TV + Android TV/leanback
```

## 🔒 Privacy

Nessun backend, nessun servizio esterno, nessun tracciamento. Le credenziali e le liste sono salvate
solo localmente (AsyncStorage) sul dispositivo.

---

© Blackstar Digital Studio — **Made in Italy** 🇮🇹
