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
> carpeta `android/` ya generada desde otra máquina. Ver la sección **"PC nueva: checklist
> completo"** más abajo — hay varios ajustes manuales que se pierden cada vez que se
> regenera esta carpeta.

## Config de pnpm (`.npmrc`) — por qué existe y qué hace cada línea

Este monorepo usaba `node-linker=hoisted` (copias físicas planas, estilo npm) hasta que
esa config resultó ser la causa raíz de una cadena entera de crashes en runtime del
móvil (ver la sección de historial más abajo). El `.npmrc` committeado ahora usa el
modo symlink normal de pnpm, más un hoisting selectivo:

```
public-hoist-pattern[]=*babel*
public-hoist-pattern[]=@expo/*
public-hoist-pattern[]=metro*
```

Esto hace disponibles en la raíz del `node_modules` del monorepo los paquetes del
toolchain de build (Babel, `@expo/*` internos, Metro) que varias herramientas
(`babel.config.js`, `@expo/metro-config`) esperan encontrar de forma "plana" aunque no
estén declarados como dependencia directa. **No** hoistea paquetes de runtime como
`react`, `expo-router` o `react-native-gesture-handler` — esos se resuelven cada uno a
su única copia real vía symlink, que es justo lo que evita la duplicación.

### Windows: `virtual-store-dir` — config de máquina, NO se versiona

En Windows, la ruta real de cada paquete bajo `node_modules/.pnpm/<pkg>@<hash>/...`
puede superar el límite de 260 caracteres que usa `ninja` al compilar módulos nativos
grandes (`react-native-nitro-modules` en particular). El fix es acortar dónde vive ese
store, pero **no puede ir en el `.npmrc` del repo** — es una ruta absoluta de Windows
(`C:/...`) que rompe `pnpm install` por completo en Mac/Linux.

Cada quien que compile en Windows debe agregarlo a su **`.npmrc` global** (`~/.npmrc`,
no el del proyecto):

```
virtual-store-dir=C:/ps
```

(la ruta puede ser cualquiera corta; `C:/ps` es la que se usó y probó). Esto no afecta a
compañeros en Mac/Linux — ahí el límite de 260 caracteres no existe y pnpm usa su
ubicación default sin problema.

## Gotcha de Windows: rutas largas (nativo)

Con el repo en una ruta larga, el codegen de C++ de algunos módulos
(`react-native-safe-area-context`) puede generar rutas de objeto que superan el límite
de 260 caracteres de `ninja`, y el build falla en `:app:buildCMakeRelWithDebInfo[...]`
con:

```
ninja: error: Stat(...): Filename longer than 260 characters
```

**Fix** (además del `virtual-store-dir` de arriba): en `android/app/build.gradle`,
dentro del bloque `android { }`, agregar:

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

## Limitación conocida: `react-native-nitro-modules` + `armeabi-v7a` en Windows

Bug externo, documentado y sin fix oficial (issues abiertos en `expo/expo` #22444 y
#25771, y en `mrousavy/react-native-vision-camera` #1941): Ninja entra en loop y falla
con `ninja: error: manifest 'build.ninja' still dirty after 100 tries` al compilar
`react-native-nitro-modules` específicamente para la ABI `armeabi-v7a` en Windows. No es
un problema de rutas largas (se midió, el path culpable estaba dentro del límite) ni de
symlinks (se probó reemplazando el symlink del paquete por una copia física real, mismo
resultado). Pasa igual en otros proyectos ajenos a este repo.

**Workaround aplicado**: `android/gradle.properties` tiene

```
reactNativeArchitectures=x86_64
```

en vez de la lista completa (`armeabi-v7a,arm64-v8a,x86,x86_64`). Esto compila **solo
para x86_64** — sirve para probar en el emulador de Android Studio (que corre x86_64 por
defecto en la mayoría de PCs), pero **un APK así no sirve para publicar ni instalar en
celulares reales**, que son casi todos `arm64-v8a`.

**Antes de generar un release para distribuir de verdad**, cambiar esa línea a incluir
al menos `arm64-v8a` (y probar si `armeabi-v7a` compila en esa máquina — el bug puede no
reproducirse en todas las instalaciones de Windows/NDK):

```
reactNativeArchitectures=arm64-v8a,x86_64
```

Como `android/` no se versiona, este ajuste también se pierde con cada `expo prebuild`.

## PC nueva: checklist completo

Al clonar el repo en una máquina nueva, en este orden:

1. Instalar los requisitos base + Android SDK de arriba.
2. Windows: agregar `virtual-store-dir=C:/ps` al `~/.npmrc` global (ver sección de arriba).
3. `pnpm install` en la raíz del monorepo (`orbix-admin/`).
4. `cd apps/mobile/orbix-mobile && cp .env.example .env` y ajustar (ver sección de `.env`).
5. `expo prebuild --platform android --no-install` (si el CLI de Expo funciona en esa
   máquina — ver "Nota sobre Expo CLI" más abajo) para generar `android/`.
6. Crear `android/local.properties` con `sdk.dir=<ruta-al-sdk>` si `prebuild` no lo hizo.
7. Reaplicar en `android/app/build.gradle` el fix de `buildStagingDirectory` (sección de
   rutas largas de arriba).
8. Reaplicar en `android/gradle.properties` el `reactNativeArchitectures` que corresponda
   (`x86_64` solo para emulador de prueba local; incluir `arm64-v8a` para un release real).
9. `cd android && ./gradlew assembleRelease --no-daemon`.

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
—incluyendo el nativo— a recompilar. Ojo: si usas `virtual-store-dir` externo al repo
tipo `C:/ps`, `clean` no toca esos `.cxx` — hay que borrarlos a mano si hace falta.)

