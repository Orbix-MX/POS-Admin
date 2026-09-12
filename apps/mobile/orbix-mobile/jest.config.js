/**
 * Jest sobre el preset de Expo: los repositorios importan `@/services/api`, que
 * a su vez llega a `expo-constants`, así que un preset de TS pelado no los
 * puede cargar. El alias `@/` se resuelve aquí igual que en `tsconfig.json` —
 * Metro lo lee de ahí, Jest no.
 */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Los paquetes de Expo y RN se publican en ESM sin transpilar.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop))',
  ],
  clearMocks: true,
};
