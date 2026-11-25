import React, { useState } from 'react';
import { Button } from '../../../../components/shared/Button';
import { useAppStore } from '../../../../lib/store';
import type { Product } from '../../../../admin/types';
import { FormPricingSheet, type SaveFormPricing } from './FormPricingSheet';
import { FreightSheet } from './FreightSheet';
import { QuickPhotoSheet } from './QuickPhotoSheet';
import { MiniMoreSheet, type SaveField } from './MiniPageSheets';
import { shippingRateUsdFor } from '../../../../lib/shippingRate';

export interface PhoneTeaToolsProps {
  product: Product;
  onSavePricing: SaveFormPricing;
  onSaveChange: SaveField;
  onTaste: () => void;
  onJournal: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onCount: (trigger: HTMLElement) => void;
  costRateToUsd: (product: Product) => number | null;
  shopFreightPerKgUsd: number | null;
}

/** The card design studies (cardStudy, cardPolish, headingStudy) still draw the 26 October phone cards. */
export const phoneCardStudy = () => import.meta.env.DEV && /[?&](cardStudy|cardPolish|headingStudy)=/.test(window.location.search);

type Panel = 'photos' | 'form' | 'freight' | 'more' | null;

/** The one-tap tools the 26 October cards carried, kept in the 8 October tea
 *  panel so the list itself stays as it was: Photo, Taste, Form, and More for
 *  shipping, history, journal and delete. */
export function PhoneTeaTools({ product, onSavePricing, onSaveChange, onTaste, onJournal, onHistory, onDelete, onEdit, onCount, costRateToUsd, shopFreightPerKgUsd }: PhoneTeaToolsProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const place = useAppStore(s => s.memberships.find(m => m.account_id === s.activeAccountId)?.account_name || s.activeAccount?.name || 'Current shop');
  const journal = useAppStore(s => s.tastingJournal.find(e => !e.archived && e.productId === product.id && e.accountId === s.activeAccountId));
  const freightUsd = product.type === 'Teaware' ? 0 : shippingRateUsdFor(product.shippingRatePerKg, costRateToUsd(product), shopFreightPerKgUsd);
  const leave = (action: () => void) => () => { setPanel(null); action(); };
  const word = 'tap-target px-1 text-ui-14 text-tea-text-sec hover:text-tea-text first:-ml-1';
  return <>
    <div className="flex h-12 items-center gap-4 border-b border-tea-border" role="group" aria-label={`Tools for ${product.productName}`}>
      <Button variant="plain" type="button" className={word} aria-label={`Photos for ${product.productName}`} onClick={() => setPanel('photos')}>Photo</Button>
      <Button variant="plain" type="button" className={word} aria-label={`${journal ? 'Edit' : 'Record'} tasting for ${product.productName}`} onClick={onTaste}>{journal ? 'Edit tasting' : 'Taste'}</Button>
      <Button variant="plain" type="button" className={word} aria-label={`Edit form and pricing for ${product.productName}`} onClick={() => setPanel('form')}>Form</Button>
      <Button variant="plain" type="button" className={word} aria-label={`More for ${product.productName}`} onClick={() => setPanel('more')}>More</Button>
    </div>
    {panel === 'photos' && <QuickPhotoSheet product={product} onSave={onSaveChange} onClose={() => setPanel(null)} />}
    {panel === 'form' && <FormPricingSheet product={product} onSave={onSavePricing} onClose={() => setPanel(null)} />}
    {panel === 'freight' && <FreightSheet product={product} onSave={v => onSaveChange('shippingRatePerKg', v)} onClose={() => setPanel(null)} />}
    {panel === 'more' && <MiniMoreSheet product={product} journal={journal} place={place} onClose={() => setPanel(null)}
      onForm={() => setPanel('form')} onFreight={() => setPanel('freight')} freightUsd={freightUsd} onSave={onSaveChange}
      onTaste={leave(onTaste)} onCount={trigger => { setPanel(null); onCount(trigger); }} onDelete={leave(onDelete)}
      onEdit={leave(onEdit)} onHistory={leave(onHistory)} onJournal={leave(onJournal)} />}
  </>;
}
