import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.actionanand.lingualog.app',
  appName: 'LinguaLog',
  webDir: 'dist/lingua-log/browser',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0f1713',
  },
};

export default config;
