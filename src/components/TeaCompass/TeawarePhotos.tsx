import React, { useRef, useState } from 'react';
import { Camera, Plus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';

interface TeawarePhotosProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

export const TeawarePhotos: React.FC<TeawarePhotosProps> = ({ photos, onPhotosChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

  const handleCapture = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });
      const url = await api.uploadImage(compressedFile);
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {photos.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <div key={i} className="relative shrink-0 group">
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-20 h-20 rounded-lg object-cover cursor-pointer"
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
            className={`pill w-20 h-20 flex flex-col items-center justify-center shrink-0 rounded-lg ${
              uploading ? 'animate-pulse' : ''
            }`}
          >
            <Plus size={18} className="text-tea-text-dim" />
            <span className="text-[10px] text-tea-text-dim mt-1">
              {uploading ? 'Uploading...' : 'Add'}
            </span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCapture}
          disabled={uploading}
          className={`pill w-full py-8 flex flex-col items-center justify-center rounded-lg ${
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
          className="w-full rounded-lg overflow-hidden cursor-pointer"
          onClick={() => setViewingIndex(null)}
        >
          <img
            src={photos[viewingIndex]}
            alt={`Preview ${viewingIndex + 1}`}
            className="w-full h-auto max-h-64 object-contain bg-tea-bg rounded-lg"
          />
        </div>
      )}
    </div>
  );
};

export default TeawarePhotos;
