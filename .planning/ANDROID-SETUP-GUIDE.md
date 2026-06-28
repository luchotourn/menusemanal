# Android App — First-Time Setup Guide (for someone who's never done this)

Three accounts/tools to set up. Do them in this order. ⏱️ = rough time.
Items marked **[blocks dev]** are needed before a specific phase; the rest can wait.

---

## 1. Android Studio (installs Java + the Android SDK) — **[blocks the native build, Phase 0]** ⏱️ 30–60 min

This is the toolchain on *your Mac*. It bundles the JDK and Android SDK that Capacitor's Gradle build needs. Without it, `npx cap add android` and APK builds can't run.

1. Download from https://developer.android.com/studio (the macOS Apple-Silicon `.dmg`).
2. Open the `.dmg`, drag **Android Studio** into Applications, launch it.
3. The **Setup Wizard** appears → choose **Standard** install → accept licenses → let it download the SDK, platform tools, and an emulator image (a few GB).
4. When it finishes, open **Settings → Languages & Frameworks → Android SDK** and note the **Android SDK Location** (usually `/Users/lucho/Library/Android/sdk`).
5. Tell your shell where the SDK is. Add to `~/.zshrc`:
   ```sh
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
   # Use Android Studio's bundled JDK so `java` is found:
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export PATH="$JAVA_HOME/bin:$PATH"
   ```
   Then run `source ~/.zshrc` and verify: `java -version` and `adb --version` both print versions.
6. (For testing on your own phone) On the phone: **Settings → About phone → tap "Build number" 7 times** to unlock Developer options, then enable **USB debugging**. Plug in via USB and accept the prompt. `adb devices` should list it.

> Once this is done, tell me — I'll run `npx cap add android`, build, and put the app on your device/emulator.

---

## 2. Google Play Console account — **[only needed to publish to the Play Store; NOT needed to sideload]** ⏱️ 15 min + up to a few days verification

You can skip this until you want a public Play Store listing. We sideload first.

1. Go to https://play.google.com/console and sign in with the Google account you want to **own** the app (use a long-lived account, not a throwaway).
2. Choose account type: **Personal** (simplest) or **Organization**. Personal is fine for now.
3. Pay the **one-time $25** registration fee.
4. Complete **identity verification** — Google asks for your legal name, address, and a government ID. **This can take a few hours to a few days**, so start it early even if you're not ready to publish.
5. Once verified, you'll later: create an app → fill the **Data safety** form (declare: email, account info, user content, push tokens, AI-processed inputs) → add a **Privacy policy URL** (host one at `menusemanal.app/privacy`) → upload the signed app to the **Internal testing** track first.

> Nothing for me to do here — it needs your identity/payment. Just start it; the verification delay is the long pole.

---

## 3. Firebase project (for push notifications / FCM) — **[blocks push, Phase 3]** ⏱️ 20 min

Firebase Cloud Messaging is how Android delivers push. You create the project; you give me two things: `google-services.json` (goes in the app) and a service-account key (a backend secret).

1. Go to https://console.firebase.google.com → **Create a project**.
   - Name it e.g. `menu-semanal`. You can **disable Google Analytics** (not needed for push).
2. In the project, click the **Android** icon ("Add app"):
   - **Android package name**: `app.menusemanal` ← must match exactly (this is our app id).
   - **App nickname**: `Menu Semanal` (optional).
   - **Debug signing SHA-1**: skip for now (only needed for some Google services, not basic FCM).
   - Click **Register app**.
3. **Download `google-services.json`** when prompted. Send it to me / drop it at `android/app/google-services.json` (it's gitignored — never commit it). This wires the app to your Firebase project.
4. Skip the SDK code snippets Firebase shows — the Capacitor push plugin handles that.
5. Get the **server credential** so our backend can *send* pushes:
   - Go to **Project settings (gear) → Service accounts → Generate new private key** → downloads a JSON file.
   - This is a **secret**. Don't commit it. We'll store its contents in the backend env (e.g. `FIREBASE_SERVICE_ACCOUNT`) on the server / as a CI secret. Send it to me securely (or just tell me the env var is set on the server).
6. (FYI) Modern FCM uses the **HTTP v1 API** with that service account — no legacy "server key" needed.

> When you've done steps 3 and 5, push (Phase 3) is unblocked.

---

## What I need from you, summarized

| # | You do | I need from you | Unblocks |
|---|--------|-----------------|----------|
| 1 | Install Android Studio + set env vars | "toolchain ready" (verify `java -version`, `adb --version`) | Native build (Phase 0) — putting the app on a device |
| 3 | Create Firebase project + Android app | `google-services.json` + service-account JSON (or confirmation the backend env var is set) | Push notifications (Phase 3) |
| 2 | Create Play Console account + verify identity | nothing (your identity/payment) | Public Play Store release (later) |

Start **#1 now** (it's the immediate blocker) and **#2 in parallel** (slow verification). **#3** can wait until we reach the push phase, but doing it early doesn't hurt.
