// Curated stories may be unpublished at runtime. Their executable modules,
// including exclusive data dependencies and source maps, must never be static
// assets. Pages serves these bytes only after the Worker's delivery decision.
import fs from 'node:fs';
import path from 'node:path';

export const READ_ARTICLE_MODULES = {
  '/read/rock-remembers': 'src/pages/read/RockRemembers.tsx',
  '/read/earth-water-fire': 'src/pages/read/EarthWaterFire.tsx',
  '/read/before-the-mist': 'src/pages/read/BeforeTheMist.tsx',
  '/read/atlas': 'src/pages/read/AtlasMapOfMountains.tsx',
  '/read/craft': 'src/pages/read/CraftPotThatRemembers.tsx',
  '/read/essay': 'src/pages/read/EssayLongWayToCup.tsx',
  '/read/field-notes': 'src/pages/read/FieldNotesTwoRoomsBali.tsx',
  '/read/field-study': 'src/pages/read/FieldStudyWaterBeforeLeaf.tsx',
  '/read/history': 'src/pages/read/HistoryTenThousandMornings.tsx',
  '/read/legend': 'src/pages/read/LegendImmortalsCliff.tsx',
  '/read/ritual': 'src/pages/read/RitualSevenSteeps.tsx',
  '/read/tasting': 'src/pages/read/TastingVocabularyOfTaste.tsx',
  '/read/tea-house': 'src/pages/read/TeaHouseQuietHours.tsx',
  '/read/porcelain-and-tea': 'src/pages/read/CraftRenewalPorcelain.tsx',
};

export function readDeliveryPlugin({ articles = READ_ARTICLE_MODULES } = {}) {
  let root;
  let privateModules;
  let protectedAssets = {};
  const clean = id => id.replaceAll('\\', '/').split('?')[0];
  function classify(api) {
    if (privateModules) return privateModules;
    const roots = new Map(Object.entries(articles).map(([href, file]) => [clean(path.resolve(root, file)), href]));
    const publicModules = new Set();
    // Reusable byline markup carries no story prose and is already visible on
    // the published porcelain conversation. Sharing it must not require all
    // four conversations to be published together.
    const publicHelpers = ['src/pages/read/conversation/Byline.tsx', 'src/pages/read/conversation/byline.css'];
    const visitPublic = id => {
      if (roots.has(clean(id)) || publicModules.has(id)) return;
      publicModules.add(id);
      const info = api.getModuleInfo(id);
      for (const dep of [...(info?.importedIds ?? []), ...(info?.dynamicallyImportedIds ?? [])]) visitPublic(dep);
    };
    for (const id of api.getModuleIds()) {
      if (api.getModuleInfo(id)?.isEntry || publicHelpers.some(file => clean(id) === clean(path.resolve(root, file)))) visitPublic(id);
    }
    if ([...publicModules].some(id => clean(id).startsWith(clean(path.resolve(root, 'src/pages/read/conversation/pieces')) + '/'))) {
      throw new Error('Private story data imported by public code. Keep story words behind Read delivery.');
    }
    const owners = new Map();
    function visitPrivate(id, href, seen = new Set()) {
      if (seen.has(id) || publicModules.has(id)) return;
      seen.add(id);
      if (!owners.has(id)) owners.set(id, new Set());
      owners.get(id).add(href);
      const info = api.getModuleInfo(id);
      for (const dep of [...(info?.importedIds ?? []), ...(info?.dynamicallyImportedIds ?? [])]) visitPrivate(dep, href, seen);
    }
    for (const [id, href] of roots) visitPrivate(id, href);
    privateModules = owners;
    return owners;
  }
  return {
    name: 'read-delivery',
    apply: 'build',
    config(config) {
      const previous = config.build?.rollupOptions?.output;
      if (Array.isArray(previous)) throw new Error('Read delivery requires one browser output.');
      const manualChunks = previous?.manualChunks;
      return { build: { rollupOptions: { output: {
        onlyExplicitManualChunks: true,
        chunkFileNames: chunk => chunk.name.startsWith('read-content-') ? 'read-assets/[name]-[hash].js' : 'assets/[name]-[hash].js',
        manualChunks(id, api) {
          const owners = classify(api).get(id);
          if (owners) return `read-content-${[...owners].sort().map(href => href.slice('/read/'.length)).join('_')}`;
          return typeof manualChunks === 'function' ? manualChunks(id, api) : undefined;
        },
      } } } };
    },
    configResolved(config) { root = config.root; },
    buildStart() { privateModules = undefined; protectedAssets = {}; },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (chunk.type !== 'chunk') continue;
          const owners = new Set(Object.keys(chunk.modules).flatMap(id => [...(privateModules?.get(id) ?? [])]));
          if (!owners.size) continue;
          if (!fileName.startsWith('read-assets/')) this.error('Private Read modules entered a public chunk.');
          if (Object.keys(chunk.modules).some(id => !privateModules.has(id))) this.error(`Read content shares a chunk with public code: ${fileName}: ${Object.keys(chunk.modules).filter(id => !privateModules.has(id)).join(', ')}`);
          protectedAssets['/' + fileName] = { paths: [...owners].sort(), code: chunk.code };
          delete bundle[fileName];
          delete bundle[fileName + '.map'];
        }
        for (const href of Object.keys(articles)) {
          if (!Object.values(protectedAssets).some(asset => asset.paths.includes(href))) this.error(`No protected module built for ${href}`);
        }
      },
    },
    writeBundle() {
      fs.mkdirSync(path.join(root, 'functions'), { recursive: true });
      fs.writeFileSync(path.join(root, 'functions/readAssets.generated.json'), JSON.stringify(protectedAssets));
    },
  };
}
