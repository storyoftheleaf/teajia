import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '../shared/Button';
import { VendorFace } from './VendorFace';
import { VendorFaceAdjustButton, VendorFacePhotoButton } from './VendorFacePhotoButton';
import {
  orderFaceVendors,
  restoreVendorFace,
  saveVendorFace,
  suggestVendorForFile,
  useRefreshVendorFaces,
  type FaceVendor,
  type LooseFace,
} from './vendorFaces';
import { looksLikePhoto, prepareFacePhoto } from './facePhotoFile';

/**
 * Every vendor as a face, in People > Suppliers. Tap a face for the vendor's
 * page (contacts, teas, purchases); the camera on each tile adds or changes
 * the face photo there and then, and the crop beside it reframes the photo
 * already there (crop in, drag, zoom) in the shared photo editor, so the
 * gallery fills in and tidies up as Adrian goes. Placed and picked photos
 * open centred on the face.
 *
 * Placing faces: drop a batch of photos on the page (or "Add photos to
 * place"), and they wait in a tray above the vendors. Drag one onto a vendor,
 * or tap it and then tap the vendor, and it is saved as that vendor's face.
 * The last placement can be undone. A face whose file name names a vendor
 * rings that vendor while it is picked up.
 *
 * Takes the list the Suppliers tab has already searched and filtered, so the
 * search box and "need info" filter work here too.
 */

interface Placed { vendorId: string; vendorName: string; previous: string | null; face: LooseFace }

let faceKeySeq = 0;
const FACE_DRAG_TYPE = 'application/x-teajia-face';

