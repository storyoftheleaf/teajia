import React, { useRef, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TEAWARE_CATEGORIES, TEAWARE_MATERIALS, TEAWARE_ERAS, YIXING_CLAY_TYPES, MATERIAL_ORIGIN_DEFAULT } from '../TeaCompass/types';
import type { TeaCompassEntry, TeawareMaterial, YixingClayType } from '../TeaCompass/types';

/** The Source form's teaware pickers (category, material, clay, era) as
 *  bottom sheets, with their choice handlers. Moved out of
 *  TeaCompass/CaptureCard.tsx unchanged so that file could stop growing; the
 *  open state stays with the form, whose fields open these sheets. */
export function TeawareSheets({
  entry, update, isYixing, effectiveClayType,
  categoryPopoverOpen, setCategoryPopoverOpen, materialPopoverOpen, setMaterialPopoverOpen,
  claySheetOpen, setClaySheetOpen, eraSheetOpen, setEraSheetOpen,
  categorySheetId, materialSheetId, eraSheetId,
}: {
  entry: TeaCompassEntry;
  update: (updates: Record<string, unknown>) => void;
  isYixing: boolean;
  effectiveClayType: YixingClayType | undefined;
  categoryPopoverOpen: boolean; setCategoryPopoverOpen: (open: boolean) => void;
  materialPopoverOpen: boolean; setMaterialPopoverOpen: (open: boolean) => void;
  claySheetOpen: boolean; setClaySheetOpen: (open: boolean) => void;
  eraSheetOpen: boolean; setEraSheetOpen: (open: boolean) => void;
  categorySheetId: string; materialSheetId: string; eraSheetId: string;
}) {
  const customEras = useTeaCompassStore((s) => s.customEras);
  const addCustomEra = useTeaCompassStore((s) => s.addCustomEra);
  // Inside the era sheet: shows the "+ Add era" input row
  const [eraInputOpen, setEraInputOpen] = useState(false);
  const [eraInputValue, setEraInputValue] = useState('');
  const eraInputRef = useRef<HTMLInputElement>(null);
  const materials = TEAWARE_MATERIALS[entry.teawareCategory || ''] || TEAWARE_MATERIALS.default;

  const handleMaterialPick = (mat: TeawareMaterial) => {
    // Both Yixing and generic Clay drill into the clay-subtype sheet so
    // the user can pick from the canonical clay names (Zhuni, Hongni, …)
    // regardless of vessel category. The material itself is committed
    // here so handleClayPick can read entry.material to know which one.
    if (mat === 'Yixing' || mat === 'Clay') {
      const sameParent = entry.material === mat || (mat === 'Yixing' && isYixing);
      const updates: Record<string, unknown> = {
        material: mat,
        // Reopening the active material is navigation, not a destructive
        // change. Keep its selected clay until the user clears or replaces it.
        clayType: sameParent ? effectiveClayType : undefined,
      };
      const originDefault = MATERIAL_ORIGIN_DEFAULT[mat];
      if (originDefault && !entry.originRegion) {
        updates.originRegion = originDefault;
      }
      update(updates);
      // Hand off from the Material sheet → Clay sheet. Close-then-open
      // keeps Vaul's focus management from fighting two open sheets.
      setMaterialPopoverOpen(false);
      setTimeout(() => setClaySheetOpen(true), 220);
      return;
    }
    const same = entry.material === mat;
    const updates: Record<string, unknown> = {
      material: same ? undefined : mat,
      clayType: undefined,
    };
    const originDefault = MATERIAL_ORIGIN_DEFAULT[mat];
    if (!same && originDefault && !entry.originRegion) {
      updates.originRegion = originDefault;
    }
    update(updates);
    setMaterialPopoverOpen(false);
  };

  const handleClayPick = (clay: YixingClayType) => {
    const sameClay = effectiveClayType === clay;
    // Preserve the parent material the user chose (Yixing vs generic Clay)
    //, if entry.material is anything else, default to Yixing for the
    // legacy rollup behaviour.
    const parentMaterial: TeawareMaterial = entry.material === 'Clay' ? 'Clay' : 'Yixing';
    const updates: Record<string, unknown> = {
      material: parentMaterial,
      clayType: sameClay ? undefined : clay,
    };
    if (parentMaterial === 'Yixing' && !entry.originRegion && MATERIAL_ORIGIN_DEFAULT.Yixing) {
      updates.originRegion = MATERIAL_ORIGIN_DEFAULT.Yixing;
    }
    update(updates);
    setClaySheetOpen(false);
    setMaterialPopoverOpen(false);
  };

  const handleEraPick = (eraName: string) => {
    update({ era: entry.era === eraName ? undefined : eraName });
    setEraSheetOpen(false);
    setEraInputOpen(false);
    setEraInputValue('');
  };

  const commitCustomEra = () => {
    const trimmed = eraInputValue.trim();
    if (!trimmed) return;
    addCustomEra(trimmed);
    update({ era: trimmed });
    setEraInputValue('');
    setEraInputOpen(false);
    setEraSheetOpen(false);
  };

  const allEras: string[] = [...TEAWARE_ERAS, ...customEras.filter((e) => !TEAWARE_ERAS.includes(e))];

  return (
    <>
      {/* Category, material, clay and era sheets remain specialist
          subflows; the working canvas only carries their selected values. */}

      {/* Category, opens as a bottom sheet (Vaul) so the picker has
          full thumb access at the bottom of the screen and never clips
          against narrow viewports the way the old anchored popover did. */}
      <BottomSheet
        open={categoryPopoverOpen}
        onOpenChange={setCategoryPopoverOpen}
        title="Category"
        description="What kind of teaware is this?"
      >
        <div id={categorySheetId} className="flex flex-col gap-0.5 px-1">
          {TEAWARE_CATEGORIES.map((cat) => (
            <SheetOption
              key={cat}
              label={cat}
              selected={entry.teawareCategory === cat}
              onSelect={() => {
                const updates: Record<string, unknown> = { teawareCategory: cat };
                if (entry.teawareCategory !== cat) {
                  updates.material = undefined;
                  updates.clayType = undefined;
                }
                update(updates);
                setCategoryPopoverOpen(false);
              }}
            />
          ))}
        </div>
      </BottomSheet>

      {/* Era, bottom sheet. Includes "+ Add new era" affordance at the
          bottom for user-defined entries (Song Dynasty, etc.). */}
      <BottomSheet
        open={eraSheetOpen}
        onOpenChange={(open) => {
          setEraSheetOpen(open);
          if (!open) { setEraInputOpen(false); setEraInputValue(''); }
        }}
        title="Era"
        description="When was this piece made?"
      >
        <div id={eraSheetId} className="flex flex-col gap-0.5 px-1">
          {allEras.map((eraName) => (
            <SheetOption
              key={eraName}
              label={eraName}
              selected={entry.era === eraName}
              onSelect={() => handleEraPick(eraName)}
            />
          ))}
          <div className="border-t border-tea-border my-2" />
          {eraInputOpen ? (
            <div className="flex items-center gap-2 px-3 py-2">
              <input
                ref={eraInputRef}
                type="text"
                value={eraInputValue}
                autoFocus
                onChange={(e) => setEraInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitCustomEra(); }
                  if (e.key === 'Escape') { setEraInputOpen(false); setEraInputValue(''); }
                }}
                placeholder="e.g. Song Dynasty"
                className="min-h-11 flex-1 min-w-0 bg-tea-surface text-tea-text text-base rounded-md px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none placeholder:text-tea-text-dim"
              />
              <button
                type="button"
                onClick={commitCustomEra}
                disabled={!eraInputValue.trim()}
                className="curate-action shrink-0 rounded-md cta-solid px-3 font-medium disabled:opacity-40"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEraInputOpen(true)}
              className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-medium text-tea-gold hover:bg-tea-gold/[0.08] transition-colors"
            >
              <Plus size={16} />
              Add new era
            </button>
          )}
        </div>
      </BottomSheet>

      {/* Material, bottom sheet. Yixing and Clay both display a chevron
          and drill into the full-screen Clay sheet rendered below. */}
      <BottomSheet
        open={materialPopoverOpen}
        onOpenChange={setMaterialPopoverOpen}
        title="Material"
        description={entry.teawareCategory ? `For ${entry.teawareCategory}` : undefined}
      >
        <div id={materialSheetId} className="flex flex-col gap-0.5 px-1">
          {materials.map((mat) => {
            const isSelected = entry.material === mat || (mat === 'Yixing' && isYixing);
            const hasSubtypes = mat === 'Yixing' || mat === 'Clay';
            return (
              <SheetOption
                key={mat}
                label={mat}
                selected={isSelected}
                hasSubflow={hasSubtypes}
                onSelect={() => handleMaterialPick(mat)}
              />
            );
          })}
        </div>
      </BottomSheet>

      {/* Clay subtype, full-height sheet with photographic swatches.
          Falls back to a colour disk when no imageUrl is set yet. */}
      <BottomSheet
        open={claySheetOpen}
        onOpenChange={setClaySheetOpen}
        title={entry.material === 'Clay' ? 'Clay subtype' : 'Yixing clay'}
        description="Pick the clay this piece is made from"
        large
      >
        <div className="space-y-2 p-2">
          <div className="grid grid-cols-2 gap-2.5">
          {YIXING_CLAY_TYPES.map((clay) => {
            const sel = effectiveClayType === clay.name;
            return (
              <button
                key={clay.name}
                type="button"
                onClick={() => handleClayPick(clay.name)}
                aria-pressed={sel}
                className={`group relative flex flex-col items-start gap-2 p-3 rounded-xl border transition-all duration-200 text-left ${
                  sel
                    ? 'border-tea-gold/60 bg-tea-gold/[0.10]'
                    : 'border-tea-border bg-tea-elevated/40 hover:border-tea-gold/40 hover:bg-tea-gold/[0.05]'
                }`}
                style={
                  sel
                    ? {
                        boxShadow:
                          'inset 0 1px 0 rgb(var(--tea-gold-rgb) / 0.2), 0 0 18px -4px rgb(var(--tea-gold-rgb) / 0.25)',
                      }
                    : undefined
                }
              >
                {/* Swatch, image when provided, else a richly-shaded
                    circular disk with a soft inner highlight so the colour
                    reads as a fired clay surface, not a flat dot. */}
                <div
                  className="relative w-full aspect-square rounded-xl overflow-hidden border border-tea-border shrink-0"
                  style={
                    clay.imageUrl
                      ? undefined
                      : {
                          background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${clay.swatch} 78%, white 22%), ${clay.swatch} 62%, color-mix(in srgb, ${clay.swatch} 70%, black 30%) 100%)`,
                        }
                  }
                >
                  {clay.imageUrl && (
                    <img
                      src={clay.imageUrl}
                      alt={clay.label}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {sel && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-tea-gold flex items-center justify-center">
                      <Check size={12} strokeWidth={3} className="text-tea-bg" />
                    </span>
                  )}
                </div>
                <div className="w-full min-w-0">
                  <div
                    className={`font-sans text-base truncate ${sel ? 'text-tea-gold font-medium' : 'text-tea-text font-medium'}`}
                  >
                    {clay.label}
                  </div>
                  {clay.hint && (
                    <div className="curate-support mt-0.5 truncate text-tea-text-sec">{clay.hint}</div>
                  )}
                </div>
              </button>
            );
          })}
          </div>
          {effectiveClayType && (
            <button
              type="button"
              onClick={() => {
                update({ material: entry.material === 'Clay' ? 'Clay' : 'Yixing', clayType: undefined });
                setClaySheetOpen(false);
              }}
              className="tap-target min-h-11 w-full text-ui-12 text-tea-text-sec hover:text-tea-text"
            >
              Clear clay subtype
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
