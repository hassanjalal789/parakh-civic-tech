/** F-10: native image caching must not create plaintext copies of report evidence.
 * This temporary online-only policy is not the approved encrypted 30-day cache.
 * RN's authenticated network fetcher is preserved; only its cache policy changes.
 */
const { withMainApplication } = require("expo/config-plugins");

const PACKAGES = `
          // PARAKH_IMAGE_POLICY_BEGIN
          val imageClient = com.facebook.react.modules.network.OkHttpClientProvider.createClient()
          val imageConfig = com.facebook.imagepipeline.backends.okhttp3.OkHttpImagePipelineConfigFactory
            .newBuilder(this@MainApplication, imageClient)
            .setNetworkFetcher(com.facebook.react.modules.fresco.ReactOkHttpNetworkFetcher(imageClient))
            .setDiskCacheEnabled(false)
            .setBitmapMemoryCacheParamsSupplier {
              com.facebook.imagepipeline.cache.MemoryCacheParams(0, 0, 0, 0, 0)
            }
            .setEncodedMemoryCacheParamsSupplier {
              com.facebook.imagepipeline.cache.MemoryCacheParams(0, 0, 0, 0, 0)
            }
            .build()
          removeAll { it is com.facebook.react.shell.MainReactPackage }
          add(com.facebook.react.shell.MainReactPackage(com.facebook.react.shell.MainPackageConfig(imageConfig)))
          // PARAKH_IMAGE_POLICY_END
`;
const CLEANUP = `
    // PARAKH_LEGACY_IMAGE_CACHE_BEGIN
    // Only Fresco's disposable cache; never filesDir, databases, drafts or recordings.
    val legacyImageCache = java.io.File(cacheDir, "image_cache")
    check(!legacyImageCache.exists() || legacyImageCache.deleteRecursively()) {
      "Unable to remove the legacy image cache"
    }
    // PARAKH_LEGACY_IMAGE_CACHE_END
`;

function applyPolicy(source) {
  const packageAnchor = "PackageList(this).packages.apply {";
  const startupAnchor = "super.onCreate()";
  for (const anchor of [packageAnchor, startupAnchor]) {
    if (source.split(anchor).length !== 2) throw new Error(`Unrecognized MainApplication: ${anchor}`);
  }
  const policy = source.includes("// PARAKH_IMAGE_POLICY_BEGIN");
  const cleanup = source.includes("// PARAKH_LEGACY_IMAGE_CACHE_BEGIN");
  if (policy !== cleanup) throw new Error("Incomplete Parakh image policy; inspect native source");
  if (policy) return source;
  return source
    .replace(packageAnchor, packageAnchor + PACKAGES)
    .replace(startupAnchor, startupAnchor + CLEANUP);
}

module.exports = function withPrivateImagePipeline(config) {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== "kt") throw new Error("Parakh image policy requires Kotlin");
    config.modResults.contents = applyPolicy(config.modResults.contents);
    return config;
  });
};
module.exports.applyPolicy = applyPolicy;
