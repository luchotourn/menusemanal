import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.menusemanal',
  appName: 'Menú Semanal',
  // Vite builds the client to dist/public (see vite.config.ts build.outDir)
  webDir: 'dist/public',
  android: {
    // Serve the bundled app over https://localhost so secure-context APIs work
    // and cookies set with Secure flag are accepted by the WebView.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Route WebView fetch/XHR through the native HTTP layer so the app's
    // existing cookie/session auth (credentials: 'include') works cross-origin
    // against https://menusemanal.app without touching the web auth posture.
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
