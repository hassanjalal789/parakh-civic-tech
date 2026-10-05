/**
 * Every Android module, the app and each library, builds with one native
 * toolchain: rootProject.ext.ndkVersion and buildToolsVersion (27.1.12297006
 * and 36.0.0 for React Native 0.86 / Expo SDK 57) and CMake 3.30.5, the
 * version React Native pins for its own native build
 * (ReactAndroid/build.gradle.kts, with the same CMAKE_VERSION override).
 *
 * Modules that set none of these (expo-sqlite, expo and others) fell back to
 * the Android Gradle plugin's defaults, and the first build downloaded a
 * second 2.4 GB NDK. Automatic SDK downloads are also switched off: a missing
 * component now fails the build with a clear message instead.
 */
const { withGradleProperties, withProjectBuildGradle } = require("expo/config-plugins");

const BEGIN = "// parakh:begin uniform native toolchain";
const END = "// parakh:end uniform native toolchain";

const BLOCK = `${BEGIN}
subprojects { sub ->
  ["com.android.library", "com.android.application"].each { pluginId ->
    sub.plugins.withId(pluginId) {
      sub.android.ndkVersion = rootProject.ext.ndkVersion
      sub.android.buildToolsVersion = rootProject.ext.buildToolsVersion
      sub.android.externalNativeBuild.cmake.version = System.getenv("CMAKE_VERSION") ?: "3.30.5"
    }
  }
}
${END}
`;

/**
 * React Native's root plugin evaluates :app as soon as it is applied, so the
 * hook is registered just before that line (and after expo-root-project,
 * which defines the versions it reads). An earlier copy is replaced, so
 * repeated prebuilds keep exactly one block.
 */
const RN_ROOT_PLUGIN = 'apply plugin: "com.facebook.react.rootproject"';

function applyBlock(contents) {
  const start = contents.indexOf(BEGIN);
  const end = contents.indexOf(END);
  const kept =
    start === -1 || end < start ? contents : contents.slice(0, start) + contents.slice(end + END.length + 1);
  const at = kept.indexOf(RN_ROOT_PLUGIN);
  if (at === -1) throw new Error(`withUniformNdk: ${RN_ROOT_PLUGIN} not found in build.gradle`);
  return `${kept.slice(0, at)}${BLOCK}${kept.slice(at)}`;
}

function withUniformNdk(config) {
  config = withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy") throw new Error("withUniformNdk expects a Groovy build.gradle");
    mod.modResults.contents = applyBlock(mod.modResults.contents);
    return mod;
  });
  return withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter((item) => item.key !== "android.builder.sdkDownload");
    mod.modResults.push({ type: "property", key: "android.builder.sdkDownload", value: "false" });
    return mod;
  });
}

module.exports = withUniformNdk;
module.exports.applyBlock = applyBlock;
