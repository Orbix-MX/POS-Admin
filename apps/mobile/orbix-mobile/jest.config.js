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
    /*
     * Una sola instancia de `expo`, la de la app.
     *
     * pnpm le da a cada paquete su propio conjunto de peers, así que al añadir
     * `expo-camera` aparecieron DOS copias de `expo` en el store: la que usa la
     * app y otra que quedó bajo `expo-image`. `jest-expo` solo mockea la
     * primera, de modo que importar cualquier componente que llegue a
     * `expo-image` ejecutaba el `Expo.fx` de la segunda —sin mockear— y moría
     * en `getDevServer` con «Cannot read properties of null (reading 'match')»,
     * porque en Jest no hay `SourceCode.scriptURL`.
     *
     * Metro resuelve esto por su cuenta en el build real; Jest no, y de ahí que
     * el mapeo viva solo aquí. `^expo/` exige la barra, así que `expo-camera` y
     * los demás `expo-*` no entran por este patrón: cada uno sigue siendo el
     * suyo, solo se unifica el núcleo que llevan como peer.
     */
    '^expo$': '<rootDir>/node_modules/expo',
    '^expo/(.*)$': '<rootDir>/node_modules/expo/$1',
  },
  // Los paquetes de Expo y RN se publican en ESM sin transpilar.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop))',
  ],
  clearMocks: true,
};
