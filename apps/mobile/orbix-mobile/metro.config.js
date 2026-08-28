// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../..');

const config = getDefaultConfig(projectRoot);

// pnpm workspace: watch the repo root and resolve from both node_modules trees.
//
// Many packages exist physically in BOTH `node_modules` trees — Gradle's
// native autolinking needs the project-local copy's `android/` folder (it
// walks the filesystem directly, independent of this file), while pnpm's
// hoisted linker "truly" installs everything at the workspace root. If
// Metro's own module resolution can reach the project-local copy at all
// (hierarchical lookup walks up from each importing file's own directory,
// regardless of `nodeModulesPaths` order), it ends up bundling TWO separate
// instances of the same package — one imported via the local path, one via
// root. Any package holding module-level singleton state (a React Context,
// a native-module registration side effect) breaks the moment one import
// site reads from one instance and another site writes to the other:
//   - react-native-gesture-handler: "View config getter callback ... must
//     be a function" (native view manager registered on one instance,
//     read from the other)
//   - expo-router: "useLinkPreviewContext must be used within a
//     LinkPreviewContextProvider" (the Provider and the consumer hook
//     ended up on two different React Context instances)
// Reordering `nodeModulesPaths` and even an explicit `blockList` per
// package (both tried before this) don't fully close it — new packages
// keep turning up broken one at a time. Disabling hierarchical lookup does:
// with only the workspace root in `nodeModulesPaths`, every bare import
// resolves to exactly one physical file, everywhere, full stop. The
// bundle's own entry point (`node_modules/expo-router/entry.js`) is still
// found fine — that's a literal file path handed to Metro, not a bare
// specifier this setting affects. Gradle is untouched regardless, since it
// never reads this file.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(workspaceRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: './src/styles/global.css' });
