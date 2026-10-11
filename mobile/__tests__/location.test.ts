/**
 * DG-73 (Hassan Jalal, 2026-10-11) — the report's location on the phone: what the phone
 * measured kept beside the position the reporter confirms, or the reporter's written
 * description when there are no coordinates. All positions are synthetic.
 */
import {
  isAdjusted,
  LOCATION_DESCRIPTION_MAX,
  locationBody,
  locationProblem,
  locationSource,
  locationUnverified,
  type MeasuredPosition,
  type ReportLocation,
} from "../src/domain/location";
import { draftRepository, type DraftRepository, locationOf } from "../src/storage/drafts";
import { migrate, SCHEMA_VERSION } from "../src/storage/schema";
import type { SqlDb } from "../src/storage/sql";
import { resetFileSystem } from "./fakes/fileSystem";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const NOW = new Date("2026-10-11T09:00:00.000Z");
const MEASURED: MeasuredPosition = {
  latitude: 31.52037,
  longitude: 74.358749,
  accuracyM: 12.5,
  fix: "current",
  measuredAt: "2026-10-11T08:59:30.000Z",
};
const gps = (over: Partial<MeasuredPosition> = {}, reported?: { latitude: number; longitude: number }) => {
  const measured = { ...MEASURED, ...over };
  return {
    kind: "coordinates" as const,
    measured,
    reported: reported ?? { latitude: measured.latitude, longitude: measured.longitude },
  };
};

describe("DG-73: what the phone measured, what the reporter confirms, or a written description", () => {
  test("only an unadjusted current GPS fix is verified", () => {
    const cases: [ReportLocation, string, boolean][] = [
      [gps(), "gps_current", false],
      [gps({ fix: "last_known" }), "gps_last_known", true],
      [gps({}, { latitude: 31.52046, longitude: 74.358749 }), "adjusted", true],
      [gps({ fix: "last_known" }, { latitude: 31.52037, longitude: 74.35884 }), "adjusted", true],
      [{ kind: "description", description: "Near the water tank" }, "description", true],
    ];
    for (const [location, source, unverified] of cases) {
      expect(locationSource(location)).toBe(source);
      expect(locationUnverified(location)).toBe(unverified);
    }
  });

  test("adjusted means moved by at least the server's precision, six decimal places", () => {
    expect(isAdjusted(gps({}, { latitude: 31.5203701, longitude: 74.358749 }))).toBe(false);
    expect(isAdjusted(gps({}, { latitude: 31.520371, longitude: 74.358749 }))).toBe(true);
  });

  test("the API-130 body carries the measurement unchanged beside the reported position", () => {
    expect(locationBody(gps({}, { latitude: 31.5205, longitude: 74.3588 }))).toEqual({
      measured: {
        latitude: 31.52037,
        longitude: 74.358749,
        accuracy_m: 12.5,
        fix: "current",
        measured_at: "2026-10-11T08:59:30.000Z",
      },
      reported: { latitude: 31.5205, longitude: 74.3588 },
      description: null,
    });
    const words = "  Behind the girls' school\n";
    expect(locationBody({ kind: "description", description: words })).toEqual({
      measured: null,
      reported: null,
      description: words, // exactly as written
    });
  });

  test("what the server would refuse is named before anything is stored", () => {
    expect(locationProblem(gps())).toBeNull();
    expect(locationProblem(gps({ accuracyM: null as unknown as number }))).toBeNull();
    expect(locationProblem({ kind: "description", description: " \n\t" })).toBe("description_blank");
    expect(
      locationProblem({ kind: "description", description: "x".repeat(LOCATION_DESCRIPTION_MAX) }),
    ).toBeNull();
    expect(
      locationProblem({ kind: "description", description: "x".repeat(LOCATION_DESCRIPTION_MAX + 1) }),
    ).toBe("description_too_long");
    expect(locationProblem(gps({ latitude: 91 }))).toBe("measured_out_of_range");
    expect(locationProblem(gps({}, { latitude: 31.5, longitude: 181 }))).toBe("reported_out_of_range");
    expect(locationProblem(gps({ accuracyM: -1 }))).toBe("accuracy_out_of_range");
    expect(locationProblem(gps({ fix: "manual" as "current" }))).toBe("unknown_fix");
    expect(locationProblem(gps({ measuredAt: "yesterday" }))).toBe("measured_at_invalid");
  });
});

