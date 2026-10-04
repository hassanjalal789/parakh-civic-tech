import { useOnboarding } from "../src/auth/onboarding";

const store = () => useOnboarding.getState();

beforeEach(() => store().reset());

describe("pre-authentication consent held on the device", () => {
  test("cannot be confirmed without both required consents", () => {
    store().setSelection("account_creation_and_processing", true);
    store().setSelection("sms_notification", true);
    expect(() => store().confirmConsent()).toThrow();
    expect(store().pendingConsent).toBeNull();
  });

  test("re-confirming unchanged choices reuses the same ref; a changed choice makes a new one", () => {
    store().setLanguage("ur");
    store().setSelection("account_creation_and_processing", true);
    store().setSelection("voice_processing", true);
    const first = store().confirmConsent();
    expect(store().confirmConsent().ref).toBe(first.ref);
    store().setSelection("sms_notification", true);
    const changed = store().confirmConsent();
    expect(changed.ref).not.toBe(first.ref);
    expect(changed.selections.sms_notification).toBe(true);
    expect(changed.version).toBe("citizen-consent-draft-1");
  });

  test("reset discards the payload (abandoned onboarding leaves nothing behind)", () => {
    store().setSelection("account_creation_and_processing", true);
    store().setSelection("voice_processing", true);
    store().confirmConsent();
    store().setNumber("+923001234567", 60);
    store().reset();
    expect(store().pendingConsent).toBeNull();
    expect(store().e164).toBeNull();
    expect(store().selections).toEqual({
      account_creation_and_processing: false,
      voice_processing: false,
      sms_notification: false,
    });
  });
});
