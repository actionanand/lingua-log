import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPackage = 'com.actionanand.lingualog.app';
const javaDir = join('android', 'app', 'src', 'main', 'java', ...appPackage.split('.'));
const mainActivityPath = join(javaDir, 'MainActivity.java');
const manifestPath = join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
const valuesDir = join('android', 'app', 'src', 'main', 'res', 'values');
const colorsPath = join(valuesDir, 'colors.xml');
const stylesPath = join(valuesDir, 'styles.xml');
const lightShellColor = '#F3F7F4';
const darkShellColor = '#0F1713';

mkdirSync(javaDir, { recursive: true });
mkdirSync(valuesDir, { recursive: true });

writeFileSync(
  mainActivityPath,
  `package ${appPackage};

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final int APP_LIGHT_COLOR = Color.rgb(243, 247, 244);
  private static final int APP_DARK_COLOR = Color.rgb(15, 23, 19);

  @Override
  public void onCreate(Bundle savedInstanceState) {
    requestWindowFeature(Window.FEATURE_NO_TITLE);
    applySystemBars(false);
    super.onCreate(savedInstanceState);
    hideNativeTitleBar();
    applySystemBars(false);

    if (getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().addJavascriptInterface(new ThemeBridge(), "LinguaLogAndroid");
    }
  }

  private void hideNativeTitleBar() {
    if (getSupportActionBar() != null) {
      getSupportActionBar().hide();
    }
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

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.setStatusBarContrastEnforced(false);
      window.setNavigationBarContrastEnforced(false);
    }
  }

  private class ThemeBridge {
    @JavascriptInterface
    public void setTheme(String theme) {
      runOnUiThread(() -> applySystemBars("dark".equals(theme)));
    }
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

writeFileSync(manifestPath, manifest);

let colors = readOptionalFile(colorsPath);
colors = ensureResourceColor(colors, 'lingualog_shell_light', lightShellColor);
colors = ensureResourceColor(colors, 'lingualog_shell_dark', darkShellColor);
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
  ...shellStyleItems,
  ['android:background', '@color/lingualog_shell_light'],
  ['windowSplashScreenBackground', '@color/lingualog_shell_light'],
  ['postSplashScreenTheme', '@style/AppTheme.NoActionBar'],
]);
writeFileSync(stylesPath, styles);

console.log('Android native shell polish patched for LinguaLog.');

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
