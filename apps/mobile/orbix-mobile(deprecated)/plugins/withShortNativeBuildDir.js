const { withProjectBuildGradle } = require('expo/config-plugins');

// En Windows el build nativo choca contra MAX_PATH (260). Ninja crea sus
// objetos bajo el `.cxx` del modulo, y para cada fuente que vive fuera del
// source dir de CMake replica la ruta absoluta completa dentro de
// `CMakeFiles/<target>.dir/`. Con el store de pnpm dentro del repo eso da:
//
//   cwd de ninja  .../node_modules/.pnpm/expo-mo_<hash>/node_modules/
//                 expo-modules-core/android/.cxx/Debug/<hash>/<abi>   155 chars
//   + objeto      CMakeFiles/fabric.dir/C_/Repos/.../ExpoView...cpp.o 191 chars
//   = 347, y ninja falla con "mkdir(...): No such file or directory".
//
// La mitad replicada no se puede acortar (es la ruta de la fuente), asi que
// este plugin ataca la otra: mueve el `.cxx` de cada modulo nativo a una raiz
// corta fuera del arbol. `C:/cxx/<hash>/.cxx/Debug/<hash>/<abi>` mide ~43, lo
// que deja el total holgadamente por debajo del limite.
//
// Alternativas descartadas: `subst` (CMake y Java resuelven la unidad virtual
// de vuelta a su ruta real, no acorta nada que el build use de verdad) y
// `virtual-store-dir=C:/ps` en el `.npmrc` global (funciona, pero es config
// por maquina que no viaja en el repo y rompe en Mac/Linux si alguien la
// copia). Este plugin, en cambio, se aplica solo en cada `expo prebuild` —que
// es lo unico que hay, porque `android/` esta en el .gitignore— y es no-op
// fuera de Windows.
//
// Esto resuelve la mitad del problema. La otra mitad son las fuentes que el
// codegen de RN escribe DENTRO del store, en `<modulo>/android/build/generated/
// source/codegen/jni/...` (p.ej. RNGoogleSignInCGenJSI-generated.cpp, 265
// chars). Esa ruta no se puede mover desde aqui: `ReactNative-application.cmake`
// la compone a mano a partir del directorio del modulo, asi que redirigir el
// `buildDirectory` de Gradle solo consigue que CMake no encuentre el codegen
// ("Cannot specify link libraries for target react_codegen_... which is not
// built by this project"). Se acorta por el otro lado, con
// `virtual-store-dir-max-length` en el `.npmrc` de la raiz del repo.
//
// La raiz se puede cambiar con la variable de entorno ORBIX_NATIVE_BUILD_DIR.

const START = '// >>> orbix:short-native-build-dir';
const END = '// <<< orbix:short-native-build-dir';

const DEFAULT_ROOT = 'C:/cxx';

function buildSnippet(root) {
  return [
    START,
    "if (System.getProperty('os.name').toLowerCase().contains('windows')) {",
    `  def orbixNativeRoot = System.getenv('ORBIX_NATIVE_BUILD_DIR') ?: '${root}'`,
    '  subprojects { sp ->',
    '    // Un directorio por modulo, nombrado con un hash en vez de con el',
    '    // nombre: `react-native-reanimated` gastaria 23 de los ~56 chars de',
    '    // presupuesto, su hash gasta 8. El hash incluye la ruta de la app',
    '    // porque varias apps del monorepo comparten esta raiz y sus modulos',
    '    // nativos se llaman igual (expo-modules-core en las dos): sin eso se',
    '    // pisarian el `.cxx` entre ellas.',
    '    def orbixKey = {',
    '      def raw = rootProject.projectDir.absolutePath + File.pathSeparator + sp.name',
    '      Integer.toHexString(raw.hashCode())',
    '    }',
    '    def orbixStaging = { new File(orbixNativeRoot, orbixKey()) }',
    "    sp.plugins.withId('com.android.library') {",
    '      sp.android.externalNativeBuild.cmake.buildStagingDirectory = orbixStaging()',
    '    }',
    "    sp.plugins.withId('com.android.application') {",
    '      sp.android.externalNativeBuild.cmake.buildStagingDirectory = orbixStaging()',
    '    }',
    '  }',
    '}',
    END,
  ].join('\n');
}

const withShortNativeBuildDir = (config, { root = DEFAULT_ROOT } = {}) =>
  withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        'withShortNativeBuildDir: se esperaba un build.gradle en Groovy, ' +
          `pero es ${cfg.modResults.language}.`
      );
    }

    const snippet = buildSnippet(root);
    const { contents } = cfg.modResults;
    const start = contents.indexOf(START);

    if (start === -1) {
      // Tiene que ir ANTES de `apply plugin: "com.facebook.react.rootproject"`:
      // ese plugin configura los subproyectos, y para cuando termina AGP ya
      // leyo `buildStagingDirectory` ("It is too late to set
      // buildStagingDirectory"). `subprojects {}` sigue siendo lazy, asi que
      // adelantarlo no cambia nada mas.
      const anchor = contents.search(/^apply plugin:/m);
      cfg.modResults.contents =
        anchor === -1
          ? `${contents.trimEnd()}\n\n${snippet}\n`
          : `${contents.slice(0, anchor)}${snippet}\n\n${contents.slice(anchor)}`;
      return cfg;
    }

    // Ya inyectado por un prebuild anterior: se reemplaza en vez de duplicar.
    const end = contents.indexOf(END, start);
    cfg.modResults.contents =
      contents.slice(0, start) + snippet + contents.slice(end + END.length);
    return cfg;
  });

module.exports = withShortNativeBuildDir;
