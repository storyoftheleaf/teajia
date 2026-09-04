
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocation, useSearchParams, type Location } from 'react-router-dom';
import { Icons } from './Icons';
import { X } from 'lucide-react';
import { AddToSampleButton } from './samples/AddToSampleButton';
import { resolveTermLabel, resolveTermIcon, TASTING_TAXONOMY, TERM_MAP, type TastingCategoryId } from '../data/tastingTaxonomy';
import { getCommonTastingForType } from '../data/commonTastingByStyle';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { useShopPrice } from './shop/shopPrice';
import { InventoryItem } from '../types';
import { TEA_TYPES as WISDOM_TEA_TYPES, findRegion, normalizeTeaType } from '../wisdom';
import { SALE_ITEM_IDS } from '../data/curatedCollections';
import { useAppStore } from '../lib/store';
import { useProductModalRoute, PRODUCT_PATH_RE } from '../hooks/useProductModalRoute';
import { CompareView } from './shop/CompareView';
import { useTastingCounts } from '../hooks/useTastingCount';
import type { Product } from '../admin/types';
import { TeaFinder } from './shop/TeaFinder';
import { TeaLedger } from './shop/TeaLedger';
import { TeaShopViewRegion, TeaShopViewTabs } from './shop/TeaShopViewTabs';
import { BODY, LINK } from './shared/typeRoles';
import {
  applyFinderIntent,
  selectAvailableTeas,
  selectCuratedTeas,
  selectPastTeas,
  type TeaFinderIntent,
  type TeaShopView,
} from './shop/teaShopView';

// Use shared type alias for backward compatibility in this component if needed,
// or directly use InventoryItem
export type TeaItem = InventoryItem;

interface TeaInventoryProps {
  inventory: TeaItem[];
  onAddToCart?: (item: TeaItem, qty: number, total: number) => void;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
  hideHeader?: boolean;
  isAdmin?: boolean;
  adminProductMap?: Map<string, Product>;
  onAdminEdit?: (itemId: string) => void;
  modalLocation?: Location;
}

// Preferred display order for tea types, any types not listed here appear at the end.
// Sourced from the wisdom base; the old local list additionally carried a 'Black'
// entry alongside 'Red' (they are the same canonical type, hong cha is Red, not
// Black), which merged into the single 'Red' entry below.
const TYPE_ORDER: string[] = [...WISDOM_TEA_TYPES];

// Canonical filter/group key for a stored item type, resolves historical
// dialects (e.g. a record saved with type 'Black') to the wisdom base's
// canonical type, so 'Red' and 'Black' records land in the same filter pill
// and section rather than splitting into two. Falls back to the raw stored
// value when it isn't a recognized tea-type dialect (e.g. teaware categories).
const displayType = (type: string): string => normalizeTeaType(type) ?? type;

/**
 * Canonical filter key for where an item was grown.
 *
 * Resolved through the same wisdom base the product page reads, so a record
 * written "Wuyi Mountains" and one written "Wuyishan" land on one filter rather
 * than two. Origins the base does not hold fall back to the written string,
 * lowercased, so an unrecognised place still filters to itself.
 */
const regionKey = (origin: string | null | undefined): string | null => {
  const written = origin?.trim();
  if (!written) return null;
  return findRegion(written)?.id ?? written.toLowerCase();
};

/** What to call an active region filter in the chip that clears it. */
const regionLabel = (key: string): string => findRegion(key)?.name ?? key;

// Sort options for the shop toolbar, rendered as inline pills matching Type/Feeling
const SORT_OPTIONS: { id: 'featured' | 'price_asc' | 'price_desc' | 'recent' | 'tasted'; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'price_asc', label: 'Price ↑' },
  { id: 'price_desc', label: 'Price ↓' },
  { id: 'recent', label: 'Recently viewed' },
  { id: 'tasted', label: 'Most tasted' },
];

// Extract feeling terms from the canonical tasting taxonomy
const FEELING_TERMS = (() => {
  const cat = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling');
  if (!cat) return [];
  return cat.groups.flatMap(g => g.terms.map(t => ({ id: t.id, label: t.label })));
})();

// All mood terms (from "feeling" category) and flavor terms for profile-level filters
const ALL_MOOD_TERMS = (() => {
  const cat = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling');
  if (!cat) return [] as { id: string; label: string }[];
  return cat.groups.flatMap(g => g.terms.map(t => ({ id: t.id, label: t.label })));
})();

const ALL_FLAVOR_TAG_TERMS = (() => {
  const cat = TASTING_TAXONOMY.categories.find(c => c.id === 'flavor');
  if (!cat) return [] as { id: string; label: string }[];
  return cat.groups.flatMap(g => g.terms.map(t => ({ id: t.id, label: t.label })));
})();

// Sale items imported from data/curatedCollections

/**
 * Does the resolved tasting profile for this item include a given term?
 * Checks owner-saved data first; falls back to the style-level common profile
 * so filters still match before any tasting has been reviewed.
 */
