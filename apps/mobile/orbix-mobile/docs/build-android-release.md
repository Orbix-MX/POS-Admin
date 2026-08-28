# Build APK release (Android) — orbix-mobile

Guía para compilar el `.apk` de release en una PC nueva, sin depender del EAS
Build en la nube. Generado tras un build local exitoso en Windows.

## Requisitos

### Base

- **Node.js** v22.x (probado con v22.18.0)
- **pnpm** 10.22.0 — fijado en `packageManager` del `package.json` raíz del monorepo (`orbix-admin/`)
- **JDK 17 o 21** — probado con el JBR de Android Studio (`Android Studio\jbr`, JDK 21)
- **Git**

### Android SDK

Instalar vía Android Studio (SDK Manager) o `sdkmanager` standalone:

- **Android SDK Platform 36** (compileSdk / targetSdk)
- **Build-Tools 36.0.0**
- **NDK 27.1.12297006** — versión exacta, la fija Expo; otra versión puede no linkear
- **CMake 3.22.1**
- **Platform-Tools**

`minSdk` es 24 — no requiere instalar nada extra, solo queda declarado en el build.

### Config local

- `ANDROID_HOME` / `ANDROID_SDK_ROOT` apuntando al SDK instalado
- `android/local.properties` con `sdk.dir=<ruta-sdk>` (lo genera `expo prebuild`, o se crea a mano)
- El `debug.keystore` que firma el release ya vive en `android/app/` (lo genera Expo) — no hace falta crear uno aparte

> `android/` **no está en git** (`.gitignore` de `orbix-mobile`) — es generado por `expo prebuild`.
> En una PC nueva hay que correr `expo prebuild` (si el CLI de Expo funciona ahí) o copiar la
> carpeta `android/` ya generada desde otra máquina.

## Gotcha de Windows: rutas largas

En Windows, con el repo en una ruta larga, el codegen de C++ de algunos módulos
(`react-native-safe-area-context`, `react-native-nitro-modules`) puede generar rutas de
objeto que superan el límite de 260 caracteres de `ninja`, y el build falla en
`:app:buildCMakeRelWithDebInfo[armeabi-v7a]` con:

```
ninja: error: Stat(...): Filename longer than 260 characters
```

**Fix**: en `android/app/build.gradle`, dentro del bloque `android { }`, agregar:

```gradle
externalNativeBuild {
    cmake {
        buildStagingDirectory = file("C:/rncxx/orbix-mobile")
    }
}
```

Esto saca el directorio `.cxx` (staging del build nativo) fuera del árbol de `node_modules`,
acortando las rutas lo suficiente. Como `android/` no se versiona, este fix hay que
reaplicarlo cada vez que se regenera la carpeta con `expo prebuild`.

## Variables de entorno (`.env`)

Copiar `.env.example` a `.env` y ajustar. Para apuntar a producción:

```
EXPO_PUBLIC_API_URL=https://apierp.orbixmx.com/api
EXPO_PUBLIC_API_TIMEOUT=15000
EXPO_PUBLIC_DEFAULT_LOCALE=es
```

Las variables `EXPO_PUBLIC_GOOGLE_*` pueden quedar vacías — el botón "Continuar con
Google" se oculta automáticamente si no hay client ID configurado.

Expo inlinea cada `EXPO_PUBLIC_*` en el bundle JS al momento del build — **no es una
variable de entorno en runtime**, así que cambiar `.env` obliga a regenerar el bundle
(ver siguiente sección).

## Comando de build

```bash
cd apps/mobile/orbix-mobile/android
./gradlew assembleRelease --no-daemon
```

APK generado en:

```
android/app/build/outputs/apk/release/app-release.apk
```

Firmado con el `debug.keystore` por defecto de React Native
(`signingConfig signingConfigs.debug` en el `buildType release`) — sirve para testing
interno, **no para publicar en Play Store** sin generar y configurar un keystore de
producción propio.

## Cache stale del bundle JS al cambiar `.env`

Gradle no detecta cambios en `.env` como input de la tarea
`:app:createBundleReleaseJsAndAssets`, así que un rebuild normal puede reusar el bundle
viejo (`UP-TO-DATE`) con la URL/config anterior ya embebida, sin avisar.

Si cambiaste `.env` y necesitas forzar el rebundle:

```bash
rm -rf android/app/build/generated/assets/createBundleReleaseJsAndAssets
rm -rf android/app/build/intermediates/sourcemaps
./gradlew assembleRelease --no-daemon
```

(Alternativa más lenta pero segura: `./gradlew clean` antes del build, que fuerza todo
—incluyendo el nativo— a recompilar.)

