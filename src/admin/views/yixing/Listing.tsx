import { Link } from 'react-router-dom';
import type { InventoryItem } from '../../../types';
import { ProductDetailLayout } from '../../../components/shop/ProductDetailLayout';
import { productGallery, productIdentity, teawareFacts, teawareReading } from '../../../components/shop/productDetailFields';
import { BASE, EMPTY, guidePath, KINDS, potPath, shapeEvidenceName, type Auth, type Board, type Pot } from './data';
import { useReviewPhotos } from './Photos';
import { shapeEvidencePath } from './shapeData';

export function Listing({ board, pot, auth }: { board: Board; pot: Pot; auth: Auth }) {
  const { urls, failed } = useReviewPhotos(pot.photos.map(photo => photo.sha256), auth);
  const item: InventoryItem = {
    id: pot.id, name: pot.listing.name, variant: pot.listing.name, type: 'Teaware', category: 'ware',
    year: '', origin: '', form: pot.listing.form, description: pot.listing.description ?? '', stock_g: 0, cost_price: '',
    image: urls[0] ?? '', additionalImages: urls.slice(1), tags: [], teawareDetails: { mark: pot.listing.mark },
  };
  const decision = board.decisions[pot.id] ?? EMPTY;
  const matches = KINDS.filter(kind => kind !== 'shape' || !decision.confirmedShape)
    .flatMap(kind => board.reference.entries.filter(e => e.kind === kind && e.id === decision[kind]));
  const labels = { clay: 'Clay type', color: 'Fired color', shape: 'Form' };
  const linkedFacts = matches.map(e => ({ label: labels[e.kind], value: e.name, to: guidePath(pot, e.id, true) }));
  const confirmed = decision.confirmedShape;
  if (confirmed) linkedFacts.push({
    label: labels.shape, value: shapeEvidenceName(confirmed), to: shapeEvidencePath(pot.id, confirmed, true),
  });
  const facts = [...linkedFacts, ...teawareFacts(item).filter(f => !linkedFacts.some(link => link.label === f.label))];
  const reading = teawareReading(item, null);
  if (matches.length) reading.sections.push({ label: 'From Tea Wisdom', paragraphs: matches.map(e => e.summary) });
  return <ProductDetailLayout
    ownerPreviewNavigation={<nav aria-label="Private listing preview" className="mx-auto flex flex-wrap items-center gap-3 px-4 py-2">
      <Link className="btn-quiet btn-sm" to={potPath(pot.id)}>← Back to review</Link>
      <Link className="btn-quiet btn-sm" to={BASE}>All pots</Link>
      <span className="text-tea-text-dim">Private listing preview</span>
      {failed && <span role="status">Photo unavailable</span>}
    </nav>}
    identity={{ ...productIdentity(item), onNavigateSource: () => {} }} gallery={productGallery(item, 'page')}
    actions={{ productId: pot.id, label: 'Teaware actions' }} factsTitle="The Piece" facts={facts} reading={reading}
  />;
}
