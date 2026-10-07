const { withFinalizedMod } = require('expo/config-plugins');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');

// Android displays the central 72 dp of a 108 dp adaptive layer.
// Inset 18/108 on each side so the square artwork spans the circular mask's diameter.
module.exports = (config) => withFinalizedMod(config, ['android', async (config) => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackground"/>
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground"
            android:insetLeft="16.666667%" android:insetTop="16.666667%"
            android:insetRight="16.666667%" android:insetBottom="16.666667%"/>
    </foreground>
</adaptive-icon>
`;
  const resources = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/mipmap-anydpi-v26');
  await Promise.all(['ic_launcher.xml', 'ic_launcher_round.xml'].map((name) =>
    writeFile(path.join(resources, name), xml),
  ));
  return config;
}]);