Para verificar qué quedó embebido en el bundle:

```bash
grep -o "apierp.orbixmx.com[a-z/]*" android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle
```

## Estado conocido: la app compila pero no arranca en runtime (pendiente)

El APK compila y se instala sin problema, pero al día de escribir esto **crashea al
arrancar** en el emulador. La causa raíz es *módulos duplicados en el bundle* — el
proyecto es un workspace pnpm con `node-linker=hoisted`, y varios paquetes con estado a
nivel de módulo (Contexts de React, registro de native modules) existen físicamente
tanto en `apps/mobile/orbix-mobile/node_modules/` como en la raíz del monorepo. Cuando
Metro bundlea DOS copias distintas del mismo paquete, cualquier código que dependa de
que ambos import sites vean la *misma* instancia se rompe: un componente nativo se
registra en una copia y se lee desde la otra, o un Context Provider vive en una copia
mientras el hook consumidor lee de la otra.

Esto se manifestó como una cadena de crashes distintos, cada uno resuelto revela el
siguiente:

1. `Cannot find native module 'ExpoClipboard'` — versión de `expo-clipboard` mal
   resuelta (`^57.0.1` en vez de `~8.0.8`). **Arreglado** con `expo install --fix`.
2. `Cannot read property 'useMemoCache'/'useState' of null` en `RootLayout` — dos
   instancias de `react` en el bundle. **Arreglado** quitando la copia local de
   `react`/`react-dom` (aunque reaparece con cada `pnpm install`; el fix real de fondo
   es el de Metro más abajo).
3. `View config getter callback for component 'RNGestureHandlerRootView' must be a
   function` — dos instancias de `react-native-gesture-handler`. **Intentos fallidos**:
   reordenar `nodeModulesPaths` en `metro.config.js` (insuficiente), downgrade a
   `~2.24.0` (no compila contra RN 0.81.5 — API de `ShadowNode` distinta). **Arreglado**
   con `config.resolver.disableHierarchicalLookup = true` + `nodeModulesPaths` apuntando
   solo a la raíz del workspace (ver `metro.config.js`, ya en el repo).
4. `useLinkPreviewContext must be used within a LinkPreviewContextProvider` — mismo
   patrón, esta vez con `expo-router`. Resuelto por el mismo fix del punto 3 (bajó el
   bundle de 3678 a 2244 módulos).
5. **Sin resolver todavía**: `TypeError: undefined is not a function` dentro del propio
   sistema de rutas de expo-router (`loadRoute` → `metroContext` → `metroRequire`,
   trace completo en el historial de la sesión). Aparece justo después del fix del
   punto 3-4, así que es la siguiente capa de la misma cebolla — probablemente una ruta
   específica cuyo módulo no resuelve bien (candidato: `expo-clipboard` de nuevo, o
   alguna otra copia duplicada que el fix de `disableHierarchicalLookup` no cubre).

**Para retomar**: `metro.config.js` ya tiene el fix real (`disableHierarchicalLookup:
true`, `nodeModulesPaths: [workspaceRoot]`) — no deshacerlo. `app.json` también quedó
con `experiments.reactCompiler: false` — se desactivó como prueba antes de encontrar el
fix real de Metro, y el React Compiler probablemente NO era la causa (el problema
siempre fue duplicación de módulos). Vale la pena reactivarlo (`true`) una vez resuelto
el punto 5, para confirmar si sigue funcionando bien con el compiler encendido. El siguiente paso es
identificar qué ruta/módulo específico dispara el punto 5: reproducir el build
(`rm -rf android/app/build/generated/assets/createBundleReleaseJsAndAssets android/app/build/intermediates/sourcemaps`
+ `./gradlew assembleRelease --no-daemon`, nativo ya queda cacheado así que tarda
~2 min), instalar (`adb install -r ...`), lanzar, y leer el stack completo con
`adb logcat -d | grep -E "<pid>.*(ReactNativeJS|AndroidRuntime)"` — el número de línea
del bundle (`index.android.bundle:1:XXXXX`) más un `console.log` de diagnóstico en el
`_layout.tsx` raíz debería acotar la ruta culpable rápido.

## Nota sobre Expo CLI

El comando `assembleRelease` de Gradle **no depende del CLI de Expo** (`expo`/`npx expo`) —
usa Metro directamente vía el plugin de Gradle de React Native. Esto permite compilar
incluso en entornos donde `expo`/`npx expo` esté roto (visto en un sandbox donde
`node_modules/expo/bin/cli` no resolvía), siempre que la carpeta `android/` ya exista
(generada previamente con `expo prebuild` en un entorno donde sí funcionara, o copiada).
