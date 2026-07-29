import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPackage = 'com.actionanand.lingualog.app';
const javaDir = join('android', 'app', 'src', 'main', 'java', ...appPackage.split('.'));
const mainActivityPath = join(javaDir, 'MainActivity.java');
const manifestPath = join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
const resourcesDir = join('android', 'app', 'src', 'main', 'res');
const valuesDir = join(resourcesDir, 'values');
const colorsPath = join(valuesDir, 'colors.xml');
const stylesPath = join(valuesDir, 'styles.xml');
const gradlePath = join('android', 'app', 'build.gradle');
const lightShellColor = '#F3F7F4';
const darkShellColor = '#0F1713';

mkdirSync(javaDir, { recursive: true });
mkdirSync(valuesDir, { recursive: true });

writeFileSync(
  mainActivityPath,
  `package ${appPackage};

import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends BridgeActivity {
  private static final int APP_LIGHT_COLOR = Color.rgb(243, 247, 244);
  private static final int APP_DARK_COLOR = Color.rgb(15, 23, 19);
  private static final String BIOMETRIC_KEY_ALIAS = "lingualog_biometric_key";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    requestWindowFeature(Window.FEATURE_NO_TITLE);
    boolean systemDarkTheme = isSystemDarkTheme();
    applySystemBars(systemDarkTheme);
    super.onCreate(savedInstanceState);
    hideNativeTitleBar();
    applySystemBars(systemDarkTheme);

    if (getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().addJavascriptInterface(new ThemeBridge(), "LinguaLogAndroid");
      getBridge().getWebView().addJavascriptInterface(
        new NativeBridge(),
        "LinguaLogNative"
      );
    }
  }

  private void hideNativeTitleBar() {
    if (getSupportActionBar() != null) {
      getSupportActionBar().hide();
    }
  }

  private boolean isSystemDarkTheme() {
    int nightMode =
        getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
    return nightMode == Configuration.UI_MODE_NIGHT_YES;
  }

  private void applySystemBars(boolean darkTheme) {
    Window window = getWindow();
    int shellColor = darkTheme ? APP_DARK_COLOR : APP_LIGHT_COLOR;
    window.setBackgroundDrawable(new ColorDrawable(shellColor));
    window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

    View decorView = window.getDecorView();
    int systemUiVisibility = decorView.getSystemUiVisibility();

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      window.setStatusBarColor(shellColor);
      window.setNavigationBarColor(shellColor);
      View content = window.findViewById(android.R.id.content);

      if (content != null) {
        content.setBackgroundColor(shellColor);
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      if (darkTheme) {
        systemUiVisibility &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
      } else {
        systemUiVisibility |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      if (darkTheme) {
        systemUiVisibility &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
      } else {
        systemUiVisibility |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
      }
    }

    decorView.setSystemUiVisibility(systemUiVisibility);
    applySystemBarIconAppearance(window, darkTheme);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.setStatusBarContrastEnforced(false);
      window.setNavigationBarContrastEnforced(false);
    }
  }

  private void applySystemBarIconAppearance(Window window, boolean darkTheme) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      return;
    }

    WindowInsetsController controller = window.getInsetsController();

    if (controller == null) {
      return;
    }

    int lightBars =
        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;

    controller.setSystemBarsAppearance(darkTheme ? 0 : lightBars, lightBars);
  }

  private class ThemeBridge {
    @JavascriptInterface
    public void setTheme(String theme) {
      runOnUiThread(() -> applySystemBars("dark".equals(theme)));
    }
  }

  private class NativeBridge {
    @JavascriptInterface
    public boolean isBiometricAvailable() {
      return BiometricManager.from(MainActivity.this).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG
      ) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    @JavascriptInterface
    public void enableBiometric(String secret) {
      runOnUiThread(() -> {
        try {
          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(Cipher.ENCRYPT_MODE, createBiometricKey());
          showBiometricPrompt(
            "Enable fingerprint unlock",
            "Confirm your fingerprint for LinguaLog",
            cipher,
            () -> {
              try {
                byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8));
                getPreferences(MODE_PRIVATE).edit()
                  .putString(
                    "biometric_ciphertext",
                    Base64.encodeToString(encrypted, Base64.NO_WRAP)
                  )
                  .putString(
                    "biometric_iv",
                    Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                  )
                  .apply();
                dispatchEvent("biometric-enabled");
              } catch (Exception ignored) {
                // PIN unlock remains available when biometric setup fails.
              }
            }
          );
        } catch (Exception ignored) {
          // PIN unlock remains available when the biometric prompt cannot start.
        }
      });
    }

    @JavascriptInterface
    public void authenticateBiometric() {
      runOnUiThread(() -> {
        try {
          String encryptedValue = getPreferences(MODE_PRIVATE)
            .getString("biometric_ciphertext", "");
          String ivValue = getPreferences(MODE_PRIVATE)
            .getString("biometric_iv", "");

          if (encryptedValue.isEmpty() || ivValue.isEmpty()) {
            return;
          }

          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(
            Cipher.DECRYPT_MODE,
            loadBiometricKey(),
            new GCMParameterSpec(128, Base64.decode(ivValue, Base64.NO_WRAP))
          );
          showBiometricPrompt(
            "Unlock LinguaLog",
            "Use your fingerprint or enter your PIN",
            cipher,
            () -> {
              try {
                byte[] result = cipher.doFinal(
                  Base64.decode(encryptedValue, Base64.NO_WRAP)
                );
                if (result.length > 0) {
                  dispatchEvent("biometric-success");
                }
              } catch (Exception ignored) {
                // PIN unlock remains available when decryption fails.
              }
            }
          );
        } catch (Exception ignored) {
          // PIN unlock remains available if the Android key was invalidated.
        }
      });
    }

    @JavascriptInterface
    public void disableBiometric() {
      getPreferences(MODE_PRIVATE).edit()
        .remove("biometric_ciphertext")
        .remove("biometric_iv")
        .apply();

      try {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        keyStore.deleteEntry(BIOMETRIC_KEY_ALIAS);
      } catch (Exception ignored) {
        // Nothing else is required when the key does not exist.
      }
    }
  }

  private void showBiometricPrompt(
    String title,
    String subtitle,
    Cipher cipher,
    Runnable success
  ) {
    Executor executor = ContextCompat.getMainExecutor(this);
    BiometricPrompt prompt = new BiometricPrompt(
      this,
      executor,
      new BiometricPrompt.AuthenticationCallback() {
        @Override
        public void onAuthenticationSucceeded(
          BiometricPrompt.AuthenticationResult result
        ) {
          super.onAuthenticationSucceeded(result);
          success.run();
        }
      }
    );
    BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
      .setTitle(title)
      .setSubtitle(subtitle)
      .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
      .setNegativeButtonText("Use PIN")
      .build();

    prompt.authenticate(promptInfo, new BiometricPrompt.CryptoObject(cipher));
  }

  private SecretKey createBiometricKey() throws Exception {
    KeyGenerator generator = KeyGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_AES,
      "AndroidKeyStore"
    );
    KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
      BIOMETRIC_KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setUserAuthenticationRequired(true)
      .setInvalidatedByBiometricEnrollment(true);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.setUserAuthenticationParameters(
        0,
        KeyProperties.AUTH_BIOMETRIC_STRONG
      );
    }

    generator.init(builder.build());
    return generator.generateKey();
  }

  private SecretKey loadBiometricKey() throws Exception {
    KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
    keyStore.load(null);
    return (SecretKey) keyStore.getKey(BIOMETRIC_KEY_ALIAS, null);
  }

  private void dispatchEvent(String eventName) {
    if (getBridge() == null || getBridge().getWebView() == null) {
      return;
    }

    getBridge().getWebView().post(() ->
      getBridge().getWebView().evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('" + eventName + "'))",
        null
      )
    );
  }
}
`,
);

