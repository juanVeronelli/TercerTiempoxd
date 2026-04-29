const path = require("path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Fix: resolve react-native-purchases ./utils/environment (Metro sometimes fails on Windows)
const defaultResolveRequest = config.resolver?.resolveRequest;
config.resolver = config.resolver || {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "./utils/environment" &&
    context.originModulePath?.includes("react-native-purchases") &&
    !context.originModulePath?.includes("react-native-purchases-ui")
  ) {
    const resolved = path.resolve(
      __dirname,
      "node_modules/react-native-purchases/dist/utils/environment.js"
    );
    return { type: "sourceFile", filePath: resolved };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
