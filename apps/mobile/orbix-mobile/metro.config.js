// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../..');

const config = getDefaultConfig(projectRoot);

// pnpm workspace, standard symlink linker (not hoisted): every dependency is
// a single real file under the workspace root's `.pnpm` store, symlinked
// into whichever package(s) declare it — there is exactly one instance of
// each package on disk, so Metro's normal hierarchical resolution already
// lands on the right file with no ambiguity. Only `watchFolders` needs to
// widen beyond `projectRoot`, so Metro notices changes to workspace
// dependencies (and Metro follows the symlinks back to their real path
// under `workspaceRoot`, which has to be inside a watched folder).
//
// A previous version of this file fought a real bug (two live instances of
// react-native-gesture-handler / expo-router / react in the same bundle)
// with `nodeModulesPaths`/`disableHierarchicalLookup` overrides — that was
// the right fix for `node-linker=hoisted` in `.npmrc`, which physically
// duplicated packages into both the project's and the root's `node_modules`.
// Removing that setting (see the root `.npmrc`) fixed the duplication at
// the source; those overrides would now do the opposite of what's needed,
// since project-local symlinks are the ONLY place a package's own
// dependencies resolve from in this mode.
//
// `.npmrc`'s `virtual-store-dir` points pnpm's real (symlinked-to) package
// store outside the repo entirely (`C:/ps`, kept short to dodge Windows'
// 260-char path limit — hit not just by the app's own native build but by
// EVERY native module's own `.cxx` dir under node_modules, e.g.
// react-native-worklets, expo-modules-core; a `subst` drive letter was
// tried instead and rejected — CMake/Java resolve subst drives back to
// their real underlying path, so it doesn't shorten anything actually
// used by the build). Metro computes module paths relative to its watched
// folders, so that real location has to be watched too, or resolving the
// bundle's own entry point (a symlink into that store) breaks.
//
// El store real de pnpm (ver `virtual-store-dir` más arriba). Metro tiene que
// vigilarlo Y poder direccionarlo por URL, de ahí las dos constantes de abajo.
const pnpmStore = 'C:/ps';

config.watchFolders = [workspaceRoot, pnpmStore];

// Sin esto, el dev server devuelve 404 al pedir el bundle: Expo genera el
// nombre del módulo de entrada relativo al serverRoot —que por defecto es el
// workspace root— y al tener que escapar de ese árbol para llegar al store,
// pierde los `..` iniciales. `../../../ps/expo-router@…/entry` se queda en
// `./ps/expo-router@…/entry`, que no existe, y Metro no resuelve la entrada.
// Bastó con que el serverRoot contenga a la vez el proyecto y el store: la
// ruta deja de tener que salirse y ya no hay `..` que perder. El flujo release
// (`export:embed`) nunca se vio afectado porque usa otro serializer.
//
// La raíz común de `C:/Repos/…` y `C:/ps` es la del volumen. Mover el store a
// algo más profundo permitiría estrecharla, pero la ruta más larga bajo él ya
// mide 357 caracteres: alargarla es pedir que vuelvan los fallos de build
// nativo que motivaron sacarlo del repo.
//
// OJO: el serverRoot delimita lo que el dev server puede direccionar, y Metro
// escucha en 0.0.0.0. En una red que no controles, arranca con
// `expo start --host localhost` (+ `adb reverse tcp:8081 tcp:8081` para un
// dispositivo físico; el emulador llega solo por 10.0.2.2).
config.server = { ...config.server, unstable_serverRoot: path.parse(pnpmStore).root };

module.exports = withNativeWind(config, { input: './src/styles/global.css' });
