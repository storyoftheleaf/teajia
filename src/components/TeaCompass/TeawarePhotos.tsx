import { CapturePhotoImage, useCapturePhotoUpload } from '../curate/CapturePhotoImage';
import React, { useRef, useState } from 'react';
import { Camera, Plus, X } from 'lucide-react';
import { compressImage } from '../../lib/imageCompressor';
import { usePhotoEditor } from '../shared/usePhotoEditor';

interface TeawarePhotosProps {
  entryId: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

export const TeawarePhotos: React.FC<TeawarePhotosProps> = ({ entryId, photos, onPhotosChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useCapturePhotoUpload(entryId);
  const [uploading, setUploading] = useState(false);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

  const handleCapture = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  const { editPhoto, photoEditor } = usePhotoEditor();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFile = e.target.files?.[0];
    if (!pickedFile) return;
    e.target.value = '';
    const file = await editPhoto(pickedFile, { freeShape: true });
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });
      const url = await uploadPhoto(compressedFile);
      if (url) {
        onPhotosChange([...photos, url]);
      }
    } catch (err) {
      console.error('Teaware photo upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {photoEditor}
      <input
        key={photos.length === 0 ? 'camera' : 'gallery'}
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        {...(photos.length === 0 ? { capture: 'environment' } : {})}
      />

      {photos.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <div key={i} className="relative shrink-0 group">
              <CapturePhotoImage
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-20 h-20 rounded-xl object-cover cursor-pointer"
                onClick={() => setViewingIndex(viewingIndex === i ? null : i)}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePhoto(i);
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-tea-surface text-tea-text-dim"
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleCapture}
            disabled={uploading}
            className={`pill w-20 h-20 flex flex-col items-center justify-center shrink-0 rounded-xl ${
              uploading ? 'animate-pulse' : ''
            }`}
          >
            <Plus size={18} className="text-tea-text-dim" />
            <span className="text-ui-10 text-tea-text-dim mt-1">
              {uploading ? 'Uploading...' : 'Add'}
            </span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCapture}
          disabled={uploading}
          className={`pill w-full py-8 flex flex-col items-center justify-center rounded-xl ${
            uploading ? 'animate-pulse' : ''
          }`}
        >
          <Camera size={24} className={`mb-1.5 ${uploading ? 'text-tea-gold' : 'text-tea-text-dim'}`} />
          <span className="text-xs text-tea-text-dim">
            {uploading ? 'Uploading...' : 'Tap to add photos'}
          </span>
        </button>
      )}

      {/* Expanded preview */}
      {viewingIndex !== null && photos[viewingIndex] && (
        <div
          className="w-full rounded-xl overflow-hidden cursor-pointer"
          onClick={() => setViewingIndex(null)}
        >
          <CapturePhotoImage
            src={photos[viewingIndex]}
            alt={`Preview ${viewingIndex + 1}`}
            className="w-full h-auto max-h-64 object-contain bg-tea-bg rounded-xl"
          />
        </div>
      )}
    </div>
  );
};

export default TeawarePhotos;
