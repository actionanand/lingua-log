import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.actionanand.lingualog.app',
  appName: 'LinguaLog',
  webDir: 'dist/lingua-log/browser',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#f3f7f4',
  },
};

export default config;