export const VendorFaceGallery: React.FC<{ vendors: FaceVendor[] }> = ({ vendors }) => {
  const { withPhoto, withoutPhoto } = useMemo(() => orderFaceVendors(vendors), [vendors]);
  const missingFaces = vendors.filter(v => !v.hasFace).length;
  const refresh = useRefreshVendorFaces();

  const [loose, setLoose] = useState<LooseFace[]>([]);
  const [held, setHeld] = useState<string | null>(null);
  const [savingOn, setSavingOn] = useState<string | null>(null);
  const [overVendor, setOverVendor] = useState<string | null>(null);
  const [pageDrop, setPageDrop] = useState(false);
  const [last, setLast] = useState<Placed | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const looseRef = useRef(loose);
  looseRef.current = loose;

  useEffect(() => () => { looseRef.current.forEach(f => URL.revokeObjectURL(f.preview)); }, []);

  const [reading, setReading] = useState(0);
  const addFiles = useCallback(async (files: FileList | File[] | null | undefined) => {
    const photos = Array.from(files ?? []).filter(looksLikePhoto);
    if (photos.length === 0) return;
    setError('');
    setReading(n => n + photos.length);
    const unreadable: string[] = [];
    for (const photo of photos) {
      try {
        const file = await prepareFacePhoto(photo);
        setLoose(prev => [...prev, { key: `face-${++faceKeySeq}`, file, preview: URL.createObjectURL(file) }]);
      } catch {
        unreadable.push(photo.name);
      } finally {
        setReading(n => n - 1);
      }
    }
    if (unreadable.length) setError(`Couldn't open ${unreadable.join(', ')}. Try saving it as a JPEG and dropping it again.`);
  }, []);

  const removeLoose = (key: string) => {
    setLoose(prev => {
      const face = prev.find(f => f.key === key);
      if (face) URL.revokeObjectURL(face.preview);
      return prev.filter(f => f.key !== key);
    });
    if (held === key) setHeld(null);
  };

  const heldFace = loose.find(f => f.key === held);
  const hint = heldFace ? suggestVendorForFile(heldFace.file.name, vendors) : undefined;

  const place = async (faceKey: string, vendor: FaceVendor) => {
    const face = loose.find(f => f.key === faceKey);
    if (!face || !vendor.id || savingOn) return;
    setSavingOn(vendor.id);
    setError('');
    try {
      await saveVendorFace(vendor.id, face.file);
      // The tray keeps the preview alive until the undo window has passed.
      if (last) URL.revokeObjectURL(last.face.preview);
      setLast({ vendorId: vendor.id, vendorName: vendor.name, previous: vendor.hasFace ? vendor.photo ?? null : null, face });
      setLoose(prev => prev.filter(f => f.key !== faceKey));
      setHeld(null);
      refresh(vendor.id);
    } catch {
      setError(`That face didn't save on ${vendor.name}. Check the connection and try again; the photo is still in the tray.`);
    } finally {
      setSavingOn(null);
    }
  };

  const undo = async () => {
    if (!last || savingOn) return;
    setSavingOn(last.vendorId);
    setError('');
    try {
      await restoreVendorFace(last.vendorId, last.previous);
      setLoose(prev => [last.face, ...prev]);
      setLast(null);
      refresh(last.vendorId);
    } catch {
      setError(`The undo didn't save. ${last.vendorName} still has the new face.`);
    } finally {
      setSavingOn(null);
    }
  };

  const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const isFaceDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes(FACE_DRAG_TYPE);

  if (vendors.length === 0) {
    return <p className="px-4 py-8 text-center text-ui-13 text-tea-text-sec">No vendors match.</p>;
  }

  const placing = loose.length > 0;

  const tileBody = (v: FaceVendor) => (
    <>
      <span className="relative block">
        <VendorFace
          name={v.name}
          photo={v.photo}
          shape="tile"
          className={overVendor === v.id || hint?.id === v.id ? 'border-tea-gold ring-2 ring-tea-gold/60' : 'group-hover:border-tea-gold'}
        />
        {savingOn === v.id && (
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-tea-bg/60">
            <Loader2 size={22} className="animate-spin text-tea-gold" aria-label="Saving" />
          </span>
        )}
      </span>
      <span className="mt-1.5 block truncate text-ui-14 text-tea-text">{v.name}</span>
      <span className="block truncate text-ui-12 text-tea-text-sec">{[v.company, v.country].filter(Boolean).join(' · ') || 'Vendor'}</span>
    </>
  );

  const tile = (v: FaceVendor) => (
    <li
      key={v.id ?? v.name}
      className="relative"
      data-testid={v.id ? `face-tile-${v.id}` : undefined}
      onDragOver={v.id ? e => { if (isFaceDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOverVendor(v.id!); } } : undefined}
      onDragLeave={v.id ? () => setOverVendor(cur => (cur === v.id ? null : cur)) : undefined}
      onDrop={v.id ? e => {
        const key = e.dataTransfer.getData(FACE_DRAG_TYPE);
        if (!key) return;
        e.preventDefault();
        e.stopPropagation();
        setOverVendor(null);
        void place(key, v);
      } : undefined}
    >
      {v.id && heldFace ? (
        <Button
          variant="plain"
          type="button"
          onClick={() => void place(heldFace.key, v)}
          className="group block w-full text-left rounded-xl p-1.5 transition-colors hover:bg-tea-accent-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
          aria-label={`Make this ${v.name}'s face`}
        >
          {tileBody(v)}
        </Button>
      ) : v.id ? (
        <Link to={`/admin/vendors/${v.id}`} className="group block rounded-xl p-1.5 transition-colors hover:bg-tea-accent-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50">
          {tileBody(v)}
        </Link>
      ) : (
        <div className="p-1.5">{tileBody(v)}</div>
      )}
      {v.id && !heldFace && (
        <span className="absolute top-3 right-3 flex gap-1.5">
          {v.photo && <VendorFaceAdjustButton vendorId={v.id} vendorName={v.name} photo={v.photo} look="badge" />}
          <VendorFacePhotoButton vendorId={v.id} vendorName={v.name} hasFace={v.hasFace} look="badge" />
        </span>
      )}
    </li>
  );

  const grid = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2';
  return (
    <div
      className={`px-3 md:px-2 py-4 space-y-5 pb-nav-gap md:pb-6 ${pageDrop ? 'outline-dashed outline-2 outline-tea-gold rounded-xl' : ''}`}
      data-testid="vendor-face-gallery"
      onDragOver={e => { if (isFileDrag(e)) { e.preventDefault(); setPageDrop(true); } }}
      onDragLeave={e => { if (e.currentTarget === e.target) setPageDrop(false); }}
      onDrop={e => { if (isFileDrag(e)) { e.preventDefault(); setPageDrop(false); void addFiles(e.dataTransfer.files); } }}
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={e => { const picked = Array.from(e.target.files ?? []); e.target.value = ''; void addFiles(picked); }}
      />

      <section
        className={`space-y-2 ${placing ? 'sticky top-0 z-10 -mx-3 md:-mx-2 px-3 md:px-2 py-3 bg-tea-bg border-b border-tea-border' : ''}`}
        aria-label="Faces to place"
        data-testid="face-tray"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1.5">
          {placing ? (
            <p className="text-ui-13 text-tea-text-sec flex-1 min-w-0">
              {loose.length === 1 ? 'One face' : `${loose.length} faces`} to place. Drag a face onto its vendor, or tap the face and then the vendor.
            </p>
          ) : (
            <p className="text-ui-13 text-tea-text-sec flex-1 min-w-0">
              {missingFaces > 0
                ? `${missingFaces === 1 ? 'One vendor has' : `${missingFaces} vendors have`} no face photo yet. Drop a batch of photos here to place them, or tap the camera on a tile to add one.`
                : 'Drop a batch of photos here to place them on vendors.'}
            </p>
          )}
          <Button type="button" variant="secondary" size="sm" icon={<ImagePlus size={14} strokeWidth={1.5} />} onClick={() => fileInput.current?.click()}>
            Add photos to place
          </Button>
        </div>

        {!placing && (
          <Button
            variant="plain"
            type="button"
            onClick={() => fileInput.current?.click()}
            className="mx-1.5 flex w-[calc(100%-0.75rem)] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-tea-border px-4 py-8 text-center text-tea-text-sec transition-colors hover:border-tea-gold hover:text-tea-text"
            data-testid="face-drop-zone"
          >
            <ImagePlus size={28} strokeWidth={1.25} aria-hidden="true" />
            <span className="text-ui-14 text-tea-text">Drop face photos here, or tap to choose them</span>
            <span className="text-ui-12">They wait here, then you drag each one onto its vendor below.</span>
          </Button>
        )}

        {placing && (
          <ul className="flex flex-wrap gap-3 px-1.5 pt-2 pr-3 max-h-64 overflow-y-auto">
            {loose.map(face => (
              <li key={face.key} className="relative">
                <Button
                  variant="plain"
                  type="button"
                  draggable
                  onDragStart={e => { e.dataTransfer.setData(FACE_DRAG_TYPE, face.key); e.dataTransfer.effectAllowed = 'copy'; setHeld(face.key); }}
                  onDragEnd={() => setOverVendor(null)}
                  onClick={() => setHeld(cur => (cur === face.key ? null : face.key))}
                  aria-pressed={held === face.key}
                  aria-label={`Face from ${face.file.name}`}
                  title={face.file.name}
                  className={`block w-24 h-24 rounded-xl overflow-hidden border cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 ${held === face.key ? 'border-tea-gold ring-2 ring-tea-gold/60' : 'border-tea-border hover:border-tea-gold'}`}
                >
                  <img src={face.preview} alt="" className="w-full h-full object-cover pointer-events-none" />
                </Button>
                <Button
                  type="button"
                  variant="icon"
                  onClick={() => removeLoose(face.key)}
                  aria-label={`Take ${face.file.name} out of the tray`}
                  className="tap-target absolute -top-2 -right-2 rounded-full bg-tea-surface border-tea-border hover:border-tea-gold"
                  icon={<X size={12} strokeWidth={1.75} />}
                />
              </li>
            ))}
          </ul>
        )}

        {reading > 0 && (
          <p className="text-ui-13 text-tea-text-sec px-1.5 flex items-center gap-2" role="status">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Opening {reading === 1 ? 'one photo' : `${reading} photos`}…
          </p>
        )}
        {heldFace && (
          <p className="text-ui-13 text-tea-text px-1.5">
            {hint ? `The file name says ${hint.name}; it is ringed below. ` : ''}Tap the vendor this face belongs to.
          </p>
        )}
        {last && (
          <p className="text-ui-13 text-tea-text-sec px-1.5 flex flex-wrap items-center gap-x-2">
            <span>Saved as {last.vendorName}'s face.</span>
            <Button type="button" variant="quiet" size="sm" onClick={() => void undo()} disabled={!!savingOn}>Undo</Button>
          </p>
        )}
        {error && <p role="alert" className="text-ui-13 text-tea-text px-1.5">{error}</p>}
      </section>

      {withPhoto.length > 0 && <ul className={grid}>{withPhoto.map(tile)}</ul>}
      {withoutPhoto.length > 0 && (
        <section className="space-y-2">
          {withPhoto.length > 0 && <h3 className="type-label text-tea-text-sec px-1.5">No photo yet</h3>}
          <ul className={grid}>{withoutPhoto.map(tile)}</ul>
        </section>
      )}
    </div>
  );
};
