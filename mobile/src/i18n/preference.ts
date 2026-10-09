/**
 * FR-AUTH.1: the interface language chosen on CIT-01 applies to every later
 * screen — also after the app restarts (finding F-1, phone test of 2026-10-09).
 *
 * Kept in a small app-private file. It is a display setting, not a secret, so
 * it stays out of the token store (LDS-1); like all app data it is excluded
 * from backups (DG-59). Reading or writing never throws: without a stored
 * choice the app falls back to the device language, as before.
 */
import { File, Paths } from "expo-file-system";

import type { Language } from "./index";

const FILE_NAME = "parakh-interface-language";

function preferenceFile(): File {
  return new File(Paths.document, FILE_NAME);
}

export function readLanguagePreference(): Language | null {
  try {
    const file = preferenceFile();
    if (!file.exists) return null;
    const value = file.textSync().trim();
    return value === "ur" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

export function saveLanguagePreference(language: Language): void {
  try {
    const file = preferenceFile();
    if (!file.exists) file.create();
    file.write(language);
  } catch {
    // The choice still applies to this session; only the next start falls back.
  }
}
