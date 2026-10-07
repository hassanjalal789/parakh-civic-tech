/**
 * Development builds only: runs the draft-store self-check and shows each
 * result, and offers synthetic retention-test items for testing the 48-hour
 * rules by hand on a phone (docs/testing/PHYSICAL_ANDROID_TESTING.md).
 * English only: this is not a citizen screen.
 */
import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";

import type { LegacyMigrationResult } from "../../storage/legacy/migrate";
import type { OpenReport } from "../../storage/localStore";
import {
  createTestDraft,
  createTestPendingSubmission,
  lastOpenReport,
  listTestItems,
  removeTestItems,
  type TestItem,
} from "../../storage/retentionTest";
import { runStorageSelfCheck, type SelfCheckResult } from "../../storage/selfCheck";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../../ui";

const LABELS: Record<Exclude<keyof SelfCheckResult, "legacy" | "passed">, string> = {
  databaseIsPlainSqlite: "Draft database is plain SQLite (no app key)",
  captureMovedNotCopied: "Capture file moved, not copied",
  mediaMatchesCapture: "Stored photo is the captured bytes",
  lifetimeFixedAtCreation: "Lifetime is created_at + 48 h and editing keeps it",
  expiredDraftDeleted: "Expired draft and its file deleted",
  pendingSubmissionDeletedAfter48h: "Pending submission kept 48 h from Submit, then deleted",
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

function describeItem(item: TestItem): string {
  const kind = item.kind === "draft" ? "Saved draft" : "Pending submission — not yet confirmed";
  return `${kind} · created ${item.createdAt} · deleted at ${item.deletesAt} · ${item.files} file(s)`;
}

export function StorageCheckScreen() {
  const [result, setResult] = useState<SelfCheckResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [opened, setOpened] = useState<OpenReport | null>(null);
  const [items, setItems] = useState<TestItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setItems(await listTestItems());
    setOpened(await lastOpenReport());
  }, []);

  useEffect(() => {
    runStorageSelfCheck().then(
      (checked) => {
        setResult(checked);
        void refresh();
      },
      (error: unknown) => setFailure(String(error)),
    );
  }, [refresh]);

  const act = (job: () => Promise<unknown>) => async () => {
    setBusy(true);
    try {
      await job();
      await refresh();
    } catch (error) {
      setFailure(String(error));
    } finally {
      setBusy(false);
    }
  };

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
      {opened ? (
        <Text testID="opened">{`When the store opened: deleted ${opened.expired} expired draft(s) and ${opened.unconfirmedRemoved} unconfirmed pending submission(s)`}</Text>
      ) : null}
      {items ? (
        <>
          <Title>Retention test items (synthetic)</Title>
          {items.length === 0 ? <Body>None on this phone.</Body> : null}
          {items.map((item) => (
            <Text key={item.id} testID="retention-item">
              {describeItem(item)}
            </Text>
          ))}
          <PrimaryButton label="Create a test draft" onPress={act(createTestDraft)} busy={busy} />
          <PrimaryButton
            label="Create a test pending submission"
            onPress={act(createTestPendingSubmission)}
            busy={busy}
          />
          <LinkButton label="Refresh" onPress={act(async () => undefined)} disabled={busy} />
          <LinkButton label="Remove all test items" onPress={act(removeTestItems)} disabled={busy} />
        </>
      ) : null}
    </Screen>
  );
}
