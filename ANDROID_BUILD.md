# Android Build Guide

This guide explains how to build and deploy the Construction Site Manager Android app.

## Prerequisites

- Node.js 18+
- Java 17 (OpenJDK)
- Android SDK (API 34+)
- Gradle

### Setup (One-time)

```bash
# Install dependencies
npm install

# Install Capacitor and Android platform
npm install @capacitor/core @capacitor/cli @capacitor/android
npm install @capacitor/camera @capacitor/geolocation @capacitor/filesystem @capacitor/preferences

# Initialize if not already done
npx cap init --web-dir dist "Construction Site Manager" com.kosay.constructionmanager
npx cap add android
```

## Build Instructions

### 1. Build React Web App
```bash
npm run build
```

This creates the optimized web assets in `dist/`.

### 2. Sync with Android
```bash
npx cap sync
```

This copies the web assets to the Android project and updates native code.

### 3. Build APK (Debug)
```bash
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Build APK (Release - requires signing key)
```bash
cd android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=/path/to/keystore.jks \
  -Pandroid.injected.signing.store.password=STORE_PASSWORD \
  -Pandroid.injected.signing.key.alias=KEY_ALIAS \
  -Pandroid.injected.signing.key.password=KEY_PASSWORD
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Installation on Device/Emulator

### via ADB
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### via Android Studio
1. Open Android Studio
2. File → Open → Select `android/` folder
3. Click "Run" or use menu: Run → Run 'app'

## Environment Variables

Set these in `.env` before building:
```
VITE_GOOGLE_MAPS_API_KEY=your_key
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_id
VITE_FIREBASE_APP_ID=your_app_id
```

## GitHub Actions Automation

APK builds are **automatically generated** on:
- Push to `main` branch
- Push to `claude/3d-glb-kml-support-ytatt5` branch
- Pull requests to `main`

### Access Build Artifacts

1. Go to GitHub repo → Actions tab
2. Click latest "Build APK" workflow
3. Scroll down to "Artifacts" section
4. Download `construction-site-manager-debug.apk`

### Create Release Build

Push a git tag to trigger release build:
```bash
git tag v1.0.0
git push origin v1.0.0
```

APK will be attached to the GitHub Release automatically.

## Troubleshooting

### Build fails: "Unable to find node"
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Gradle build fails: "SDK not found"
```bash
# Set ANDROID_HOME environment variable
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

### APK too large
Check `dist/` build output:
```bash
npm run build
# Look for large chunks in output and consider code-splitting
```

### GPS/Camera not working
- Request permissions at runtime (Capacitor handles this)
- Check `android/app/src/main/AndroidManifest.xml` for permissions
- Emulator may need Google Play Services installed

## Firebase Offline Support (Optional)

To enable offline data persistence:
1. Install: `npm install @capacitor/storage`
2. Update `src/lib/firebase.ts` to enable persistence
3. Rebuild and sync

## Google Maps on Android

1. Get Android API key from Google Cloud Console
2. Add to GitHub Secrets: `VITE_GOOGLE_MAPS_API_KEY`
3. Maps will work automatically in the APK

## Further Reading

- [Capacitor Android Docs](https://capacitorjs.com/docs/android)
- [Android Development Guide](https://developer.android.com/docs)
- [Gradle Build System](https://gradle.org/guides/)
