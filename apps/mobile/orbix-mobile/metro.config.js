// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const fs = require('node:fs');
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
// Dónde vive REALMENTE el store de pnpm. Normalmente es
// `<workspaceRoot>/node_modules/.pnpm`, pero un `.npmrc` global con
// `virtual-store-dir` puede sacarlo del árbol del repo (en Windows se usó para
// esquivar el límite de 260 chars). No se hardcodea: se deduce del realpath de
// cualquier dependencia instalada, que siempre es
// `<store>/<pkg>@<hash>/node_modules/<pkg>`. Así funciona igual en Windows,
// macOS y Linux, y no hay que tocar este archivo si alguien mueve su store.
function resolvePnpmStore() {
  try {
    const real = fs.realpathSync(require.resolve('expo/package.json'));
    // <store>/<pkg>@<hash>/node_modules/<pkg>/package.json → <store>
    const store = path.resolve(real, '../../../..');
    return path.basename(store) === '.pnpm' || !isInside(workspaceRoot, store) ? store : null;
  } catch {
    return null; // linker no-pnpm (npm/yarn planos): `workspaceRoot` ya lo cubre
  }
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

const pnpmStore = resolvePnpmStore();

// Metro sigue los symlinks hasta su ruta real, así que el store tiene que estar
// vigilado o no resuelve ni su propio entry point. Si cae dentro de
// `workspaceRoot` ya está cubierto y añadirlo solo duplicaría el escaneo.
const externalStore = pnpmStore && !isInside(workspaceRoot, pnpmStore) ? pnpmStore : null;

config.watchFolders = externalStore ? [workspaceRoot, externalStore] : [workspaceRoot];

// Solo hace falta con el store fuera del árbol. Sin esto el dev server devuelve
// 404 al pedir el bundle: Expo genera el nombre del módulo de entrada relativo
// al serverRoot —por defecto el workspace root— y al tener que escapar de ese
// árbol para llegar al store pierde los `..` iniciales.
// `../../../ps/expo-router@…/entry` se queda en `./ps/expo-router@…/entry`, que
// no existe, y Metro no resuelve la entrada. Basta con que el serverRoot
// contenga a la vez el proyecto y el store: la ruta deja de tener que salirse.
// El flujo release (`export:embed`) nunca se vio afectado porque usa otro
// serializer.
//
// Se usa el ancestro común REAL de ambos, no la raíz del volumen: el serverRoot
// delimita lo que el dev server puede direccionar por URL y Metro escucha en
// 0.0.0.0, así que cuanto más estrecho, mejor. En una red que no controles,
// arranca además con `expo start --host localhost` (+
// `adb reverse tcp:8081 tcp:8081` para un dispositivo físico; el emulador llega
// solo por 10.0.2.2).
//
// Con el store dentro del repo no hay nada de lo que escapar y se deja el
// serverRoot por defecto.
if (externalStore) {
  config.server = {
    ...config.server,
    unstable_serverRoot: commonAncestor(workspaceRoot, externalStore),
  };
}

function commonAncestor(a, b) {
  const segsA = path.resolve(a).split(path.sep);
  const segsB = path.resolve(b).split(path.sep);
  const shared = [];
  for (let i = 0; i < Math.min(segsA.length, segsB.length); i += 1) {
    if (segsA[i].toLowerCase() !== segsB[i].toLowerCase()) break;
    shared.push(segsA[i]);
  }
  return shared.join(path.sep) + path.sep;
}

module.exports = withNativeWind(config, { input: './src/styles/global.css' });
