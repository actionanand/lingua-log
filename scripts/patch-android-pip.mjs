import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPackage = 'com.actionanand.lingualog.app';
const javaDir = join('android', 'app', 'src', 'main', 'java', ...appPackage.split('.'));
const mainActivityPath = join(javaDir, 'MainActivity.java');
const manifestPath = join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
const valuesDir = join('android', 'app', 'src', 'main', 'res', 'values');
const colorsPath = join(valuesDir, 'colors.xml');
const stylesPath = join(valuesDir, 'styles.xml');
const systemBarColor = '#0F1713';

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

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final int APP_DARK_COLOR = Color.rgb(15, 23, 19);

  @Override
  public void onCreate(Bundle savedInstanceState) {
    paintSystemBars();
    super.onCreate(savedInstanceState);
    paintSystemBars();
  }

  private void paintSystemBars() {
    Window window = getWindow();
    window.setBackgroundDrawable(new ColorDrawable(APP_DARK_COLOR));

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      window.getDecorView().setSystemUiVisibility(0);
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      window.setStatusBarColor(APP_DARK_COLOR);
      window.setNavigationBarColor(APP_DARK_COLOR);
      View content = window.findViewById(android.R.id.content);

      if (content != null) {
        content.setBackgroundColor(APP_DARK_COLOR);
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.setStatusBarContrastEnforced(false);
      window.setNavigationBarContrastEnforced(false);
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
colors = ensureResourceColor(colors, 'lingualog_system_bar', systemBarColor);
writeFileSync(colorsPath, colors);

let styles = readOptionalFile(stylesPath);
styles = ensureStyleItems(styles, 'AppTheme', [
  ['android:windowBackground', '@color/lingualog_system_bar'],
  ['android:statusBarColor', '@color/lingualog_system_bar'],
  ['android:navigationBarColor', '@color/lingualog_system_bar'],
  ['android:windowLightStatusBar', 'false'],
  ['android:windowLightNavigationBar', 'false'],
  ['android:windowOptOutEdgeToEdgeEnforcement', 'true'],
]);
styles = ensureStyleItems(styles, 'AppTheme.NoActionBar', [
  ['android:windowBackground', '@color/lingualog_system_bar'],
  ['android:statusBarColor', '@color/lingualog_system_bar'],
  ['android:navigationBarColor', '@color/lingualog_system_bar'],
  ['android:windowLightStatusBar', 'false'],
  ['android:windowLightNavigationBar', 'false'],
  ['android:windowOptOutEdgeToEdgeEnforcement', 'true'],
]);
styles = ensureStyleItems(styles, 'AppTheme.NoActionBarLaunch', [
  ['android:windowBackground', '@color/lingualog_system_bar'],
  ['android:statusBarColor', '@color/lingualog_system_bar'],
  ['android:navigationBarColor', '@color/lingualog_system_bar'],
  ['android:windowLightStatusBar', 'false'],
  ['android:windowLightNavigationBar', 'false'],
  ['android:windowOptOutEdgeToEdgeEnforcement', 'true'],
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
