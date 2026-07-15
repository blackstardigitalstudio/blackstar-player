/**
 * Config plugin: forward Android hardware key events (TV remote / D-pad / numeric
 * keypad) to JS via RCTDeviceEventEmitter as "BlackstarRemoteKey".
 *
 * Works on plain Android boxes — no react-native-tvos fork required. The whole
 * emit path is wrapped in try/catch so it degrades gracefully (touch still works)
 * and can never break the build. Made in Italy.
 */
const { withMainActivity } = require('@expo/config-plugins');

const IMPORTS = `import android.view.KeyEvent
import android.widget.EditText
import android.view.inputmethod.InputMethodManager
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

  private fun blackstarForceKeyboard() {
    // On Android TV / boxes the IMPLICIT soft-keyboard show that React Native's
    // .focus() triggers is SUPPRESSED by the system (leanback / non-touch), so the
    // on-screen keyboard often never appears with a remote. When OK is pressed on a
    // focused text field, force the IME open — this is the reliable way to raise the
    // keyboard. Additive only: arrow/navigation handling is untouched, so this can
    // never regress the D-pad (unlike consuming keys).
    try {
      val v = currentFocus
      if (v is EditText) {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        imm.showSoftInput(v, InputMethodManager.SHOW_FORCED)
      }
    } catch (e: Throwable) {
    }
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val kc = event.keyCode
    val isArrow = kc == KeyEvent.KEYCODE_DPAD_UP ||
      kc == KeyEvent.KEYCODE_DPAD_DOWN ||
      kc == KeyEvent.KEYCODE_DPAD_LEFT ||
      kc == KeyEvent.KEYCODE_DPAD_RIGHT
    if (event.action == KeyEvent.ACTION_DOWN) {
      blackstarEmitKey(kc)
      if (kc == KeyEvent.KEYCODE_DPAD_CENTER ||
          kc == KeyEvent.KEYCODE_ENTER ||
          kc == KeyEvent.KEYCODE_NUMPAD_ENTER) {
        blackstarForceKeyboard()
      }
    }
    // Consume the DIRECTIONAL keys so ONLY the JS focus engine moves — Android's
    // native focus search (and list/webview scrolling) can no longer also react to
    // the same press, which was the cause of "devo premere 2-3 volte per muovermi".
    // We intercept at dispatchKeyEvent (the FIRST hook), so native views can't eat
    // the key before we see it. Crucially we do NOT consume OK/ENTER (the field
    // still gets its native OK), and when the on-screen keyboard is open the IME
    // window receives keys before this Activity — so text entry / cursor keys are
    // untouched. Arrows fall back to super only if not an ACTION we handle.
    if (isArrow) return true
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