function resolvedIncludes(item: TeaItem, categoryId: TastingCategoryId, termId: string): boolean {
  const ownerTerms =
    (item.tastingSource === 'owner' || item.tastingSource === 'community' || item.tastingSource === 'source')
      ? item.tasting?.[categoryId]
      : undefined;
  if (ownerTerms?.includes(termId)) return true;
  const common = getCommonTastingForType(item.type);
  return Boolean(common?.[categoryId]?.includes(termId));
}

export const TeaInventory: React.FC<TeaInventoryProps> = ({ inventory, onAddToCart, onCartClick, onAccountClick, cartItemCount = 0, hideHeader = false, isAdmin = false, adminProductMap, onAdminEdit, modalLocation }) => {
  /**
   * The grid price, in the currency the reader chose.
   *
   * This row is the first price anyone sees on the site, and it was the last
   * one still quoting dollars. Round six localised the product page and the
   * quick view, round seven swept the compare, saved, collection and sample
   * surfaces, and this list stayed on `fmtShopPrice` through both, so a reader
   * set to Rupiah browsed a wall of dollars and then watched every one of them
   * change the moment they tapped a tea. The conversion is not re-derived here:
   * it is the same hook the cart, the card and the page already read.
   */
  const shopPrice = useShopPrice();


  // Filter State
  const [activeType, setActiveType] = useState<string>('All');
  const [activeFeeling, setActiveFeeling] = useState<string | null>(null); // feeling term ID from taxonomy
  const [activeRegion, setActiveRegion] = useState<string | null>(null); // region ID from the wisdom base, or a written origin
  const [specialFilter, setSpecialFilter] = useState<'None' | 'Curated' | 'Sale' | 'Liked' | 'Tasted'>('None');
  const [openFilter, setOpenFilter] = useState<'type' | 'place' | 'feeling' | 'sort' | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [teaView, setTeaView] = useState<TeaShopView>('all');
  const [showPast, setShowPast] = useState(false);
  // Profile-level mood/flavor tag filters (URL params: ?mood=id,id2 and ?flavorTag=id,id2)
  const [activeMoodTags, setActiveMoodTags] = useState<string[]>([]);
  const [activeFlavorTags, setActiveFlavorTags] = useState<string[]>([]);
  const [moodFlavorOpen, setMoodFlavorOpen] = useState(false);

  const baseAvailable = useMemo(() => selectAvailableTeas(inventory), [inventory]);
  const baseCurated = useMemo(() => selectCuratedTeas(inventory), [inventory]);
  const basePast = useMemo(() => selectPastTeas(inventory), [inventory]);
  const filterSource = showPast
    ? basePast
    : teaView === 'selection'
      ? baseCurated
      : baseAvailable;

  // Derive tea types from actual inventory (ordered by TYPE_ORDER, then alphabetically)
  const teaTypes = useMemo(() => {
    const types = new Set(filterSource.map(item => displayType(item.type)));
    const ordered = TYPE_ORDER.filter(t => types.has(t));
    const remaining = [...types].filter(t => !TYPE_ORDER.includes(t)).sort();
    return [...ordered, ...remaining];
  }, [filterSource]);

  /**
   * The places this shop actually sells from, resolved and de-duplicated.
   *
   * Round four gave the region filter a URL and a chip, and left it with no
   * door: the only way to browse by place was to open a product page first and
   * follow the origin out of it. Place is one of the three facts the shop
   * groups by, so it gets a pill row beside Type, built from the inventory the
   * same way the type row is, and it disappears when there is only one place.
   */
  const availableRegions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of filterSource) {
      const key = regionKey(item.origin);
      if (key && !seen.has(key)) seen.set(key, regionLabel(key));
    }
    return [...seen.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [filterSource]);

  // Derive which feeling terms are actually present in the inventory.
  // Includes style-level common feelings so filters are meaningful before
  // the owner has saved any explicit tastings.
  const availableFeelings = useMemo(() => {
    const present = new Set<string>();
    for (const item of filterSource) {
      const ownerTerms =
        (item.tastingSource === 'owner' || item.tastingSource === 'community' || item.tastingSource === 'source')
          ? item.tasting?.feeling
          : undefined;
      if (ownerTerms) {
        for (const f of ownerTerms) present.add(f);
      }
      const common = getCommonTastingForType(item.type);
      if (common?.feeling) {
        for (const f of common.feeling) present.add(f);
      }
    }
    return FEELING_TERMS.filter(t => present.has(t.id));
  }, [filterSource]);

  // Compute which profile-level mood/flavor terms are actually used by at least
  // one Active+public product so the filter only shows discoverable states.
  const availableMoodTagTerms = useMemo(() => {
    const present = new Set<string>();
    for (const item of filterSource) {
      for (const t of item.moodTags ?? []) present.add(t);
    }
    return ALL_MOOD_TERMS.filter(t => present.has(t.id));
  }, [filterSource]);

  const availableFlavorTagTerms = useMemo(() => {
    const present = new Set<string>();
    for (const item of filterSource) {
      for (const t of item.flavorTags ?? []) present.add(t);
    }
    return ALL_FLAVOR_TAG_TERMS.filter(t => present.has(t.id));
  }, [filterSource]);

  // User Interaction State, persisted via Zustand store
  const { favoriteTeas, toggleFavoriteTea, compareItems, recentlyViewed, shopPriceWeight, setShopPriceWeight, shopSort, setShopSort, shopSavedOnly, setShopSavedOnly } = useAppStore();
  const userFavorites = useMemo(() => new Set(favoriteTeas), [favoriteTeas]);
  const [showCompare, setShowCompare] = useState(false);

  // Tasting journal, count how many times user has tasted each tea
  const tastingCounts = useTastingCounts();

  // Tasting term filter (cross-reference from AlcoveCard)
  const [tastingFilter, setTastingFilter] = useState<{ termId: string; categoryId: string } | null>(null);

  // URL ↔ filter round-trip. ?type=, ?region=, ?flavor=<termId> and
  // ?feel=<termId> are shareable entry points from product pages; clearing
  // filters in the UI also clears the URL so history behaves as expected.
  //
  // Type and region joined the set in round four. Until then the product page
  // wrote a breadcrumb pointing at ?type= and a "Same place" heading with
  // nowhere to send a reader, because the shop read four of its six facts out
  // of the address and silently dropped the two the product page had.
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const didHydrateFromUrl = useRef(false);

  // One-way hydration: on first render, seed state from the URL.
  useEffect(() => {
    if (didHydrateFromUrl.current) return;
    didHydrateFromUrl.current = true;
    const type = searchParams.get('type');
    const region = searchParams.get('region');
    const flavor = searchParams.get('flavor');
    const feel = searchParams.get('feel');
    const mood = searchParams.get('mood');
    const flavorTag = searchParams.get('flavorTag');
    if (type) setActiveType(displayType(type));
    if (region) setActiveRegion(regionKey(region));
    if (flavor) setTastingFilter({ termId: flavor, categoryId: 'flavor' });
    if (feel) setActiveFeeling(feel);
    if (mood) {
      const ids = mood.split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        setActiveMoodTags(ids);
        setMoodFlavorOpen(true); // auto-expand so user sees what's active
      }
    }
    if (flavorTag) {
      const ids = flavorTag.split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        setActiveFlavorTags(ids);
        setMoodFlavorOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse direction: whenever state changes after hydration, update the URL.
  // Skipped while the product modal route is displayed: writing search params
  // there would replace the modal entry and drop its background state; the
  // location.pathname dep re-runs the sync once the modal closes back to /shop.
  useEffect(() => {
    if (!didHydrateFromUrl.current) return;
    if (PRODUCT_PATH_RE.test(location.pathname)) return;
    const next = new URLSearchParams(searchParams);
    const flavorTerm = tastingFilter?.categoryId === 'flavor' ? tastingFilter.termId : null;
    if (activeType !== 'All') next.set('type', activeType);
    else next.delete('type');
    if (activeRegion) next.set('region', activeRegion);
    else next.delete('region');
    if (flavorTerm) next.set('flavor', flavorTerm);
    else next.delete('flavor');
    if (activeFeeling) next.set('feel', activeFeeling);
    else next.delete('feel');
    if (activeMoodTags.length > 0) next.set('mood', activeMoodTags.join(','));
    else next.delete('mood');
    if (activeFlavorTags.length > 0) next.set('flavorTag', activeFlavorTags.join(','));
    else next.delete('flavorTag');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, activeRegion, activeFeeling, tastingFilter, activeMoodTags, activeFlavorTags, location.pathname]);

  // A card tap is a real navigation to the product page. Recording a tea as
  // recently viewed moved there with it, because that is where a tea is opened
  // now.
  const { openProduct } = useProductModalRoute(inventory, modalLocation);

  const clearTastingFilter = useCallback(() => setTastingFilter(null), []);

  // Recently viewed items resolved from inventory

  /* The tasting session and the admin tasting editor used to open from the
     swipe card, which was their only door. Both live on the product page now,
     which is where a tea opens, so the grid no longer carries them. */

  // Filter Logic
  const filteredInventory = useMemo(() => {
    const searchLower = searchText.trim().toLowerCase();
    return filterSource.filter(item => {
      // 0. Search filter (case-insensitive substring on name)
      const matchSearch = !searchLower || item.name.toLowerCase().includes(searchLower);

      // 1. Basic Filter (Type/Feeling)
      const matchType = activeType === 'All' || displayType(item.type) === activeType;
      const matchFeeling = !activeFeeling || resolvedIncludes(item, 'feeling', activeFeeling);
      const matchRegion = !activeRegion || regionKey(item.origin) === activeRegion;

      // 2. Special Filter (Curated/Sale/Liked)
      let matchSpecial = true;
      if (specialFilter === 'Curated') matchSpecial = !!item.isFeatured;
      if (specialFilter === 'Sale') matchSpecial = SALE_ITEM_IDS.includes(item.id);
      if (specialFilter === 'Liked') matchSpecial = userFavorites.has(item.id);
      if (specialFilter === 'Tasted') matchSpecial = (tastingCounts.get(item.id) || 0) > 0;

      // 3. Tasting term filter (cross-reference)
      let matchTasting = true;
      if (tastingFilter) {
        if (tastingFilter.categoryId === 'mood') {
          // Mood filter: match against comma-separated mood field
          const itemMoods = (item.mood || '').split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
          matchTasting = itemMoods.includes(tastingFilter.termId);
        } else {
          const catKey = tastingFilter.categoryId as TastingCategoryId;
          if (resolvedIncludes(item, catKey, tastingFilter.termId)) {
            matchTasting = true;
          } else {
            // Fallback: check legacy tags
            matchTasting = item.tags.some(t => t.toLowerCase() === resolveTermLabel(tastingFilter.termId).toLowerCase());
          }
        }
      }

      // 4. Profile-level mood/flavor tag filters (AND across groups, OR within)
      const matchMoodTags =
        activeMoodTags.length === 0 ||
        activeMoodTags.some(m => (item.moodTags ?? []).includes(m));

      const matchFlavorTags =
        activeFlavorTags.length === 0 ||
        activeFlavorTags.some(f => (item.flavorTags ?? []).includes(f));

      // 5. Saved-only shop toggle
      const matchSaved = !shopSavedOnly || userFavorites.has(item.id);

      return matchSearch && matchType && matchFeeling && matchRegion && matchSpecial && matchTasting && matchMoodTags && matchFlavorTags && matchSaved;
    });
  }, [filterSource, searchText, activeType, activeFeeling, activeRegion, specialFilter, userFavorites, tastingFilter, shopSavedOnly, activeMoodTags, activeFlavorTags]);

  // Grouping & Sorting Logic
  const groupedInventory = useMemo(() => {
    const groups: Record<string, TeaItem[]> = {};
    
    filteredInventory.forEach(item => {
        const key = displayType(item.type);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
    });

    // Return groups in specific order, or just the active one if filtered
    const typesToShow = activeType === 'All' ? teaTypes : [activeType];

    return typesToShow
        .filter(type => groups[type] && groups[type].length > 0)
        .map(type => ({
            type,
            items: groups[type].sort((a, b) => {
                const priceA = parseFloat(a.price_per_gram || a.price_50g || '0');
                const priceB = parseFloat(b.price_per_gram || b.price_50g || '0');
                const tastedA = tastingCounts.get(a.id) || 0;
                const tastedB = tastingCounts.get(b.id) || 0;
                switch (shopSort) {
                    case 'price_asc':  return priceA - priceB;
                    case 'price_desc': return priceB - priceA;
                    case 'recent': {
                        const idxA = recentlyViewed.indexOf(a.id);
                        const idxB = recentlyViewed.indexOf(b.id);
                        if (idxA === -1 && idxB === -1) return 0;
                        if (idxA === -1) return 1;
                        if (idxB === -1) return -1;
                        return idxA - idxB;
                    }
                    case 'tasted': return tastedB - tastedA;
                    case 'featured':
                    default: {
                        const aFeat = a.isFeatured ? 1 : 0;
                        const bFeat = b.isFeatured ? 1 : 0;
                        if (aFeat !== bFeat) return bFeat - aFeat;
                        return priceA - priceB;
                    }
                }
            })
        }));
  }, [filteredInventory, activeType, teaTypes, shopSort, tastingCounts, recentlyViewed]);

  const handleFavoriteToggle = useCallback((itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavoriteTea(itemId);
  }, [toggleFavoriteTea]);

  // Add-to-cart confirmation feedback
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});
  const handleAddWithFeedback = (item: TeaItem, qty: number, total: number) => {
    if (onAddToCart) onAddToCart(item, qty, total);
    setAddedItems(prev => ({ ...prev, [item.id]: true }));
    setTimeout(() => setAddedItems(prev => ({ ...prev, [item.id]: false })), 1500);
  };

  const clearFilters = () => {
    setActiveType('All');
    setActiveFeeling(null);
    setActiveRegion(null);
    setSpecialFilter('None');
    setTastingFilter(null);
    setSearchText('');
    setActiveMoodTags([]);
    setActiveFlavorTags([]);
  };

  const handleTeaViewChange = (view: TeaShopView) => {
    setTeaView(view);
    setShowPast(false);
    setOpenFilter(null);
  };

  const handleFinderChoose = (intent: TeaFinderIntent) => {
    const nextFilter = applyFinderIntent(intent);
    setActiveType('All');
    setActiveRegion(null);
    setSpecialFilter('None');
    setSearchText('');
    setActiveMoodTags([]);
    setActiveFlavorTags([]);
    setMoodFlavorOpen(false);
    setShopSavedOnly(false);
    setOpenFilter(null);
    setShowPast(false);

    if (nextFilter?.categoryId === 'feeling') {
      setActiveFeeling(nextFilter.termId);
      setTastingFilter(null);
    } else if (nextFilter?.categoryId === 'flavor') {
      setActiveFeeling(null);
      setTastingFilter(nextFilter);
    } else {
      setActiveFeeling(null);
      setTastingFilter(null);
    }

    setTeaView('all');
  };

  return (
    <div className="w-full pb-32 animate-[fadeIn_0.5s_ease-out]">

      {/* The swipe-between-teas card used to open here. Tapping a tea is a real
          navigation to the product page now, one address with one rendering, so
          this never received an item again. Removed rather than left dark. */}
      {!hideHeader && (
        <PageHeader
          title="Tea Ledger"
          onCartClick={onCartClick}
          onAccountClick={onAccountClick}
          cartItemCount={cartItemCount}
        >
          <PageHeaderTabs
            tabs={[
              // Filter chip, not navigation. The id and the filter behind it
              // are untouched; only the word changes. It read "recommended",
              // which named a merchandising flag one person sets in the admin
              // panel as though it were a recommendation made to the reader.
              { id: 'Curated', label: 'On the Shelf' },
              { id: 'Sale', label: 'On Sale' },
              { id: 'Liked', label: 'My Likes' },
              { id: 'Tasted', label: 'Tasted' },
            ]}
            activeTab={specialFilter}
            onChange={(id) => setSpecialFilter(prev => prev === id ? 'None' : id as any)}
          />
        </PageHeader>
      )}

      {/* --- Inline Filter Bar + Content (full width) --- */}
      <div className="max-w-full mx-auto pt-4 px-3 md:px-4">

         <TeaShopViewTabs active={teaView} onChange={handleTeaViewChange} />
         <TeaShopViewRegion active={teaView} count={filteredInventory.length} showPast={showPast}>

         {teaView === 'find' ? (
           <div className="pt-6">
             <TeaFinder onChoose={handleFinderChoose} />
           </div>
         ) : (
           <>

         {/* Sticky shop toolbar.
             It rests on the underside of the page header rather than on the
             top of the viewport. Sticking at 0 put it on the same line as the
             header, which is also sticky and also full-bleed, so as soon as
             the page moved the two bands occupied the same 110px and one was
             drawn over the other: the tabs vanished behind Type / Place /
             Featured. The header publishes its own measured height as
             --page-header-h, and the fallback is 0 for any page that has no
             header to sit under. */}
         <div
           className="sticky z-dropdown -mx-3 px-3 md:-mx-4 md:px-4 bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border"
           style={{ top: 'calc(var(--page-header-h, 0px) + env(safe-area-inset-top, 0px))' }}
         >
           {/*
             One control band, not three. Search, price weight and the filters
             each owned a row of their own, which put 351px of chrome above the
             first tea on a 900px screen. They are one row now, wrapping rather
             than scrolling, so nothing is asked of the reader before the shop
             is visible.
           */}
           <div className="flex flex-wrap items-center gap-x-5 gap-y-0 py-1">
             {/* Filter group.
                 Full width on a phone so its trailing edge IS the row's
                 trailing edge, which is what lets the liked toggle pin itself
                 to the far right of this line rather than floating after the
                 last filter word. Natural width from sm up, where the whole
                 band is one line already. */}
             <div className="flex w-full items-center gap-3 sm:w-auto sm:shrink-0">
               <button
                 type="button"
                 onClick={() => setOpenFilter(prev => prev === 'type' ? null : 'type')}
                 className={`flex items-center gap-1.5 text-ui-10 uppercase tracking-[0.15em] min-h-[44px] shrink-0 transition-colors ${
                   activeType !== 'All' ? 'text-tea-gold' : openFilter === 'type' ? 'text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                 }`}
               >
                 <span>{activeType === 'All' ? 'Type' : activeType}</span>
                 <Icons.ChevronDown className={`w-3 h-3 transition-transform ${openFilter === 'type' ? 'rotate-180' : ''}`} aria-hidden="true" />
               </button>

               {(availableRegions.length > 1 || activeRegion) && (
                 <button
                   type="button"
                   onClick={() => setOpenFilter(prev => prev === 'place' ? null : 'place')}
                   className={`flex items-center gap-1.5 text-ui-10 uppercase tracking-[0.15em] min-h-[44px] shrink-0 transition-colors ${
                     activeRegion ? 'text-tea-gold' : openFilter === 'place' ? 'text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                   }`}
                 >
                   <span>{activeRegion ? regionLabel(activeRegion) : 'Place'}</span>
                   <Icons.ChevronDown className={`w-3 h-3 transition-transform ${openFilter === 'place' ? 'rotate-180' : ''}`} aria-hidden="true" />
                 </button>
               )}

               {availableFeelings.length > 0 && (
                 <button
                   type="button"
                   onClick={() => setOpenFilter(prev => prev === 'feeling' ? null : 'feeling')}
                   className={`flex items-center gap-1.5 text-ui-10 uppercase tracking-[0.15em] min-h-[44px] shrink-0 transition-colors ${
                     activeFeeling ? 'text-tea-gold' : openFilter === 'feeling' ? 'text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                   }`}
                 >
                   <span>{activeFeeling ? (FEELING_TERMS.find(f => f.id === activeFeeling)?.label || activeFeeling) : 'Feeling'}</span>
                   <Icons.ChevronDown className={`w-3 h-3 transition-transform ${openFilter === 'feeling' ? 'rotate-180' : ''}`} aria-hidden="true" />
                 </button>
               )}

               <button
                 type="button"
                 onClick={() => setOpenFilter(prev => prev === 'sort' ? null : 'sort')}
                 className={`flex items-center gap-1.5 text-ui-10 uppercase tracking-[0.15em] min-h-[44px] shrink-0 transition-colors ${
                   shopSort !== 'featured' ? 'text-tea-gold' : openFilter === 'sort' ? 'text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                 }`}
               >
                 <span>{SORT_OPTIONS.find(o => o.id === shopSort)?.label || 'Sort'}</span>
                 <Icons.ChevronDown className={`w-3 h-3 transition-transform ${openFilter === 'sort' ? 'rotate-180' : ''}`} aria-hidden="true" />
               </button>

               {/* Liked, as the mark itself.
                   It was the word LIKED at the end of the second line, which
                   cost that line about 60px and put a filter down among the
                   search field and the price basis, where it read as one more
                   piece of chrome rather than as a filter that is either on or
                   off. Up here it is the same heart the reader pressed on the
                   tea, at the far end of the row the other filters are in, and
                   it says its state three ways at once: filled, gold, and
                   sitting on a gold wash. That is smaller than the word and
                   easier to catch at a glance, which is the whole point of a
                   filter you can leave switched on by accident. */}
               <button
                 type="button"
                 onClick={() => setShopSavedOnly(!shopSavedOnly)}
                 aria-pressed={shopSavedOnly}
                 aria-label={shopSavedOnly ? 'Showing only liked teas. Show all teas' : 'Show only liked teas'}
                 title={shopSavedOnly ? 'Showing liked teas only' : 'Show liked teas only'}
                 /* The heart itself lands on the gutter, like the cart in the
                    bar above it.

                    It cannot be done the cart's way. The cart is a bare glyph,
                    so pulling its 44px box right moves the glyph and nothing
                    else; this one carries a visible gold chip when it is on,
                    and pulling that right would hang the chip past the line
                    instead. So the chip shrinks to hug the glyph and the tap
                    area leaves the layout: `after` is an invisible 52px pad
                    around a 28px control, which keeps the WCAG floor without
                    the control being 44px wide on screen. The remaining 6px of
                    chip padding is what the -mr-1.5 spends, so the heart's own
                    right edge is the line and only the wash overhangs it. */
                 className={`relative ml-auto -mr-1.5 inline-flex shrink-0 items-center justify-center rounded-md p-1.5 transition-colors after:absolute after:-left-3 after:-right-3 after:-top-3 after:-bottom-3 after:content-[''] sm:ml-1 ${
                   shopSavedOnly
                     ? 'bg-tea-gold/8 text-tea-gold'
                     : 'text-tea-text-sec hover:text-tea-text'
                 }`}
               >
                 <Icons.Heart className="w-4 h-4" filled={shopSavedOnly} aria-hidden="true" />
               </button>
             </div>

             <div className="flex w-full min-w-0 items-center gap-4 pb-0.5 sm:w-auto sm:flex-1 sm:justify-end sm:pb-0">
               <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-tea-surface px-3 py-1.5 sm:flex-none sm:w-[250px]">
                 <Icons.Search className="w-3.5 h-3.5 shrink-0 text-tea-text-dim" aria-hidden="true" />
                 <input
                   type="search"
                   value={searchText}
                   onChange={e => setSearchText(e.target.value)}
                   placeholder="Search teas"
                   aria-label="Search teas"
                   className="w-full min-w-0 bg-transparent text-tea-text text-sm placeholder:text-tea-text-dim outline-none"
                   style={{ fontFamily: 'var(--font-body)' }}
                 />
               </label>

               <div className="flex items-center gap-1.5 shrink-0">
                 <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec">Price</span>
                 <div className="flex items-center gap-0.5 border border-tea-border rounded-md overflow-hidden">
                   {([50, 100] as const).map(g => (
                     <button
                       key={g}
                       type="button"
                       onClick={() => setShopPriceWeight(g)}
                       className={`px-2 py-0.5 text-ui-10 uppercase tracking-wider transition-colors num ${
                         shopPriceWeight === g
                           ? 'bg-tea-gold/10 text-tea-gold'
                           : 'text-tea-text-sec hover:text-tea-text'
                       }`}
                     >
                       {g}g
                     </button>
                   ))}
                 </div>
               </div>
             </div>
           </div>

           {/* Inline-expanding options, flush below the toolbar, pushes content down */}
           {openFilter === 'type' && (
              <div className="flex flex-wrap gap-1.5 pb-3 animate-[fadeIn_0.15s_ease-out]">
                 <button
                    onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveType('All'); setOpenFilter(null); }}
                    className={`pill ${activeType === 'All' ? 'pill-active' : ''}`}
                 >
                    All
                 </button>
                 {teaTypes.map(t => (
                    <button
                       key={t}
                       onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveType(prev => prev === t ? 'All' : t); setOpenFilter(null); }}
                       className={`pill ${activeType === t ? 'pill-active' : ''}`}
                    >
                       {t}
                    </button>
                 ))}
              </div>
           )}
           {openFilter === 'place' && (
              <div className="flex flex-wrap gap-1.5 pb-3 animate-[fadeIn_0.15s_ease-out]">
                 <button
                    onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveRegion(null); setOpenFilter(null); }}
                    className={`pill ${activeRegion === null ? 'pill-active' : ''}`}
                 >
                    All
                 </button>
                 {availableRegions.map(region => (
                    <button
                       key={region.key}
                       onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveRegion(prev => prev === region.key ? null : region.key); setOpenFilter(null); }}
                       className={`pill ${activeRegion === region.key ? 'pill-active' : ''}`}
                    >
                       {region.label}
                    </button>
                 ))}
              </div>
           )}
           {openFilter === 'feeling' && (
              <div className="flex flex-wrap gap-1.5 pb-3 animate-[fadeIn_0.15s_ease-out]">
                 {activeFeeling && (
                    <button
                       onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveFeeling(null); setOpenFilter(null); }}
                       className="pill"
                    >
                       Clear
                    </button>
                 )}
                 {availableFeelings.map(f => (
                    <button
                       key={f.id}
                       onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveFeeling(prev => prev === f.id ? null : f.id); setOpenFilter(null); }}
                       className={`pill ${activeFeeling === f.id ? 'pill-active' : ''}`}
                    >
                       {f.label}
                    </button>
                 ))}
              </div>
           )}
           {openFilter === 'sort' && (
              <div className="flex flex-wrap gap-1.5 pb-3 animate-[fadeIn_0.15s_ease-out]">
                 {SORT_OPTIONS.map(o => (
                    <button
                       key={o.id}
                       onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setShopSort(o.id); setOpenFilter(null); }}
                       className={`pill ${shopSort === o.id ? 'pill-active' : ''}`}
                    >
                       {o.label}
                    </button>
                 ))}
              </div>
           )}
         </div>

         {/* The region's own chip is gone. It existed because a region could
             only arrive from a product page and had no control of its own, so
             the chip had to be both the announcement and the clear. Now that
             Place is a filter beside Type, the toolbar states the active place
             by name and clears it, and a second control for one filter is one
             control too many. */}

         {/* Active tasting filter chip (from AlcoveCard cross-reference) */}
         {tastingFilter && (() => {
            const Icon = resolveTermIcon(tastingFilter.termId);
            return (
               <div className="flex items-center gap-2 mb-3">
                  <button
                     onClick={clearTastingFilter}
                     className="tag cursor-pointer hover:opacity-80 transition-opacity"
                  >
                     <Icon size={11} />
                     <span>{resolveTermLabel(tastingFilter.termId)}</span>
                     <X size={11} />
                  </button>
               </div>
            );
         })()}

         {/* Mood and flavor tag filter, collapsible, editorial chip rows */}
         {(availableMoodTagTerms.length > 0 || availableFlavorTagTerms.length > 0) && (
           <div className="mb-4 border-b border-tea-border pb-3">
             <div className="flex flex-col gap-0.5">
               <button
                 type="button"
                 onClick={() => setMoodFlavorOpen(p => !p)}
                 className={`flex items-center gap-1.5 text-ui-10 uppercase tracking-[0.15em] min-h-[44px] transition-colors w-fit ${
                   (activeMoodTags.length > 0 || activeFlavorTags.length > 0)
                     ? 'text-tea-gold'
                     : moodFlavorOpen
                       ? 'text-tea-text'
                       : 'text-tea-text-sec hover:text-tea-text'
                 }`}
               >
                 <span>
                   {(activeMoodTags.length > 0 || activeFlavorTags.length > 0)
                     ? `Mood and flavor (${activeMoodTags.length + activeFlavorTags.length})`
                     : 'Shop by mood and flavor'}
                 </span>
                 <Icons.ChevronDown className={`w-3 h-3 transition-transform ${moodFlavorOpen ? 'rotate-180' : ''}`} />
               </button>
               <span className="text-ui-10 text-tea-text-dim">Find teas by the feeling or taste you&apos;re looking for</span>
             </div>

             {moodFlavorOpen && (
               <div className="mt-3 space-y-4 animate-[fadeIn_0.15s_ease-out]">
                 {availableMoodTagTerms.length > 0 && (
                   <div>
                     <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim mb-2">Mood</p>
                     <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                       {availableMoodTagTerms.map(term => {
                         const isActive = activeMoodTags.includes(term.id);
                         const termInfo = TERM_MAP.get(term.id);
                         const Icon = termInfo?.icon;
                         return (
                           <button
                             key={term.id}
                             type="button"
                             onClick={() => {
                               if ('vibrate' in navigator) navigator.vibrate?.(10);
                               setActiveMoodTags(prev =>
                                 prev.includes(term.id) ? prev.filter(id => id !== term.id) : [...prev, term.id]
                               );
                             }}
                             className={[
                               'flex items-center gap-1 text-ui-11 transition-colors py-0.5',
                               'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold/50 rounded-md',
                               isActive
                                 ? 'text-tea-text border-b border-tea-gold/60'
                                 : 'text-tea-text-dim hover:text-tea-text-sec border-b border-transparent',
                             ].join(' ')}
                             style={{ fontFamily: 'var(--font-body)' }}
                           >
                             {Icon && (
                               <Icon
                                 size={10}
                                 className={isActive ? 'text-tea-gold/70' : 'text-tea-text-dim'}
                                 aria-hidden="true"
                               />
                             )}
                             <span>{term.label}</span>
                           </button>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {availableFlavorTagTerms.length > 0 && (
                   <div>
                     <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim mb-2">Flavor</p>
                     <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                       {availableFlavorTagTerms.map(term => {
                         const isActive = activeFlavorTags.includes(term.id);
                         const termInfo = TERM_MAP.get(term.id);
                         const Icon = termInfo?.icon;
                         return (
                           <button
                             key={term.id}
                             type="button"
                             onClick={() => {
                               if ('vibrate' in navigator) navigator.vibrate?.(10);
                               setActiveFlavorTags(prev =>
                                 prev.includes(term.id) ? prev.filter(id => id !== term.id) : [...prev, term.id]
                               );
                             }}
                             className={[
                               'flex items-center gap-1 text-ui-11 transition-colors py-0.5',
                               'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold/50 rounded-md',
                               isActive
                                 ? 'text-tea-text border-b border-tea-gold/60'
                                 : 'text-tea-text-dim hover:text-tea-text-sec border-b border-transparent',
                             ].join(' ')}
                             style={{ fontFamily: 'var(--font-body)' }}
                           >
                             {Icon && (
                               <Icon
                                 size={10}
                                 className={isActive ? 'text-tea-gold/70' : 'text-tea-text-dim'}
                                 aria-hidden="true"
                               />
                             )}
                             <span>{term.label}</span>
                           </button>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {(activeMoodTags.length > 0 || activeFlavorTags.length > 0) && (
                   <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                     <p className="text-ui-11 italic text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>
                       Showing {filteredInventory.length} {filteredInventory.length === 1 ? 'tea' : 'teas'}.
                       {' '}Filtered by:{' '}
                       {[...activeMoodTags, ...activeFlavorTags]
                         .map(id => resolveTermLabel(id))
                         .join(', ')}
                       .
                     </p>
                     <button
                       type="button"
                       onClick={() => { setActiveMoodTags([]); setActiveFlavorTags([]); }}
                       className="text-ui-10 text-tea-text-sec hover:text-tea-text transition-colors underline shrink-0"
                       style={{ fontFamily: 'var(--font-body)' }}
                     >
                       Clear
                     </button>
                   </div>
                 )}
               </div>
             )}
           </div>
         )}

         {/* Main content area (full width now) */}
         <div className="w-full">

           {filteredInventory.length === 0 ? (
             <div className="py-24 text-center">
               <p className={`${BODY} italic text-tea-text-sec mb-3`}>
                 {showPast
                   ? 'No past teas match these filters.'
                   : teaView === 'selection'
                     ? 'My selection is still taking shape.'
                     : 'Nothing matched. Try different filters.'}
               </p>
               <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-ui-12">
                 {(showPast || teaView === 'selection') && (
                   <button
                     type="button"
                     onClick={() => {
                       setShowPast(false);
                       setTeaView('all');
                     }}
                     className={`${LINK} tap-target text-ui-12 text-tea-text-sec`}
                   >
                     All teas
                   </button>
                 )}
                 <button
                   type="button"
                   onClick={clearFilters}
                   className={`${LINK} tap-target text-ui-12 text-tea-text-sec`}
                 >
                   Clear all filters
                 </button>
                 <button
                   type="button"
                   onClick={() => handleTeaViewChange('find')}
                   className={`${LINK} tap-target text-ui-12 text-tea-text-sec`}
                 >
                   Find a tea
                 </button>
               </div>
             </div>
           ) : (
             <TeaLedger
               groups={groupedInventory}
               activeType={activeType}
               specialFilter={specialFilter}
               tastingCounts={tastingCounts}
               priceWeight={shopPriceWeight}
               formatPrice={shopPrice.total}
               favoriteIds={userFavorites}
               onToggleFavorite={handleFavoriteToggle}
               onOpenProduct={openProduct}
               isAdmin={isAdmin}
               onAdminEdit={onAdminEdit}
             />
           )}

           {/* The archive link is gone at Adrian's word. `showPast` stays wired
               so the sold-out view can be reached again from one line, and so
               the empty state can still offer a way back out of it. */}
         </div>
           </>
         )}
         </TeaShopViewRegion>
      </div>


      {/* Floating Compare Button */}
      {compareItems.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-sticky animate-[fadeIn_0.3s_ease-out]">
          <button
            onClick={() => setShowCompare(true)}
            className="flex items-center gap-2 px-5 py-2.5 cta-solid text-xs uppercase tracking-[0.1em] font-medium rounded-md shadow-lg transition-all active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="18" rx="1" />
              <rect x="14" y="3" width="7" height="18" rx="1" />
            </svg>
            <span>Compare ({compareItems.length})</span>
          </button>
        </div>
      )}

      {/* Compare Overlay */}
      {showCompare && (
        <CompareView
          items={inventory.filter((item) => compareItems.includes(item.id))}
          onClose={() => setShowCompare(false)}
        />
      )}

    </div>
  );
};
