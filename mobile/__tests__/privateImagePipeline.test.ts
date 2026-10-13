/** F-10 native generation gates; physical disk behavior requires a rebuilt APK. */
const { applyPolicy } = jest.requireActual<{ applyPolicy: (source: string) => string }>(
  "../plugins/withPrivateImagePipeline",
);
const TEMPLATE = `class MainApplication {
  val packages = PackageList(this).packages.apply { }
  fun onCreate() { super.onCreate(); loadReactNative(this) }
}`;

test("prebuild preserves the authenticated fetcher and disables disk and reusable memory caches", () => {
  const source = applyPolicy(TEMPLATE);
  expect(source).toContain("ReactOkHttpNetworkFetcher(imageClient)");
  expect(source).toContain(".setDiskCacheEnabled(false)");
  expect(source.match(/MemoryCacheParams\(0, 0, 0, 0, 0\)/g)).toHaveLength(2);
  expect(source).toContain("removeAll { it is com.facebook.react.shell.MainReactPackage }");
  expect(source).toContain('java.io.File(cacheDir, "image_cache")');
  expect(source.indexOf("legacyImageCache.deleteRecursively()")).toBeLessThan(
    source.indexOf("loadReactNative"),
  );
  expect(source).not.toMatch(/File\((?:filesDir|dataDir)|clearApplicationUserData/);
  expect(applyPolicy(source)).toBe(source);
});

test("unknown or partially generated templates fail instead of silently omitting the policy", () => {
  expect(() => applyPolicy("unsupported template")).toThrow("Unrecognized MainApplication");
  expect(() => applyPolicy(TEMPLATE + "\n// PARAKH_IMAGE_POLICY_BEGIN")).toThrow("Incomplete");
  expect(() => applyPolicy(TEMPLATE + "\nsuper.onCreate()")).toThrow("Unrecognized");
});
