// Metro config for the Crucible monorepo (npm workspaces).
// Lets the Expo app resolve hoisted deps at the repo root and watch sibling packages.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// @supabase/auth-js (a supabase-js dependency) has no "exports" map, only "main"/
// "module" fields. Metro's package-exports resolver mis-picks "module" here and
// fails since it isn't in resolverMainFields — disabling it falls back to plain
// main-field resolution, which works. Documented Supabase/Expo compatibility fix.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
