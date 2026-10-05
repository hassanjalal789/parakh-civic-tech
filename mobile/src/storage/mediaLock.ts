/**
 * One media job at a time (R-006). Ingestion writes an item's ciphertext
 * before its evidence row exists, and the orphan sweep removes files that
 * have no row. Running both under this lock means the sweep never sees a
 * capture half-way, so it can never remove the only copy of new evidence.
 */
let tail: Promise<void> = Promise.resolve();

export function withMediaLock<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
