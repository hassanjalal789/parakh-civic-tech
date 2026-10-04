import en from "../src/i18n/en.json";
import ur from "../src/i18n/ur.json";
import { DISCLOSURE_KEYS } from "../src/screens/PrivacyScreen";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...out, [path]: value } : { ...out, ...flatten(value, path) };
  }, {});
}

const EN = flatten(en);
const UR = flatten(ur);

describe("translations", () => {
  test("Urdu and English have exactly the same keys", () => {
    expect(Object.keys(UR).sort()).toEqual(Object.keys(EN).sort());
  });

  test("no string is empty", () => {
    for (const [key, value] of [...Object.entries(EN), ...Object.entries(UR)]) {
      expect(`${key}=${value.trim()}`).not.toBe(`${key}=`);
    }
  });

  test("interpolation placeholders match between languages", () => {
    const vars = (s: string) => (s.match(/{{\w+}}/g) ?? []).sort();
    for (const key of Object.keys(EN)) {
      expect([key, vars(UR[key] ?? "")]).toEqual([key, vars(EN[key] ?? "")]);
    }
  });

  test("the Urdu text is marked as an unreviewed draft until human review (T-045)", () => {
    expect(UR["_meta.review"]).toMatch(/^UNREVIEWED DRAFT/);
  });

  test("every CIT-02 disclosure point exists, including that reporting is not anonymous", () => {
    for (const key of DISCLOSURE_KEYS) {
      expect(EN[key]).toBeTruthy();
      expect(UR[key]).toBeTruthy();
    }
    expect(EN["privacy.notAnonymous"]).toMatch(/not anonymous/);
    expect(UR["privacy.notAnonymous"]).toMatch(/گمنام نہیں/);
  });

  test("no string describes reporting as anonymous", () => {
    for (const [key, value] of Object.entries(EN)) {
      if (/anonym/i.test(value))
        expect([key, value]).toEqual(["privacy.notAnonymous", EN["privacy.notAnonymous"]]);
    }
    for (const [key, value] of Object.entries(UR)) {
      if (value.includes("گمنام")) expect(key).toBe("privacy.notAnonymous");
    }
  });

  test("citizen sign-in is never described as two-factor or password-based", () => {
    for (const value of Object.values(EN)) expect(value).not.toMatch(/two-factor|2FA|password/i);
  });
});
