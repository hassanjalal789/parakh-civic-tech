import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useOnboarding } from "../src/auth/onboarding";
import { usePrincipal } from "../src/auth/principal";
import i18n, { setLanguage } from "../src/i18n";
import { ConsentScreen } from "../src/screens/ConsentScreen";
import { HomeScreen } from "../src/screens/HomeScreen";
import { LanguageScreen } from "../src/screens/LanguageScreen";
import { OtpScreen } from "../src/screens/OtpScreen";
import { PhoneScreen } from "../src/screens/PhoneScreen";
import { DISCLOSURE_KEYS, PrivacyScreen } from "../src/screens/PrivacyScreen";
import { saveCitizenTokens } from "../src/services/secureStorage";
import {
  E164,
  jsonResponse,
  lastRequest,
  mockFetch,
  NUMBER,
  OTP_SENT,
  secureStoreContents,
  TOKENS,
} from "./helpers";

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

const PROFILE = {
  account_id: "8d0f4c2e-3b1a-4c55-9f00-0123456789ab", // synthetic
  masked_mobile_number: "+92 300 *** 4567",
  preferred_language: "en",
  status: "active",
  consents: {},
};

function giveRequiredConsent() {
  useOnboarding.getState().setSelection("account_creation_and_processing", true);
  useOnboarding.getState().setSelection("voice_processing", true);
  return useOnboarding.getState().confirmConsent();
}

beforeEach(async () => {
  await setLanguage("en");
  useOnboarding.getState().reset();
  usePrincipal.getState().signedOut();
  secureStoreContents().clear();
});

describe("CIT-01 language", () => {
  test("choosing a language switches the interface and records the choice", async () => {
    await setLanguage("en");
    const onChosen = jest.fn();
    await render(<LanguageScreen onChosen={onChosen} />);
    await userEvent.setup().press(screen.getByRole("button", { name: "اردو" }));
    expect(i18n.language).toBe("ur");
    expect(useOnboarding.getState().language).toBe("ur");
    expect(onChosen).toHaveBeenCalled();
  });

  test("explains an ended session in plain language, and only then (FR-AUTH.13)", async () => {
    await render(<LanguageScreen onChosen={jest.fn()} />);
    expect(screen.queryByText(t("session.expired"))).toBeNull();

    await act(() => usePrincipal.getState().signedOut("session_expired"));
    expect(screen.getByText(t("session.expired"))).toBeTruthy();
  });
});

