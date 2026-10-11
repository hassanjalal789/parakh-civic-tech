/**
 * T-048 — CIT-07, what is wrong, by picture (FR-PUB.2, FR-PUB.3). Offline: no
 * request is made. The fake SQLite stands in for the phone's draft store.
 */
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import i18n, { setLanguage } from "../src/i18n";
import { CATEGORIES, CategoryScreen } from "../src/screens/CategoryScreen";
import { draftRepository, type DraftRepository } from "../src/storage/drafts";
import { migrate } from "../src/storage/schema";
import { resetFileSystem } from "./fakes/fileSystem";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const NOW = new Date("2026-10-11T09:00:00.000Z");
const t = (key: string) => i18n.t(key);
let drafts: DraftRepository;
let fetchSpy: jest.SpyInstance;

beforeEach(async () => {
  await setLanguage("en");
  resetFileSystem();
  resetSqlite();
  const db = memoryDatabase();
  await migrate(db);
  drafts = draftRepository(db, ACCOUNT, () => NOW);
  fetchSpy = jest.spyOn(global, "fetch").mockImplementation(() => {
    throw new Error("CIT-07 works offline: no request");
  });
});

afterEach(() => jest.restoreAllMocks());

describe("CIT-07: the categories (FR-PUB.2)", () => {
  test("the six categories of FR-PUB.2, in order, each a tile with a text label — no dropdown, no request", async () => {
    await render(<CategoryScreen drafts={drafts} onChosen={jest.fn()} />);
    expect(CATEGORIES).toEqual(["water", "road", "drainage", "streetlight", "waste", "other"]);
    const tiles = screen.getAllByRole("button");
    expect(tiles.map((b) => b.props.accessibilityLabel)).toEqual(CATEGORIES.map((c) => t(`category.${c}`)));
    for (const c of CATEGORIES) expect(screen.getByText(t(`category.${c}`))).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("labels in Urdu too", async () => {
    await setLanguage("ur");
    await render(<CategoryScreen drafts={drafts} onChosen={jest.fn()} />);
    for (const c of CATEGORIES) expect(screen.getByText(i18n.t(`category.${c}`))).toBeTruthy();
  });
});

describe("CIT-07: choosing starts the report (FR-PUB.3)", () => {
  test("a LOCAL_DRAFT with a client-made identifier and the category; CIT-08 opens on it", async () => {
    const onChosen = jest.fn();
    await render(<CategoryScreen drafts={drafts} onChosen={onChosen} />);
    await userEvent.setup().press(screen.getByRole("button", { name: t("category.drainage") }));
    await waitFor(() => expect(onChosen).toHaveBeenCalledTimes(1));
    const [id] = onChosen.mock.calls[0] as [string];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await drafts.get(id)).toMatchObject({ pipeline_state: "LOCAL_DRAFT", category: "drainage" });
    expect(await drafts.list()).toHaveLength(1);
  });

  test("opened from CIT-11 with the draft: its category changes; no second draft", async () => {
    const existing = (await drafts.create()).client_submission_id;
    await drafts.update(existing, { category: "water" });
    const onChosen = jest.fn();
    await render(<CategoryScreen drafts={drafts} draftId={existing} onChosen={onChosen} />);
    await userEvent.setup().press(screen.getByRole("button", { name: t("category.waste") }));
    await waitFor(() => expect(onChosen).toHaveBeenCalledWith(existing));
    expect(await drafts.list()).toHaveLength(1);
    expect((await drafts.get(existing))?.category).toBe("waste");
  });

  test("coming back and choosing again changes the same draft's category — never a second draft", async () => {
    const onChosen = jest.fn();
    await render(<CategoryScreen drafts={drafts} onChosen={onChosen} />);
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: t("category.water") }));
    await waitFor(() => expect(onChosen).toHaveBeenCalledTimes(1));
    await user.press(screen.getByRole("button", { name: t("category.road") }));
    await waitFor(() => expect(onChosen).toHaveBeenCalledTimes(2));
    expect(onChosen.mock.calls[1]?.[0]).toBe(onChosen.mock.calls[0]?.[0]);
    const all = await drafts.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.category).toBe("road");
  });

  test("a draft that was sent meanwhile is not changed: a new one is started", async () => {
    const onChosen = jest.fn();
    await render(<CategoryScreen drafts={drafts} onChosen={onChosen} />);
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: t("category.water") }));
    await waitFor(() => expect(onChosen).toHaveBeenCalledTimes(1));
    const first = onChosen.mock.calls[0]?.[0] as string;
    await drafts.update(first, { pipeline_state: "READY_TO_SUBMIT" });
    await user.press(screen.getByRole("button", { name: t("category.waste") }));
    await waitFor(() => expect(onChosen).toHaveBeenCalledTimes(2));
    expect(onChosen.mock.calls[1]?.[0]).not.toBe(first);
    expect((await drafts.get(first))?.category).toBe("water");
  });
});