let manifest = readFileSync(manifestPath, 'utf8');

if (!/android\.permission\.INTERNET/.test(manifest)) {
  manifest = manifest.replace(
    /<manifest([^>]*)>/,
    '<manifest$1>\\n    <uses-permission android:name="android.permission.INTERNET" />',
  );
}

if (!/android\.permission\.USE_BIOMETRIC/.test(manifest)) {
  manifest = manifest.replace(
    /<manifest([^>]*)>/,
    '<manifest$1>\\n    <uses-permission android:name="android.permission.USE_BIOMETRIC" />',
  );
}

manifest = manifest.replace(
  /(<activity\b(?=[^>]*android:name="\.MainActivity")[^>]*android:theme=")[^"]*(")/,
  '$1@style/AppTheme.NoActionBarLaunch$2',
);

writeFileSync(manifestPath, manifest);

let colors = readOptionalFile(colorsPath);
colors = ensureResourceColor(colors, 'lingualog_shell_light', lightShellColor);
colors = ensureResourceColor(colors, 'lingualog_shell_dark', darkShellColor);
colors = ensureResourceColor(colors, 'lingualog_splash_background', lightShellColor);
writeFileSync(colorsPath, colors);

let styles = readOptionalFile(stylesPath);
const shellStyleItems = [
  ['windowActionBar', 'false'],
  ['windowNoTitle', 'true'],
  ['android:windowActionBar', 'false'],
  ['android:windowNoTitle', 'true'],
  ['android:windowBackground', '@color/lingualog_shell_light'],
  ['android:statusBarColor', '@color/lingualog_shell_light'],
  ['android:navigationBarColor', '@color/lingualog_shell_light'],
  ['android:windowLightStatusBar', 'true'],
  ['android:windowLightNavigationBar', 'true'],
  ['android:windowOptOutEdgeToEdgeEnforcement', 'true'],
];

styles = ensureStyleItems(styles, 'AppTheme', shellStyleItems);
styles = ensureStyleItems(styles, 'AppTheme.NoActionBar', shellStyleItems);
styles = ensureStyleItems(styles, 'AppTheme.NoActionBarLaunch', [
  ['windowActionBar', 'false'],
  ['windowNoTitle', 'true'],
  ['android:windowActionBar', 'false'],
  ['android:windowNoTitle', 'true'],
  ['android:windowBackground', '@drawable/lingualog_splash_screen'],
  ['android:statusBarColor', '@color/lingualog_splash_background'],
  ['android:navigationBarColor', '@color/lingualog_splash_background'],
  ['android:windowLightStatusBar', 'true'],
  ['android:windowLightNavigationBar', 'true'],
]);
writeFileSync(stylesPath, styles);

const nightValuesDir = join(resourcesDir, 'values-night');
mkdirSync(nightValuesDir, { recursive: true });
writeFileSync(
  join(nightValuesDir, 'colors.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="lingualog_shell_light">${darkShellColor}</color>
    <color name="lingualog_shell_dark">${darkShellColor}</color>
    <color name="lingualog_splash_background">${darkShellColor}</color>
</resources>
`,
);

let nightStyles = styles
  .replaceAll('@color/lingualog_shell_light', '@color/lingualog_shell_dark')
  .replaceAll(
    '<item name="android:windowLightStatusBar">true</item>',
    '<item name="android:windowLightStatusBar">false</item>',
  )
  .replaceAll(
    '<item name="android:windowLightNavigationBar">true</item>',
    '<item name="android:windowLightNavigationBar">false</item>',
  );
writeFileSync(join(nightValuesDir, 'styles.xml'), nightStyles);

const drawableDir = join(resourcesDir, 'drawable');
const drawableNoDpiDir = join(resourcesDir, 'drawable-nodpi');
mkdirSync(drawableDir, { recursive: true });
mkdirSync(drawableNoDpiDir, { recursive: true });
writeFileSync(
  join(drawableDir, 'lingualog_splash_icon.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/lingualog_splash_logo"
    android:inset="24%" />
`,
);
writeFileSync(
  join(drawableDir, 'lingualog_splash_screen.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/lingualog_splash_background" />
    <item android:gravity="center">
        <inset
            android:drawable="@drawable/lingualog_splash_icon"
            android:inset="30%" />
    </item>
</layer-list>
`,
);
copyFileSync('public/lingua-log.png', join(drawableNoDpiDir, 'lingualog_splash_logo.png'));

let android12Styles = ensureStyleParent(styles, 'AppTheme.NoActionBarLaunch', 'Theme.SplashScreen');
android12Styles = ensureStyleItems(android12Styles, 'AppTheme.NoActionBarLaunch', [
  ['windowSplashScreenBackground', '@color/lingualog_splash_background'],
  ['windowSplashScreenAnimatedIcon', '@drawable/lingualog_splash_icon'],
  ['windowSplashScreenIconBackgroundColor', '@android:color/transparent'],
  ['postSplashScreenTheme', '@style/AppTheme.NoActionBar'],
  ['android:statusBarColor', '@color/lingualog_splash_background'],
  ['android:navigationBarColor', '@color/lingualog_splash_background'],
]);

const valuesV31Dir = join(resourcesDir, 'values-v31');
const nightValuesV31Dir = join(resourcesDir, 'values-night-v31');
mkdirSync(valuesV31Dir, { recursive: true });
mkdirSync(nightValuesV31Dir, { recursive: true });
writeFileSync(join(valuesV31Dir, 'styles.xml'), android12Styles);
writeFileSync(
  join(nightValuesV31Dir, 'styles.xml'),
  android12Styles
    .replaceAll('@color/lingualog_shell_light', '@color/lingualog_shell_dark')
    .replaceAll(
      '<item name="android:windowLightStatusBar">true</item>',
      '<item name="android:windowLightStatusBar">false</item>',
    )
    .replaceAll(
      '<item name="android:windowLightNavigationBar">true</item>',
      '<item name="android:windowLightNavigationBar">false</item>',
    ),
);

let gradle = readFileSync(gradlePath, 'utf8');
if (!gradle.includes('androidx.biometric:biometric')) {
  gradle = gradle.replace(
    /dependencies\s*\{/,
    "dependencies {\n    implementation 'androidx.biometric:biometric:1.1.0'",
  );
  writeFileSync(gradlePath, gradle);
}

console.log('Android splash, system bars, and biometric unlock patched for LinguaLog.');

function readOptionalFile(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '<resources>\n</resources>\n';
  }
}

function ensureResourceColor(source, name, value) {
  const colorPattern = new RegExp(`<color\\s+name="${name}">[^<]*</color>`);
  const colorNode = `<color name="${name}">${value}</color>`;

  if (colorPattern.test(source)) {
    return source.replace(colorPattern, colorNode);
  }

  return source.replace('</resources>', `    ${colorNode}\n</resources>`);
}

function ensureStyleItems(source, styleName, items) {
  if (!new RegExp(`<style\\s+name="${styleName}"`).test(source)) {
    source = source.replace(
      '</resources>',
      `    <style name="${styleName}">\n    </style>\n</resources>`,
    );
  }

  return items.reduce(
    (updatedSource, [itemName, itemValue]) =>
      ensureStyleItem(updatedSource, styleName, itemName, itemValue),
    source,
  );
}

function ensureStyleParent(source, styleName, parentName) {
  const stylePattern = new RegExp(`(<style\\s+name="${styleName}")([^>]*)(>)`);

  return source.replace(stylePattern, (_match, namePart, attributes, closeTag) => {
    const nextAttributes = /\sparent="[^"]*"/.test(attributes)
      ? attributes.replace(/\sparent="[^"]*"/, ` parent="${parentName}"`)
      : `${attributes} parent="${parentName}"`;

    return `${namePart}${nextAttributes}${closeTag}`;
  });
}

function ensureStyleItem(source, styleName, itemName, itemValue) {
  const stylePattern = new RegExp(`(<style\\s+name="${styleName}"[^>]*>)([\\s\\S]*?)(</style>)`);

  return source.replace(stylePattern, (_match, openTag, styleBody, closeTag) => {
    const itemPattern = new RegExp(`\\s*<item\\s+name="${escapeRegExp(itemName)}">[^<]*</item>`);
    const itemNode = `        <item name="${itemName}">${itemValue}</item>`;
    const nextBody = itemPattern.test(styleBody)
      ? styleBody.replace(itemPattern, `\n${itemNode}`)
      : `${styleBody.trimEnd()}\n${itemNode}\n    `;

    return `${openTag}${nextBody}${closeTag}`;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
