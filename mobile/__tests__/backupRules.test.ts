/**
 * DG-59 (Hassan Jalal, 2026-10-07): no Parakh data in Android backups or
 * device-to-device transfers. The rules the config plugin writes, and the
 * manifest attributes it sets, checked as text; the built APK is checked on
 * the emulator (docs/testing/PHYSICAL_ANDROID_TESTING.md, §7.7).
 */
import { readFileSync } from "fs";
import { join } from "path";

const plugin = jest.requireActual<{ DATA_EXTRACTION_RULES: string; FULL_BACKUP_RULES: string }>(
  "../plugins/withNoDeviceBackup",
);

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

function section(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!match?.[1]) throw new Error(`no <${tag}> section`);
  return match[1];
}

function excluded(xml: string): string[] {
  return [...xml.matchAll(/<exclude domain="([a-z_]+)" path="\." \/>/g)].map((m) => m[1] as string);
}

test("cloud backup and device transfer each exclude every storage domain, and include nothing", () => {
  for (const tag of ["cloud-backup", "device-transfer"]) {
    const rules = section(plugin.DATA_EXTRACTION_RULES, tag);
    expect(excluded(rules)).toEqual(DOMAINS);
    expect(rules).not.toMatch(/<include/);
  }
  expect(plugin.DATA_EXTRACTION_RULES).toMatch(/^<\?xml version="1\.0" encoding="utf-8"\?>/);
});

test("the rules for Android 11 and lower exclude every domain too", () => {
  const rules = section(plugin.FULL_BACKUP_RULES, "full-backup-content");
  expect(excluded(rules)).toEqual(DOMAINS);
  expect(rules).not.toMatch(/<include/);
});

test("the app config uses these rules, turns allowBackup off, and stops expo-secure-store's own", () => {
  const config = readFileSync(join(__dirname, "..", "app.config.ts"), "utf8");
  expect(config).toMatch(/allowBackup: false/);
  expect(config).toMatch(/"\.\/plugins\/withNoDeviceBackup"/);
  expect(config).toMatch(/\["expo-secure-store", \{ configureAndroidBackup: false \}\]/);
});
