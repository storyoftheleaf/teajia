import assets from '../readAssets.generated.json';
import { serveReadAsset, type ReadAsset } from '../readAssetDelivery';

export const onRequest: PagesFunction<{ WORKER_ORIGIN?: string }> = ({ request, env }) => {
  const path = new URL(request.url).pathname;
  const asset = Object.prototype.hasOwnProperty.call(assets, path)
    ? (assets as Record<string, ReadAsset>)[path] : undefined;
  return serveReadAsset(request, env.WORKER_ORIGIN, asset);
};
