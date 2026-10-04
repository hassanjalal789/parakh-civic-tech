import { maskE164, normalisePkMobile } from "../src/domain/phone";

describe("Pakistani mobile numbers (mirrors the backend's normalise_pk_mobile)", () => {
  test.each([
    "03001234567",
    "0300-1234567",
    "+92 300 1234567",
    "923001234567",
    "00923001234567",
    "300 1234567",
  ])("%s normalises to +923001234567", (raw) => expect(normalisePkMobile(raw)).toBe("+923001234567"));

  test.each(["3001234567x", "+9204235761234", "042 35761234", "+44 7700 900123", "0300123456", ""])(
    "%s is rejected",
    (raw) => expect(normalisePkMobile(raw)).toBeNull(),
  );

  test("the masked form hides the middle digits", () => {
    expect(maskE164("+923001234567")).toBe("+92 300 *** 4567");
  });
});