describe("DG-73 on the phone's draft store", () => {
  let db: SqlDb;
  let drafts: DraftRepository;
  let id: string;

  beforeEach(async () => {
    resetFileSystem();
    resetSqlite();
    db = memoryDatabase();
    await migrate(db);
    drafts = draftRepository(db, ACCOUNT, () => NOW);
    id = (await drafts.create()).client_submission_id;
  });

  test("migration 3 only adds the location columns: an existing draft is left exactly as it was", async () => {
    const added = [
      "measured_latitude",
      "measured_longitude",
      "measured_accuracy_m",
      "measured_fix",
      "measured_at",
      "reported_latitude",
      "reported_longitude",
      "location_description",
    ];
    // The database as version 2 left it, holding a draft.
    for (const column of added) await db.execAsync(`ALTER TABLE drafts DROP COLUMN ${column};`);
    await db.runAsync("UPDATE schema_version SET version = 2");
    const before = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM drafts");
    await migrate(db);
    expect(SCHEMA_VERSION).toBe(3);
    const after = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM drafts");
    for (const column of added) expect(after?.[column]).toBeNull();
    for (const [column, value] of Object.entries(before ?? {})) expect(after?.[column]).toEqual(value);
    await migrate(db); // a repeat changes nothing
    expect(await db.getFirstAsync("SELECT * FROM drafts")).toEqual(after);
  });

  test("a location is written in one step and read back; the measurement is kept beside an adjustment", async () => {
    const adjusted = gps({ fix: "last_known" }, { latitude: 31.5205, longitude: 74.3588 });
    const row = await drafts.setLocation(id, adjusted);
    expect(row).toMatchObject({
      location_source: "adjusted",
      measured_latitude: 31.52037,
      measured_longitude: 74.358749,
      measured_accuracy_m: 12.5,
      measured_fix: "last_known",
      measured_at: "2026-10-11T08:59:30.000Z",
      reported_latitude: 31.5205,
      reported_longitude: 74.3588,
      location_description: null,
    });
    expect(locationOf(row as NonNullable<typeof row>)).toEqual(adjusted);
  });

  test("a description replaces coordinates entirely, and coordinates replace a description", async () => {
    await drafts.setLocation(id, gps());
    const words = "  Main bazaar, opposite the mosque ";
    const described = await drafts.setLocation(id, { kind: "description", description: words });
    expect(described).toMatchObject({
      location_source: "description",
      measured_latitude: null,
      measured_fix: null,
      measured_at: null,
      reported_latitude: null,
      location_description: words,
    });
    expect(locationOf(described as NonNullable<typeof described>)).toEqual({
      kind: "description",
      description: words,
    });
    const back = await drafts.setLocation(id, gps());
    expect(back).toMatchObject({ location_source: "gps_current", location_description: null });
  });

  test("an unusable location is refused and nothing changes; a sent draft's location cannot change", async () => {
    await drafts.setLocation(id, gps());
    await expect(drafts.setLocation(id, { kind: "description", description: "   " })).rejects.toThrow(
      "description_blank",
    );
    expect((await drafts.get(id))?.location_source).toBe("gps_current");

    await drafts.update(id, { pipeline_state: "READY_TO_SUBMIT" });
    await drafts.setLocation(id, { kind: "description", description: "somewhere else" });
    expect((await drafts.get(id))?.location_source).toBe("gps_current");
  });

  test("a new draft has no location, and the location is never written one field at a time", async () => {
    const row = await drafts.get(id);
    expect(locationOf(row as NonNullable<typeof row>)).toBeNull();
    await expect(
      drafts.update(id, { measured_latitude: 31.5 } as unknown as Parameters<DraftRepository["update"]>[1]),
    ).rejects.toThrow("not an editable draft field");
  });
});
