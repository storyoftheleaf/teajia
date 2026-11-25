import React, { useCallback, useRef, useState } from 'react';
import { SquareCropModal } from './SquareCropModal';
import { looksLikePhoto, prepareFacePhoto } from '../vendors/facePhotoFile';

/**
 * The site's one photo editing step. Every place a photo is added goes
 * through it: the photo opens in the shared editor (SquareCropModal) already
 * centred on the face when there is one, and the person crops, drags, zooms
 * and straightens before it is saved. Adrian, 2026-11-25: "the standard photo
 * editing face repositioning throughout the whole site".
 *
 *   const { editPhoto, editPhotos, photoEditor } = usePhotoEditor();
 *   const file = await editPhoto(picked);      // null when cancelled
 *   const files = await editPhotos(picked);    // one at a time; Cancel leaves that one out
 *   return <>{...}{photoEditor}</>;
 *
 * What comes back is a JPEG File, framed, ready for the place's own upload.
 * Photos read by the shop's analysis (package scans, imports, evidence) are
 * not edited: they need every pixel.
 */
export interface PhotoEditOptions {
  title?: string;
  confirmLabel?: string;
  /** Long edge of the saved photo in pixels. Default 1600. */
  outputSize?: number;
  /** Width over height. Default square. */
  aspect?: number;
  /** Offer square, portrait and landscape. */
  allowAspectSelection?: boolean;
  /** Open on the face. Default true. */
  centreFace?: boolean;
  layer?: 'popover' | 'takeover';
}

interface Pending extends PhotoEditOptions {
  source: File | Blob | string;
  name: string;
  resolve: (file: File | null) => void;
}

const jpegName = (name: string) => `${name.replace(/\.[^./]+$/, '') || 'photo'}.jpg`;

export function usePhotoEditor(defaults: PhotoEditOptions = {}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const editPhoto = useCallback(async (picked: File | Blob | string, options: PhotoEditOptions = {}) => {
    // iPhone HEIC photos are turned into JPEG first: Chrome cannot draw HEIC.
    const source = picked instanceof File ? await prepareFacePhoto(picked).catch(() => picked) : picked;
    const name = picked instanceof File ? picked.name : 'photo.jpg';
    return new Promise<File | null>(resolve => {
      setPending({ ...defaultsRef.current, ...options, source, name, resolve });
    });
  }, []);

  const editPhotos = useCallback(async (sources: ArrayLike<File> | File[], options: PhotoEditOptions = {}) => {
    const list = Array.from(sources).filter(looksLikePhoto);
    const edited: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const title = list.length > 1 ? `${options.title ?? defaultsRef.current.title ?? 'Edit photo'} (${i + 1} of ${list.length})` : options.title;
      const file = await editPhoto(list[i], { ...options, title });
      if (file) edited.push(file);
    }
    return edited;
  }, [editPhoto]);

  const finish = (file: File | null) => {
    pending?.resolve(file);
    setPending(null);
  };

  const photoEditor = pending ? (
    <SquareCropModal
      isOpen
      source={pending.source}
      title={pending.title ?? 'Edit photo'}
      confirmLabel={pending.confirmLabel ?? 'Use photo'}
      outputSize={pending.outputSize}
      frameAspect={pending.aspect}
      allowAspectSelection={pending.allowAspectSelection}
      centreFace={pending.centreFace}
      layer={pending.layer}
      onClose={() => finish(null)}
      onConfirm={blob => finish(new File([blob], jpegName(pending.name), { type: 'image/jpeg' }))}
    />
  ) : null;

  return { editPhoto, editPhotos, photoEditor, editing: !!pending };
}