Para verificar qué quedó embebido en el bundle:

```bash
grep -o "apierp.orbixmx.com[a-z/]*" android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle
```

## Historial: la cadena de crashes de duplicación de módulos (ya resuelto)

El APK compilaba e instalaba, pero crasheaba al arrancar. La causa raíz era *módulos
duplicados en el bundle*: con `node-linker=hoisted`, varios paquetes con estado a nivel
de módulo (Contexts de React, registro de native modules) existían físicamente tanto en
`apps/mobile/orbix-mobile/node_modules/` como en la raíz del monorepo. Metro bundleaba
dos instancias distintas del mismo paquete, y cualquier código que dependiera de que
ambos import sites vieran la *misma* instancia se rompía.

Cadena de síntomas, cada uno resuelto revelaba el siguiente:

1. `Cannot find native module 'ExpoClipboard'` — versión de `expo-clipboard` mal
   resuelta (`^57.0.1` en vez de `~8.0.8`). Arreglado con `expo install --fix`.
2. `Cannot read property 'useMemoCache'/'useState' of null` en `RootLayout` — dos
   instancias de `react` en el bundle.
3. `View config getter callback for component 'RNGestureHandlerRootView' must be a
   function` — dos instancias de `react-native-gesture-handler`.
4. `useLinkPreviewContext must be used within a LinkPreviewContextProvider` — mismo
   patrón, con `expo-router`.
5. `TypeError: undefined is not a function` dentro del propio sistema de rutas de
   expo-router — la última capa de la misma cebolla.

**Fix real, de fondo**: quitar `node-linker=hoisted` del `.npmrc` (volver al modo
symlink normal de pnpm) + hoisting selectivo solo del toolchain de build (sección de
arriba). Con eso, cada paquete tiene una única copia física real en todo el monorepo —
ya no hay nada que duplicar. Los intentos anteriores de arreglarlo por el lado de Metro
(`nodeModulesPaths`, `disableHierarchicalLookup`, `blockList`) quedaron obsoletos y ya no
están en `metro.config.js` — no hacen falta con symlinks.

Efecto secundario de volver al modo symlink estricto: salieron a la luz dependencias
"fantasma" que `hoisted` tapaba (código que las usaba sin declararlas, confiando en que
el flat `node_modules` las hiciera "aparecer" solas). Quedaron declaradas en
`package.json`: `@expo/config-plugins`, `babel-preset-expo`.

`experiments.reactCompiler` en `app.json` se probó en `false` durante el diagnóstico
(antes de encontrar el fix real) — el compiler nunca fue la causa. Ya quedó de vuelta en
`true` y funciona bien.

## Nota sobre Expo CLI

El comando `assembleRelease` de Gradle **no depende del CLI de Expo** (`expo`/`npx expo`) —
usa Metro directamente vía el plugin de Gradle de React Native. Esto permite compilar
incluso en entornos donde `expo`/`npx expo` esté roto (visto en un sandbox donde
`node_modules/expo/bin/cli` no resolvía vía su shim `.bin/expo` — hay que invocarlo
directo con `node node_modules/expo/bin/cli <comando>`), siempre que la carpeta
`android/` ya exista (generada previamente con `expo prebuild` en un entorno donde sí
funcionara, o copiada).
