// Metro config สำหรับ monorepo (npm workspaces)
// ให้ Metro มองเห็น+แปลงซอร์สของ @makruk/engine ที่อยู่นอกโฟลเดอร์ app
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
config.resolver.disableHierarchicalLookup = true;
// ให้ Metro bundle ไฟล์เสียง .wav เป็น asset
if (!config.resolver.assetExts.includes('wav')) config.resolver.assetExts.push('wav');

module.exports = config;
