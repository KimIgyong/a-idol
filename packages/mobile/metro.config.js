// Metro config tuned for pnpm monorepo — includes the workspace root so shared
// packages resolve, and disables hierarchical lookup to avoid phantom deps.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force React (and friends) to a single copy. Without this, pnpm's hoisted
// layout puts a CMS-paired `node_modules/react-i18next` at the root with a
// nested `node_modules/react@18.3.1`. Mobile uses `react@18.2.0`, so Metro
// would resolve two different React instances into the same web bundle and
// `useContext` ends up calling `null.useContext` (the second React's
// dispatcher is never primed) — see the staging /preview crash 2026-05-06.
const reactSingletons = new Set([
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
  'scheduler',
]);
const singletonResolver = (name) =>
  require.resolve(name, { paths: [projectRoot, workspaceRoot] });

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (reactSingletons.has(moduleName)) {
    return { filePath: singletonResolver(moduleName), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
