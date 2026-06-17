import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appPackage = 'com.actionanand.lingualog.app';
const javaDir = join('android', 'app', 'src', 'main', 'java', ...appPackage.split('.'));
const mainActivityPath = join(javaDir, 'MainActivity.java');
const manifestPath = join('android', 'app', 'src', 'main', 'AndroidManifest.xml');

mkdirSync(javaDir, { recursive: true });

writeFileSync(
  mainActivityPath,
  `package ${appPackage};

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      getWindow().setStatusBarColor(Color.rgb(15, 23, 19));
      getWindow().setNavigationBarColor(Color.rgb(15, 23, 19));
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
console.log('Android native shell polish patched for LinguaLog.');
