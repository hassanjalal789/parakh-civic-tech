/**
 * Removing drafts and their media from the phone.
 *
 * The 2-day lifetime (DG-64): an unsubmitted draft is invisible from the
 * instant `expires_at` passes (drafts.ts), and its rows and files are deleted
 * here — whenever the store opens, the app returns to the foreground, or the
 * submission queue runs. The app cannot delete anything while it is not
 * running, so a phone on which Parakh is never opened keeps the files, still
 * app-private, until it next is. Each deleted draft leaves a content-free note
 * asking the server to cancel any temporary uploads it holds (DG-55, DG-57).
 *
 * Rows go first and files second, so an interruption leaves at most an orphan
 * file, which the sweep removes. All of it runs under the media lock (R-006).
 */
import {
  deleteExpiredDrafts,
  type DraftRepository,
  queueServerCancellation,
  referencedFileNames,
} from "./drafts";
import { deleteDraftMedia, draftMediaDirectory, draftMediaFile } from "./media";
import { withMediaLock } from "./mediaLock";
import type { SqlDb } from "./sql";

/** Deletes every account's unsubmitted drafts whose lifetime has ended. Returns how many. */
export function purgeExpiredDrafts(db: SqlDb, now: Date): Promise<number> {
  return withMediaLock(async () => {
    const deleted = await deleteExpiredDrafts(db, now);
    for (const draft of deleted) {
      for (const name of draft.fileNames) deleteDraftMedia(name);
      await queueServerCancellation(db, draft.clientSubmissionId, draft.ownerAccountId, now);
    }
    return deleted.length;
  });
}

/** Deletes one draft of the repository's account, rows then files. */
export function discardDraft(drafts: DraftRepository, clientSubmissionId: string): Promise<void> {
  return withMediaLock(async () => {
    for (const item of await drafts.remove(clientSubmissionId)) deleteDraftMedia(item.file_name);
  });
}

/** Removes media files that no row of any account refers to, e.g. after an interrupted deletion. */
export function removeOrphanMedia(db: SqlDb): Promise<number> {
  return withMediaLock(async () => {
    const dir = draftMediaDirectory();
    if (!dir.exists) return 0;
    const known = await referencedFileNames(db);
    let removed = 0;
    for (const entry of dir.list()) {
      if (known.has(entry.name)) continue;
      let file;
      try {
        file = draftMediaFile(entry.name);
      } catch {
        continue; // not a name this app writes: never touched
      }
      if (file.exists) {
        file.delete();
        removed++;
      }
    }
    return removed;
  });
}
