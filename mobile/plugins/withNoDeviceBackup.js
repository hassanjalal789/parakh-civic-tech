/**
 * Parakh's local data never leaves the phone through Android's backup and
 * transfer services (DG-59, Hassan Jalal, 2026-10-07): drafts, pending
 * submissions, photos, videos, recordings, the session tokens and every
 * other file the app keeps.
 *
 * - `android:allowBackup="false"` (set in app.config.ts) stops Auto Backup on
 *   Android 11 and lower, and cloud backup on Android 12 and higher.
 * - On Android 12 and higher some manufacturers still allow device-to-device
 *   transfer when allowBackup is false, so the data-extraction rules exclude
 *   every storage domain from both cloud backup and device transfer.
 * - The full-backup rules do the same for Android 11 and lower.
 *
 * These replace expo-secure-store's rules, which only kept its own
 * preferences file out (configureAndroidBackup: false in app.config.ts).
 * Android 16 QPR2's transfer to iOS is not declared: it needs the app's iOS
 * team id, which Parakh does not have. See docs/testing/PHYSICAL_ANDROID_TESTING.md.
 */
const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const DOMAINS = [
  "root",
  "file",
  "database",
  "sharedpref",
  "external",
  "device_root",
  "device_file",
  "device_database",
  "device_sharedpref",
];
const EXCLUDE_ALL = DOMAINS.map((domain) => `    <exclude domain="${domain}" path="." />`).join("\n");

const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<!-- Android 12 and higher: no Parakh data in cloud backups or device-to-device transfers (DG-59). -->
<data-extraction-rules>
  <cloud-backup>
${EXCLUDE_ALL}
  </cloud-backup>
  <device-transfer>
${EXCLUDE_ALL}
  </device-transfer>
</data-extraction-rules>
`;

const FULL_BACKUP_RULES = `<?xml version="1.0" encoding="utf-8"?>
<!-- Android 11 and lower: no Parakh data in backups (DG-59). allowBackup="false" already stops them. -->
<full-backup-content>
${EXCLUDE_ALL.replace(/^ {2}/gm, "")}
</full-backup-content>
`;

const RULES = "parakh_data_extraction_rules";
const BACKUP = "parakh_backup_rules";

function withRuleFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const dir = path.join(config.modRequest.platformProjectRoot, "app", "src", "main", "res", "xml");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${RULES}.xml`), DATA_EXTRACTION_RULES);
      fs.writeFileSync(path.join(dir, `${BACKUP}.xml`), FULL_BACKUP_RULES);
      return config;
    },
  ]);
}

function withManifestRules(config) {
  return withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app.$["android:allowBackup"] = "false";
    app.$["android:dataExtractionRules"] = `@xml/${RULES}`;
    app.$["android:fullBackupContent"] = `@xml/${BACKUP}`;
    return config;
  });
}

module.exports = function withNoDeviceBackup(config) {
  return withManifestRules(withRuleFiles(config));
};
module.exports.DATA_EXTRACTION_RULES = DATA_EXTRACTION_RULES;
module.exports.FULL_BACKUP_RULES = FULL_BACKUP_RULES;
