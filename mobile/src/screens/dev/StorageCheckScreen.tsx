/**
 * Development builds only: runs the draft-store self-check and shows each
 * result, so the native store can be checked on an emulator or a device
 * (T-046). English only: this is not a citizen screen.
 */
import { useEffect, useState } from "react";
import { Text } from "react-native";

import type { LegacyMigrationResult } from "../../storage/legacy/migrate";
import { runStorageSelfCheck, type SelfCheckResult } from "../../storage/selfCheck";
import { Body, Notice, Screen, Title } from "../../ui";

const LABELS: Record<Exclude<keyof SelfCheckResult, "legacy" | "passed">, string> = {
  databaseIsPlainSqlite: "Draft database is plain SQLite (no app key)",
  captureMovedNotCopied: "Capture file moved, not copied",
  mediaMatchesCapture: "Stored photo is the captured bytes",
  lifetimeFixedAtCreation: "Lifetime is created_at + 48 h and editing keeps it",
  expiredDraftDeleted: "Expired draft and its file deleted",
  otherOwnerSeesNothing: "Another account sees none of it",
  cleanedUp: "Synthetic data removed",
};

function describeLegacy(legacy: LegacyMigrationResult): string {
  switch (legacy.status) {
    case "none":
      return "none found";
    case "unreadable":
      return "found but unreadable; left untouched";
    case "kept":
      return `kept (${legacy.reason}); retried on the next open`;
    case "migrated":
      return `moved ${legacy.drafts} draft(s), ${legacy.media} item(s); ${legacy.unreadableMedia} unreadable${
        legacy.resumed ? "; finished an earlier run" : ""
      }`;
  }
}

export function StorageCheckScreen() {
  const [result, setResult] = useState<SelfCheckResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    runStorageSelfCheck().then(setResult, (error: unknown) => setFailure(String(error)));
  }, []);

  return (
    <Screen testID="dev-storage-check">
      <Title>Draft storage self-check (development build)</Title>
      {!result && !failure ? <Body>Running…</Body> : null}
      {failure ? <Notice>{`FAIL: ${failure}`}</Notice> : null}
      {result ? (
        <>
          <Text testID="check-legacy">{`5 October encrypted store: ${describeLegacy(result.legacy)}`}</Text>
          {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((key) => (
            <Text key={key} testID={`check-${key}`}>{`${LABELS[key]}: ${result[key] ? "yes" : "NO"}`}</Text>
          ))}
          <Notice kind={result.passed ? "info" : "error"}>
            {result.passed ? "RESULT: PASS" : "RESULT: FAIL"}
          </Notice>
        </>
      ) : null}
    </Screen>
  );
}
