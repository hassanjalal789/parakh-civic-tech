/**
 * After a report is sent or queued, Back must not lead into its reporting steps (FR-PUB.29, DG-84).
 * Found on the phone, 2026-10-13: Back from Waiting to send reached the category screen.
 */
import { finishReporting, goHome } from "../src/navigation/reporting";

function recorder() {
  const calls: string[] = [];
  return {
    calls,
    nav: {
      dismissAll: () => calls.push("dismissAll"),
      push: (href: unknown) => calls.push(`push ${JSON.stringify(href)}`),
      replace: (href: unknown) => calls.push(`replace ${JSON.stringify(href)}`),
    },
  };
}

describe("leaving the reporting steps", () => {
  test("Waiting to send and Received open on top of Home only after the report's own screens are removed", () => {
    const { calls, nav } = recorder();
    finishReporting(nav, { pathname: "/queued", params: { draft: "d1" } });
    expect(calls).toEqual(["dismissAll", 'push {"pathname":"/queued","params":{"draft":"d1"}}']);
  });

  test("going Home clears the stack first, so Back never returns to a finished report's steps", () => {
    const { calls, nav } = recorder();
    goHome(nav);
    expect(calls).toEqual(["dismissAll", 'replace "/home"']);
  });
});
