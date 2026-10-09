/**
 * FR-AUTH.1 / finding F-1 (phone test, 2026-10-09): the language chosen on
 * CIT-01 must survive a restart. On the phone, Urdu was chosen, the app was
 * closed and reopened, and Home came back in English — the phone's language.
 *
 * Each `startApp` loads the i18n module afresh, as a cold start does, against
 * one shared fake of the phone's storage.
 */
import { pathOf, Paths, resetFileSystem } from "./fakes/fileSystem";
import * as fs from "fs";

const mockFileSystem = jest.requireActual("./fakes/fileSystem");
jest.mock("expo-file-system", () => mockFileSystem);

type I18nModule = typeof import("../src/i18n");

async function startApp(deviceLanguage: "ur" | "en"): Promise<I18nModule> {
  jest.doMock("expo-localization", () => ({ getLocales: () => [{ languageCode: deviceLanguage }] }));
  let loaded: I18nModule | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<I18nModule>("../src/i18n");
  });
  if (!loaded) throw new Error("the i18n module did not load");
  return loaded;
}

const storedFile = () => `${pathOf(Paths.document.uri)}/parakh-interface-language`;

beforeEach(() => resetFileSystem());

test("with no choice stored, the app starts in the device language", async () => {
  expect((await startApp("en")).default.language).toBe("en");
  expect((await startApp("ur")).default.language).toBe("ur");
});

test("F-1: Urdu chosen on a phone set to English is still Urdu after a restart", async () => {
  const first = await startApp("en");
  expect(first.default.language).toBe("en");
  await first.setLanguage("ur");
  expect(first.default.language).toBe("ur");

  const afterRestart = await startApp("en");
  expect(afterRestart.default.language).toBe("ur");
});

test("English chosen on a phone set to Urdu is still English after a restart", async () => {
  await (await startApp("ur")).setLanguage("en");
  expect((await startApp("ur")).default.language).toBe("en");
});

test("the latest choice wins", async () => {
  const app = await startApp("en");
  await app.setLanguage("ur");
  await app.setLanguage("en");
  expect((await startApp("ur")).default.language).toBe("en");
  expect(fs.readFileSync(storedFile(), "utf8")).toBe("en");
});

test("a stored value that is not ur or en is ignored", async () => {
  fs.writeFileSync(storedFile(), "pa");
  expect((await startApp("en")).default.language).toBe("en");
  fs.writeFileSync(storedFile(), "");
  expect((await startApp("ur")).default.language).toBe("ur");
});

test("if the choice cannot be stored, it still applies now and the next start uses the device language", async () => {
  fs.rmSync(pathOf(Paths.document.uri), { recursive: true });
  const app = await startApp("en");
  await expect(app.setLanguage("ur")).resolves.toBeDefined();
  expect(app.default.language).toBe("ur");
  expect((await startApp("en")).default.language).toBe("en");
});
