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

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    blackstarEmitKey(keyCode)
    return super.onKeyDown(keyCode, event)
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