describe("CIT-02 disclosure", () => {
  test("shows every disclosure point before anything is collected", async () => {
    const fetch = mockFetch();
    await render(<PrivacyScreen onContinue={jest.fn()} onBack={jest.fn()} />);
    for (const key of DISCLOSURE_KEYS) expect(screen.getByText(`• ${t(key)}`)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("CIT-03 consent", () => {
  test("three separate choices; the required two gate Continue; nothing is sent", async () => {
    const fetch = mockFetch();
    const onContinue = jest.fn();
    const user = userEvent.setup();
    await render(<ConsentScreen onContinue={onContinue} onBack={jest.fn()} />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    const agree = screen.getByRole("button", { name: t("consent.agree") });
    expect(agree).toBeDisabled();
    expect(screen.getByText(t("consent.requiredMissing"))).toBeTruthy();

    await user.press(screen.getByTestId("consent-sms"));
    await user.press(screen.getByTestId("consent-account"));
    expect(agree).toBeDisabled(); // optional + one required is not enough
    await user.press(screen.getByTestId("consent-voice"));
    expect(agree).toBeEnabled();
    expect(screen.queryByText(t("consent.requiredMissing"))).toBeNull();

    await user.press(agree);
    expect(onContinue).toHaveBeenCalled();
    expect(useOnboarding.getState().pendingConsent?.selections).toEqual({
      account_creation_and_processing: true,
      voice_processing: true,
      sms_notification: true,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("each checkbox is separately labelled and announces its state", async () => {
    await render(<ConsentScreen onContinue={jest.fn()} onBack={jest.fn()} />);
    const sms = screen.getByTestId("consent-sms");
    expect(sms.props.accessibilityLabel).toBe(`${t("consent.optional")}: ${t("consent.sms")}`);
    expect(sms).not.toBeChecked();
    await userEvent.setup().press(sms);
    expect(screen.getByTestId("consent-sms")).toBeChecked();
  });
});

describe("CIT-04 mobile number", () => {
  test("an invalid number is explained inline and nothing is sent", async () => {
    giveRequiredConsent();
    const fetch = mockFetch();
    const user = userEvent.setup();
    await render(<PhoneScreen onCodeSent={jest.fn()} onReviewConsent={jest.fn()} onBack={jest.fn()} />);
    await user.type(screen.getByTestId("phone-input"), "12345");
    await user.press(screen.getByRole("button", { name: t("phone.send") }));
    expect(screen.getByText(t("phone.invalid"))).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("a valid number requests a code with the held consent", async () => {
    const consent = giveRequiredConsent();
    const fetch = mockFetch(jsonResponse(202, OTP_SENT));
    const onCodeSent = jest.fn();
    const user = userEvent.setup();
    await render(<PhoneScreen onCodeSent={onCodeSent} onReviewConsent={jest.fn()} onBack={jest.fn()} />);
    await user.type(screen.getByTestId("phone-input"), NUMBER);
    await user.press(screen.getByRole("button", { name: t("phone.send") }));
    await waitFor(() => expect(onCodeSent).toHaveBeenCalled());
    const body = JSON.parse(String(lastRequest(fetch).init.body));
    expect(body.mobile_number).toBe(E164);
    expect(body.pending_consent_ref).toBe(consent.ref);
    expect(useOnboarding.getState().e164).toBe(E164);
  });

  test("offline: a plain message, no queueing, one attempt", async () => {
    giveRequiredConsent();
    const fetch = mockFetch(new TypeError("Network request failed"));
    const onCodeSent = jest.fn();
    const user = userEvent.setup();
    await render(<PhoneScreen onCodeSent={onCodeSent} onReviewConsent={jest.fn()} onBack={jest.fn()} />);
    await user.type(screen.getByTestId("phone-input"), NUMBER);
    await user.press(screen.getByRole("button", { name: t("phone.send") }));
    expect(await screen.findByText(t("phone.offline"))).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onCodeSent).not.toHaveBeenCalled();
  });

  test("the development backend's test-number refusal is explained, and nothing moves on (DG-70)", async () => {
    giveRequiredConsent();
    const refusal = { error: { code: "E_DEV_TEST_NUMBER_ONLY", message: "Development only" } };
    mockFetch(jsonResponse(403, refusal));
    const onCodeSent = jest.fn();
    const user = userEvent.setup();
    await render(<PhoneScreen onCodeSent={onCodeSent} onReviewConsent={jest.fn()} onBack={jest.fn()} />);
    await user.type(screen.getByTestId("phone-input"), "311 9876543");
    await user.press(screen.getByRole("button", { name: t("phone.send") }));
    expect(await screen.findByText(t("phone.devTestNumberOnly"))).toBeTruthy();
    expect(onCodeSent).not.toHaveBeenCalled();
    expect(useOnboarding.getState().e164).toBeNull();
  });

  test("without a consent snapshot the citizen is sent back to CIT-03", async () => {
    const fetch = mockFetch();
    const onReviewConsent = jest.fn();
    const user = userEvent.setup();
    await render(<PhoneScreen onCodeSent={jest.fn()} onReviewConsent={onReviewConsent} onBack={jest.fn()} />);
    await user.type(screen.getByTestId("phone-input"), NUMBER);
    await user.press(screen.getByRole("button", { name: t("phone.send") }));
    expect(onReviewConsent).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("CIT-05 code verification", () => {
  beforeEach(() => {
    giveRequiredConsent();
    useOnboarding.getState().setNumber(E164, 0);
  });

  test("shows the masked number only", async () => {
    await render(<OtpScreen onSignedIn={jest.fn()} onEditNumber={jest.fn()} onReviewConsent={jest.fn()} />);
    expect(screen.getByText(t("otp.sentTo", { number: "+92 300 *** 4567" }))).toBeTruthy();
    expect(screen.queryByText(/3001234567/)).toBeNull();
  });

  test("a wrong code shows the uniform message and announces the attempts remaining", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    mockFetch(
      jsonResponse(400, {
        error: { code: "E_OTP_INVALID", message: "The code is wrong or has expired.", attempts_remaining: 4 },
      }),
    );
    const user = userEvent.setup();
    await render(<OtpScreen onSignedIn={jest.fn()} onEditNumber={jest.fn()} onReviewConsent={jest.fn()} />);
    await user.type(screen.getByTestId("otp-input"), "111111");
    await user.press(screen.getByRole("button", { name: t("otp.verify") }));
    expect(await screen.findByText(t("otp.wrong"))).toBeTruthy();
    expect(screen.getByText(t("otp.attemptsRemaining", { count: 4 }))).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(`${t("otp.wrong")} ${t("otp.attemptsRemaining", { count: 4 })}`);
    expect(screen.getByTestId("otp-input").props.value).toBe(""); // the code is not kept
    expect(secureStoreContents().size).toBe(0);
  });

  test("no attempts left disables Verify until a new code is requested", async () => {
    mockFetch(jsonResponse(400, { error: { code: "E_OTP_INVALID", message: "x", attempts_remaining: 0 } }));
    const user = userEvent.setup();
    await render(<OtpScreen onSignedIn={jest.fn()} onEditNumber={jest.fn()} onReviewConsent={jest.fn()} />);
    await user.type(screen.getByTestId("otp-input"), "111111");
    await user.press(screen.getByRole("button", { name: t("otp.verify") }));
    expect(await screen.findByText(t("otp.noAttempts"))).toBeTruthy();
    await user.type(screen.getByTestId("otp-input"), "222222");
    expect(screen.getByRole("button", { name: t("otp.verify") })).toBeDisabled();
  });

  test("success stores the tokens, signs in, and discards the device consent payload", async () => {
    const fetch = mockFetch(jsonResponse(200, TOKENS), jsonResponse(200, PROFILE));
    const onSignedIn = jest.fn();
    const user = userEvent.setup();
    await render(<OtpScreen onSignedIn={onSignedIn} onEditNumber={jest.fn()} onReviewConsent={jest.fn()} />);
    await user.type(screen.getByTestId("otp-input"), "246810");
    await user.press(screen.getByRole("button", { name: t("otp.verify") }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual({ mobile_number: E164, code: "246810" });
    expect(lastRequest(fetch).url).toMatch(/\/citizen\/profile$/);
    expect(secureStoreContents().get("parakh.citizen.account_id")).toBe(PROFILE.account_id);
    expect(usePrincipal.getState().principal).toEqual({ subjectType: "citizen" });
    expect(useOnboarding.getState().pendingConsent).toBeNull();
    expect(secureStoreContents().get("parakh.citizen.access_token")).toBe("synthetic-access");
  });

  test("offline: a plain message and no stored code", async () => {
    mockFetch(new TypeError("Network request failed"));
    const user = userEvent.setup();
    await render(<OtpScreen onSignedIn={jest.fn()} onEditNumber={jest.fn()} onReviewConsent={jest.fn()} />);
    await user.type(screen.getByTestId("otp-input"), "246810");
    await user.press(screen.getByRole("button", { name: t("otp.verify") }));
    expect(await screen.findByText(t("otp.offline"))).toBeTruthy();
    expect(secureStoreContents().size).toBe(0);
  });

  test("a new number without server-held consent returns to CIT-03", async () => {
    mockFetch(jsonResponse(400, { error: { code: "E_CONSENT_REQUIRED", message: "x" } }));
    const onReviewConsent = jest.fn();
    const user = userEvent.setup();
    await render(
      <OtpScreen onSignedIn={jest.fn()} onEditNumber={jest.fn()} onReviewConsent={onReviewConsent} />,
    );
    await user.type(screen.getByTestId("otp-input"), "246810");
    await user.press(screen.getByRole("button", { name: t("otp.verify") }));
    await waitFor(() => expect(onReviewConsent).toHaveBeenCalled());
  });
});

describe("CIT-06 home", () => {
  test("five choices with Report an Issue first and working; the others marked as not yet available (FR-PUB.1)", async () => {
    const onReport = jest.fn();
    await render(<HomeScreen onReport={onReport} />);
    const tiles = ["home.report", "home.myReports", "home.notifications", "home.help", "home.profile"];
    expect(tiles.map((k) => screen.getByRole("button", { name: t(k) }))).toHaveLength(5);
    for (const k of tiles.slice(1)) expect(screen.getByRole("button", { name: t(k) })).toBeDisabled();
    expect(screen.getByText(t("home.notYet"))).toBeTruthy();
    await userEvent.setup().press(screen.getByRole("button", { name: t("home.report") }));
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  test("My reports opens CIT-14 once its screen is wired", async () => {
    const onMyReports = jest.fn();
    await render(<HomeScreen onReport={jest.fn()} onMyReports={onMyReports} />);
    const tile = screen.getByRole("button", { name: t("home.myReports") });
    expect(tile).toBeEnabled();
    await userEvent.setup().press(tile);
    expect(onMyReports).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: t("home.notifications") })).toBeDisabled();
  });

  test("sign out revokes the session on the server and returns to the gateway", async () => {
    await saveCitizenTokens({ accessToken: "access", refreshToken: "refresh" });
    usePrincipal.getState().signedInAsCitizen();
    const fetch = mockFetch(jsonResponse(204, null));
    await render(<HomeScreen onReport={jest.fn()} />);
    await userEvent.setup().press(screen.getByRole("button", { name: t("home.signOut") }));
    await waitFor(() => expect(usePrincipal.getState().principal).toBeNull());
    expect(lastRequest(fetch).url).toMatch(/\/auth\/logout$/);
    expect(secureStoreContents().size).toBe(0);
  });
});
