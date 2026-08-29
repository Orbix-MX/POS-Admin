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
// KNOWN LIMITATION: with the store outside workspaceRoot's tree, Metro's
// dev-server bundle serializer (live reload via `expo start` / `expo run
// :android` debug) breaks — it computes "url-server" source paths relative
// to the workspace root and mishandles the ones that have to escape it
// (drops the leading `..` segments, resolving to a bogus path). This does
// NOT affect the release flow (`export:embed`, i.e. `assembleRelease` /
// `expo run:android --variant release`), which uses a different serializer
// and is the supported way to test JS changes on this machine until that
// Metro bug is understood. See docs/build-android-release.md.
config.watchFolders = [workspaceRoot, 'C:/ps'];

module.exports = withNativeWind(config, { input: './src/styles/global.css' });
