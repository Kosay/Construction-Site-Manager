# 🏗️ Construction Site Manager

A modern web and mobile application for managing construction site projects, blueprints, 3D models, and site observations with GPS coordinates and photo evidence.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20iOS%20%7C%20Android-informational)

## ✨ Features

### Core Capabilities
- 📋 **Project Management** - Create and manage multiple construction sites
- 🎨 **Blueprint Viewer** - Upload and annotate 2D drawing files (images)
- 📐 **3D Model Viewer** - View and interact with GLB format 3D models
- 🗺️ **Site Mapping** - Interactive Google Maps with KML layer support and GPS point marking
- 📍 **Mark Creation** - Add observation points with:
  - GPS coordinates with accuracy metrics
  - Photo evidence capture
  - Category tagging (safety, defect, measurement, progress, quality, etc.)
  - Custom labels and descriptions
- 📸 **Photo Capture** - Full-screen camera integration via Capacitor (mobile)
- 📍 **GPS Location** - Native geolocation with accuracy display
- 👥 **Secure Sharing** - Generate shareable links with access control (view-only or edit)

### Platform Support
- 🖥️ **Web App** - Responsive desktop/tablet interface
- 📱 **Mobile App** - Touch-optimized Android app via Capacitor
- 🌙 **Dark Mode** - Full dark theme support across all interfaces

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase account (for backend)
- Google Maps API key
- (Optional) Android SDK for APK builds

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kosay/Construction-Site-Manager.git
   cd Construction-Site-Manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file:
   ```env
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Run locally**
   ```bash
   npm run dev
   ```
   Open http://localhost:5173

## 📦 Building & Deployment

### Web App (Vercel)

The web app auto-deploys to Vercel on every push.

1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel Project Settings
3. Every push to `main` automatically deploys

### Mobile App (Android APK)

#### Automated via GitHub Actions

1. **Add GitHub Secrets** (Settings → Secrets and variables → Actions):
   ```
   VITE_GOOGLE_MAPS_API_KEY
   VITE_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN
   VITE_FIREBASE_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET
   VITE_FIREBASE_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID
   ```

2. **Push to trigger build**
   ```bash
   git push origin main
   ```

3. **Download APK**
   - Go to Actions tab
   - Find latest "Build APK" workflow
   - Download `construction-site-manager-apk` artifact
   - Contains `app-debug.apk` (testing) and `app-release.apk` (if signed)

#### Signed Release Build

1. Generate keystore:
   ```bash
   keytool -genkey -v -keystore construction-manager.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias construction-manager
   ```

2. Encode to base64:
   ```bash
   base64 construction-manager.jks | tr -d '\n' > keystore.txt
   ```

3. Add to GitHub Secrets:
   - `KEYSTORE_BASE64` - Contents of keystore.txt
   - `KEYSTORE_PASSWORD` - Your keystore password
   - `KEY_ALIAS` - construction-manager
   - `KEY_PASSWORD` - Same as keystore password

4. Push to trigger signed build:
   ```bash
   git push origin main
   ```

### Local APK Build

```bash
# Build React app
npm run build

# Sync Capacitor
npx cap sync

# Build APK
cd android
./gradlew assembleDebug

# APK location: app/build/outputs/apk/debug/app-debug.apk
```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + dark mode
- **Mobile**: Capacitor (React Native bridge)
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Maps**: Google Maps API + KML support
- **3D Viewer**: Three.js (GLB models)
- **Build**: Vite + React + npm
- **CI/CD**: GitHub Actions
- **Deployment**: Vercel (web) + GitHub Actions (APK)

### File Structure
```
src/
├── components/
│   ├── mobile/          # Mobile-optimized UI
│   ├── DrawingViewer.tsx
│   ├── ModelViewer.tsx
│   ├── MapViewer.tsx
│   └── ...
├── hooks/
│   └── useIsMobile.ts   # Device detection
├── lib/
│   ├── firebase.ts      # Firebase config
│   ├── firestore.ts     # Database operations
│   └── storage.ts       # File uploads
├── types/               # TypeScript interfaces
└── App.tsx             # Main app component
```

## 🔐 Security Features

- ✅ Firebase Authentication (email/anonymous)
- ✅ Secure share links with access tokens
- ✅ Role-based access (Admin/Guest/Editor)
- ✅ Environment variable protection (no secrets in code)
- ✅ Firestore security rules
- ✅ HTTPS only (Vercel + GitHub)

## 📱 Mobile Features

- Full-screen native camera via Capacitor
- HTML5 Geolocation for GPS capture
- Offline-capable (service worker)
- Bottom navigation for thumb-friendly access
- Responsive grid layouts for tablets
- Dark mode support

## 🔄 Data Sync

- Real-time Firestore synchronization
- Automatic project/drawing/model loading
- Mark metadata with timestamps
- GPS accuracy tracking
- Photo evidence attachment

## 📊 Project Statistics

- **Web App**: ~6,000 lines of React/TypeScript
- **Mobile Components**: 8 custom components
- **API Integration**: Google Maps + Firebase
- **Deployment**: Automated CI/CD pipeline
- **Build Time**: ~3-5 minutes (APK), ~2 minutes (web)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Create a Pull Request

## 🐛 Known Issues & Roadmap

### Current Limitations
- Mark creation modal not yet implemented
- Mark details/edit screen pending
- Settings screen not configured
- Offline mode in progress

### Planned Features
- Offline mark storage
- Export reports (PDF)
- Team collaboration features
- Advanced filtering/search
- Mark version history
- Integration with project management tools

## 📞 Support & Contact

**Developer**: Eng. Kosay Hatem
- 📧 Email: kosay-h@hotmail.com
- 📱 Phone: +971-566371160

## 📄 License

MIT License - Feel free to use this project for personal and commercial purposes.

## 🙏 Acknowledgments

- Built with React, Firebase, and Capacitor
- Maps powered by Google Maps Platform
- UI components from Lucide Icons
- Styling with Tailwind CSS
- Hosted on Vercel & GitHub

---

**Last Updated**: July 2026  
**Version**: 1.0.0  
**Status**: Active Development
