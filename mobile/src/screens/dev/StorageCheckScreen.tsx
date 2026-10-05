/**
 * Development builds only: runs the local-store self-check and shows each
 * result, so the native SQLCipher and media encryption can be checked on an
 * emulator or a device (DEP-08). English only: this is not a citizen screen.
 */
import { useEffect, useState } from "react";
import { Text } from "react-native";

import { LocalStorageUnavailable } from "../../storage/key";
import { runStorageSelfCheck, type SelfCheckResult } from "../../storage/selfCheck";
import { Body, Notice, Screen, Title } from "../../ui";

const LABELS: Record<Exclude<keyof SelfCheckResult, "cipherVersion" | "passed">, string> = {
  databaseHeaderEncrypted: "Database file header is not plaintext",
  mediaCiphertextOnly: "Stored photo bytes are ciphertext only",
  mediaRoundTrip: "Stored photo decrypts to the captured bytes",
  plaintextCacheRemoved: "Plaintext capture file removed",
  otherOwnerSeesNothing: "Another account sees none of it",
  cleanedUp: "Synthetic data removed",
};

export function StorageCheckScreen() {
  const [result, setResult] = useState<SelfCheckResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    runStorageSelfCheck().then(setResult, (error: unknown) =>
      setFailure(
        error instanceof LocalStorageUnavailable
          ? `Local storage unavailable: ${error.reason}`
          : String(error),
      ),
    );
  }, []);

  return (
    <Screen testID="dev-storage-check">
      <Title>Local storage self-check (development build)</Title>
      {!result && !failure ? <Body>Running…</Body> : null}
      {failure ? <Notice>{`FAIL: ${failure}`}</Notice> : null}
      {result ? (
        <>
          <Text testID="check-cipher">{`SQLCipher version: ${result.cipherVersion}`}</Text>
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
