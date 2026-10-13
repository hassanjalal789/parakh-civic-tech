/**
 * Leaving the reporting steps for good (FR-PUB.29; DG-84).
 *
 * The screens of one report (category, photos, description, location, review) stay stacked until they are
 * removed. If Waiting to send or Received were pushed on top of them, Android's Back button would walk
 * back through those steps (found on the phone, 2026-10-13) and look like a way to change a report that
 * has already been sent. So these helpers clear the stack first: Back from Waiting to send or from
 * Received goes Home, never into the reporting steps.
 */
import type { Href } from "expo-router";

export type Navigator = {
  dismissAll(): void;
  push(href: Href): void;
  replace(href: Href): void;
};

/** Opens Waiting to send or Received on top of Home, with the report's steps removed beneath it. */
export function finishReporting(nav: Navigator, to: Href): void {
  nav.dismissAll();
  nav.push(to);
}

/** Home, with nothing of a finished report left to go back to. */
export function goHome(nav: Navigator): void {
  nav.dismissAll();
  nav.replace("/home");
}
