import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.example.ionrush', appName: 'ION RUSH', webDir: 'dist',
  ios: { backgroundColor: '#060d19', contentInset: 'never', scrollEnabled: false, preferredContentMode: 'mobile' },
  android: { backgroundColor: '#060d19', allowMixedContent: false },
};
export default config;
