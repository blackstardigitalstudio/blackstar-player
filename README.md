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
  - **Multi-DNS con failover**: fino a 5 DNS per le stesse credenziali; se uno non risponde,
    l'app passa automaticamente al successivo finché la lista si carica
  - **Lista M3U / URL** (classica `get.php?...type=m3u_plus` o qualsiasi `.m3u`)
  - Più **profili** salvati, con cambio rapido dalle Impostazioni
- **Live TV · Film · Serie TV** con categorie, copertine e dettaglio stagioni/episodi
- **Continua a guardare**: film ed episodi ricordano il **punto esatto** (salvato in locale) e
  riprendono da lì; barra di avanzamento in Home e sugli episodi
- **Ricerca intelligente**: suggerimenti automatici mentre scrivi **+ titoli correlati / consigliati**
  (ricerca con debounce, ottimizzata per **liste molto pesanti**)
- **Home con consigli** ("Continua a guardare", "Consigliati per te", "Preferiti")
- **Bilingue Italiano / Español**: tutta l'interfaccia si converte; lingua iniziale dal dispositivo,
  cambiabile dalle Impostazioni
- **Riproduttore selezionabile**: interno, **MX Player**, **VLC** o "chiedi sempre" (player esterno via intent)
- **Multiutente**: profili stile Netflix con selezione all'avvio; ognuno con preferiti, cronologia,
  "Continua a guardare" e consigli propri
- **Consigli intelligenti** (algoritmo semplice): impara i tuoi gusti dai generi che guardi e propone
  righe "Perché hai guardato…" e "Perché ti piacciono…"; nella ricerca mostra "Altri {genere}"
- **Guida TV (EPG a griglia)**: schermata Guida con la timeline dei programmi per canale
- **EPG / Now-Next**: programma "In onda" e "A seguire" sui canali Live (Xtream `get_short_epg`)
- **Controllo parentale**: PIN a 4 cifre che nasconde i contenuti per adulti finché non sblocchi
- **Trasmetti su TV**: apre la condivisione schermo di Android per vedere l'app sul televisore (mirroring)
- **Icona e splash brandizzati** Blackstar (stella viola→magenta su nero)
- **Zapping con barra numerica**: digita il numero del canale per saltarci direttamente
- **Modalità sopravvivenza**: ritenta automaticamente formati/stream alternativi se un canale cade
- **Player** con play/pausa, formato immagine (Adatta/Riempi/Estendi), preferiti e cambio canale Live
- **Ottimizzato per il telecomando** (D-pad): navigazione spaziale a fuoco, tasti freccia/OK/Indietro,
  tasti numerici e canale +/−. Funziona anche al tatto.
- **Veloce**: cache dei contenuti su **file locale** (riapertura istantanea anche con liste enormi,
  senza limiti di dimensione), liste virtualizzate, motore Hermes, nuova architettura RN.
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
