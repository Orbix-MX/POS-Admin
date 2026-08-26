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

## Nota sobre Expo CLI

El comando `assembleRelease` de Gradle **no depende del CLI de Expo** (`expo`/`npx expo`) —
usa Metro directamente vía el plugin de Gradle de React Native. Esto permite compilar
incluso en entornos donde `expo`/`npx expo` esté roto (visto en un sandbox donde
`node_modules/expo/bin/cli` no resolvía), siempre que la carpeta `android/` ya exista
(generada previamente con `expo prebuild` en un entorno donde sí funcionara, o copiada).
