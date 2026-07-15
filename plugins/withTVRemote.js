/**
 * Config plugin: forward Android hardware key events (TV remote / D-pad / numeric
 * keypad) to JS via RCTDeviceEventEmitter as "BlackstarRemoteKey".
 *
 * Works on plain Android boxes — no react-native-tvos fork required. The whole
 * emit path is wrapped in try/catch so it degrades gracefully (touch still works)
 * and can never break the build.
 *
 * APPROACH (v1.0.28): dispatchKeyEvent with a TEXT-FIELD gate.
 *  - Browsing (no EditText focused): emit the arrow to the JS engine AND consume it
 *    (return true) so ONLY the JS ring moves → the selection is one clear element
 *    (no native/JS double-focus, no "non si vede quale si seleziona").
 *  - Editing (an EditText holds native focus): do NOT emit arrows to the engine and
 *    do NOT consume them → the native Android focus + on-screen keyboard (IME)
 *    handle the fields, which is the only thing that works for text input on a box.
 * OK/back/media/digits are always emitted and never consumed. Made in Italy.
 */
const { withMainActivity } = require('@expo/config-plugins');

const IMPORTS = `import android.view.KeyEvent
import android.widget.EditText
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule`;

const METHODS = `
  private fun blackstarReactContext(): ReactContext? {
    return try {
      val app = application as ReactApplication
      val host = app.reactHost
      val ctx = host?.currentReactContext
      if (ctx != null) ctx else app.reactNativeHost.reactInstanceManager.currentReactContext
    } catch (e: Throwable) {
      null
    }
  }

  private fun blackstarEmitKey(keyCode: Int) {
    try {
      val ctx = blackstarReactContext() ?: return
      val params = Arguments.createMap()
      params.putInt("keyCode", keyCode)
      ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("BlackstarRemoteKey", params)
    } catch (e: Throwable) {
    }
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val kc = event.keyCode
    val isArrow = kc == KeyEvent.KEYCODE_DPAD_UP ||
      kc == KeyEvent.KEYCODE_DPAD_DOWN ||
      kc == KeyEvent.KEYCODE_DPAD_LEFT ||
      kc == KeyEvent.KEYCODE_DPAD_RIGHT
    // "editing" = a real text field currently holds native focus (onboarding /
    // search). Only then do we hand D-pad + keyboard to the NATIVE Android focus
    // system; everywhere else the JS focus engine is the single source of truth.
    val editing = currentFocus is EditText
    if (event.action == KeyEvent.ACTION_DOWN) {
      // While editing, do NOT feed arrows to the JS engine — otherwise BOTH the
      // engine and the native EditText focus move and desync. Feed everything else.
      if (!(editing && isArrow)) {
        blackstarEmitKey(kc)
      }
    }
    // Consume the arrows ONLY while browsing (not editing): then only the JS ring
    // moves, so the selection is always ONE, clearly visible element (fixes "non si
    // vede quale si seleziona"). While editing, let the arrows fall through to the
    // native focus + IME so the on-screen keyboard and field navigation work.
    if (isArrow && !editing) {
      return true
    }
    return super.dispatchKeyEvent(event)
  }
`;

module.exports = function withTVRemote(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg;
    let src = cfg.modResults.contents;

    // Avoid double-injection on repeated prebuilds.
    if (src.includes('blackstarEmitKey')) return cfg;

    // Add imports right after the package declaration.
    src = src.replace(/(^package .+$)/m, `$1\n\n${IMPORTS}`);

    // Insert the methods before the final closing brace of the class/file.
    const lastBrace = src.lastIndexOf('}');
    if (lastBrace !== -1) {
      src = src.slice(0, lastBrace) + METHODS + '\n' + src.slice(lastBrace);
    }

    cfg.modResults.contents = src;
    return cfg;
  });
};
