import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductDetailLayout } from '../../components/shop/ProductDetailLayout';
import { productGallery, productIdentity } from '../../components/shop/productDetailFields';
import { TeaDecisions } from './TeaDecisions';
import { API_URL, authedFetch } from '../../lib/api';
import type { InventoryItem } from '../../types';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';

const ROOT = '/admin/catalog-review/teas';
type Entry = { id: string; title: string; status: string };
type Page = Entry & {
  introduction: string; type: string; evidence: string; nextCheck: string; stockId?: string;
  packageOnly: boolean; photos: string[]; facts: { label: string; value: string }[];
};

function TeaPage({ page }: { page: Page }) {
  const item: InventoryItem = {
    id: page.id, name: page.title, variant: page.title, category: 'tea', type: page.type,
    year: '', origin: '', stock_g: 0, cost_price: '', description: '', image: page.photos[0] || '',
    additionalImages: page.photos.slice(1), tags: [],
  };
  const sections = [
    { label: 'Identification evidence', paragraphs: [page.evidence] },
    { label: 'Stock review', paragraphs: [page.status, page.nextCheck].filter(Boolean) },
  ];
  return <ProductDetailLayout teaOrder identity={{ ...productIdentity(item), onNavigateSource: () => {} }}
    gallery={{ ...productGallery(item, 'page'), itemName: page.packageOnly ? 'Package for ' + page.title : page.title }}
    galleryCaption={page.packageOnly ? 'Private package reference' : undefined} facts={page.facts} factsTitle="Recorded details"
    reading={{ label: 'Owner notes', introduction: page.introduction, sections }}
    ownerPreviewNavigation={<nav aria-label="Private tea review" className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 p-4">
      <Link className="btn-quiet btn-sm" to={ROOT}>All tea write-ups</Link>
      {page.stockId && <Link className="btn-quiet btn-sm" to={'/admin/stock?panel=' + encodeURIComponent(page.stockId)}>Open Stock record</Link>}
    </nav>}
  />;
}

export default function CatalogTeaReading() {
  const { groupId } = useParams();
  const scope = usePrivateQueryScope();
  const [accountId, userId, tokenRevision] = scope.key;
  const key = JSON.stringify([groupId, accountId, userId, tokenRevision, scope.ready]);
  const [result, setResult] = useState<{ key: string; data: Page | Entry[] | null }>();
  useEffect(() => {
    if (!scope.ready) return;
    const controller = new AbortController();
    const href = API_URL + '/api' + ROOT + (groupId ? '/' + encodeURIComponent(groupId) : '');
    authedFetch(href, {
      expectedAuth: { accountId, userId }, signal: controller.signal, cache: 'no-store', reportIncident: false,
    }).then(data => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch(() => { if (!controller.signal.aborted) setResult({ key, data: null }); });
    return () => controller.abort();
  }, [key, accountId, userId, groupId, scope.ready]);
  if (result?.key !== key) return <p className="p-4" role="status">Opening tea write-ups…</p>;
  if (!result.data) return <p className="p-4" role="status">Tea review unavailable for this account.</p>;
  if (!Array.isArray(result.data)) return <TeaPage page={result.data} />;
  return <TeaDecisions key={key} entries={result.data} />;
}
