const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * RNFB copies GoogleService-Info.plist into ios/<AppName>/, but the Crashlytics
 * upload script looks for ios/GoogleService-Info.plist. Mirror it to the ios root
 * so EAS archive builds don't fail the Crashlytics run phase.
 */
function withGoogleServicesPlistRoot(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const relative =
        cfg.ios?.googleServicesFile ||
        config.ios?.googleServicesFile ||
        './GoogleService-Info.plist';
      const src = path.resolve(cfg.modRequest.projectRoot, relative);
      const dest = path.join(cfg.modRequest.platformProjectRoot, 'GoogleService-Info.plist');
      if (!fs.existsSync(src)) {
        throw new Error(
          `GoogleService-Info.plist not found at ${src}. Set ios.googleServicesFile in app.json.`
        );
      }
      fs.copyFileSync(src, dest);
      return cfg;
    },
  ]);
}

module.exports = withGoogleServicesPlistRoot;
