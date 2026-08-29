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
// `.npmrc`'s `virtual-store-dir` points pnpm's real (symlinked-to) package
// store outside the repo entirely (`C:/ps`, kept short to dodge Windows'
// 260-char path limit inside native modules' own `.cxx` build dirs — see
// build.gradle). Metro computes module paths relative to its watched
// folders, so that real location has to be watched too, or resolving the
// bundle's own entry point (a symlink into that store) breaks.
config.watchFolders = [workspaceRoot, 'C:/ps'];

module.exports = withNativeWind(config, { input: './src/styles/global.css' });
