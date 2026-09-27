/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * PlateRow, the photo-essay row of a hand-built Read story.
 *
 * The set + order of plates lives in the story-edit draft (`plates`), defaulting
 * to the coded initial plates. In edit mode the owner can drag a plate to
 * reorder, add a new empty plate, or remove one. Each plate is an EditablePhoto,
 * so the same drag-drop / focal / paste / caption editing applies per frame.
 */
import React, { useMemo, useState } from 'react';
import EditablePhoto from './EditablePhoto';
import { useStoryEdit } from './storyEdit';

const grain = (o: string, n: number): React.CSSProperties => ({
  position: 'absolute', inset: 0,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${n}' height='${n}'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='${o}'/%3E%3C/svg%3E")`,
  opacity: 0.5,
});

export interface PlateDef {
  slot: string;
  alt: string;
  label: string;
  caption: string;
  captionField: string;
}

const PlateRow: React.FC<{ initial: PlateDef[] }> = ({ initial }) => {
  const { isOwner, editing, previewVisitor, plates, setPlates } = useStoryEdit();
  const liveEdit = isOwner && editing && !previewVisitor;
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // The effective list of slots: the draft's order if set, else the coded order.
  const order: string[] = plates && plates.length ? plates : initial.map((p) => p.slot);

  // Resolve each slot to its definition (coded defaults; added plates get a
  // generated def so a brand-new frame still has alt/label/captionField).
  const defs = useMemo(() => {
    const bySlot = new Map(initial.map((p) => [p.slot, p]));
    return order.map((slot, i): PlateDef => {
      const found = bySlot.get(slot);
      if (found) return found;
      const n = i + 1;
      return { slot, alt: `Photo ${n}`, label: `Plate ${n}`, caption: '', captionField: `cap-${slot}` };
    });
  }, [order, initial]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setPlates(next);
  };

  const addPlate = () => {
    const id = `plate-extra-${Date.now().toString(36)}`;
    setPlates([...order, id]);
  };

  const removePlate = (slot: string) => {
    setPlates(order.filter((s) => s !== slot));
  };

  return (
    <section data-reveal style={{ padding: 'clamp(20px,4vw,40px) clamp(20px,5vw,56px) clamp(40px,6vw,72px)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 'clamp(14px,2.4vw,26px)', maxWidth: 1180, margin: '0 auto' }}>
        {defs.map((p, i) => (
          <div
            key={p.slot}
            draggable={liveEdit}
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => { if (liveEdit && dragIdx !== null) e.preventDefault(); }}
            onDrop={() => { if (liveEdit && dragIdx !== null && dragIdx !== i) move(dragIdx, i); setDragIdx(null); }}
            style={{ position: 'relative', opacity: dragIdx === i ? 0.5 : 1 }}
          >
            {liveEdit && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tj-read-dim)', cursor: 'grab' }}>
                  ⠿ drag to reorder
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button type="button" aria-label="Move left" onClick={() => move(i, i - 1)} disabled={i === 0}
                    style={{ minWidth: 40, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: i === 0 ? 'var(--tj-read-dim)' : 'var(--tj-gold, var(--tj-read-gold-default))', cursor: i === 0 ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 18 }}>‹</button>
                  <button type="button" aria-label="Move right" onClick={() => move(i, i + 1)} disabled={i === defs.length - 1}
                    style={{ minWidth: 40, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: i === defs.length - 1 ? 'var(--tj-read-dim)' : 'var(--tj-gold, var(--tj-read-gold-default))', cursor: i === defs.length - 1 ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 18 }}>›</button>
                  <button type="button" onClick={() => removePlate(p.slot)}
                    style={{ minHeight: 40, padding: '0 8px', background: 'transparent', border: 'none', color: 'var(--tj-read-dim)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>remove</button>
                </div>
              </div>
            )}
            <EditablePhoto
              slot={p.slot}
              alt={p.alt}
              label={p.label}
              caption={p.caption}
              captionField={p.captionField}
              placeholder={<div aria-hidden="true" style={grain('0.8', 120)} />}
            />
          </div>
        ))}

        {liveEdit && (
          <button
            type="button"
            onClick={addPlate}
            style={{
              aspectRatio: '4/5',
              border: '1px dashed rgb(var(--tj-read-gold-rgb) / 0.4)',
              borderRadius: 3,
              background: 'transparent',
              color: 'var(--tj-gold, var(--tj-read-gold-default))',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            + add photo
          </button>
        )}
      </div>
    </section>
  );
};

export default PlateRow;
