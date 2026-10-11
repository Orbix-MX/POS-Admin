/**
 * Config plugin: true immersive mode on Android (status bar + nav bar both
 * hidden, swipe-to-reveal).
 *
 * `expo-status-bar`'s `hidden` prop is a known no-op under Android
 * edge-to-edge (mandatory since target SDK 35 / Android 15) — RN's own
 * `StatusBar.setHidden` still uses the pre-edge-to-edge system-UI-flags path,
 * which the OS ignores once `WindowCompat.setDecorFitsSystemWindows` is off.
 * The only thing that reliably hides it under edge-to-edge is
 * `WindowInsetsControllerCompat`, called directly from `MainActivity`.
 *
 * `expo-navigation-bar` already covers the nav bar the same way; this plugin
 * fills the missing status-bar half so both come up hidden together.
 */
const { withMainActivity } = require('@expo/config-plugins');

const IMPORTS = [
  'import android.os.Build',
  'import androidx.core.view.WindowCompat',
  'import androidx.core.view.WindowInsetsCompat',
  'import androidx.core.view.WindowInsetsControllerCompat',
];

const ON_CREATE_INJECTION = `
    WindowCompat.setDecorFitsSystemWindows(window, false)
    hideSystemBars()`;

// Android re-shows the system bars on every window-focus change (e.g. when
// the RN root view attaches, or the app returns from background) — hiding
// only in `onCreate` loses effect almost immediately, so this re-applies it
// every time focus is (re)gained.
const HELPER_METHODS = `
  private fun hideSystemBars() {
    WindowInsetsControllerCompat(window, window.decorView).let {
      it.hide(WindowInsetsCompat.Type.statusBars())
      it.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) hideSystemBars()
  }
`;

function withImmersiveMode(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    for (const line of IMPORTS) {
      if (!contents.includes(line)) {
        contents = contents.replace(/^(package .+\n)/, `$1${line}\n`);
      }
    }

    if (!contents.includes('hideSystemBars()')) {
      contents = contents.replace(
        /(super\.onCreate\(null\)\s*\n)/,
        `$1${ON_CREATE_INJECTION}\n`,
      );
      // Insert the helper methods just before the class's closing brace.
      const lastBrace = contents.lastIndexOf('}');
      contents = `${contents.slice(0, lastBrace)}${HELPER_METHODS}${contents.slice(lastBrace)}`;
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withImmersiveMode;
