import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../../components/shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { API_URL, authedFetch } from '../../../lib/api';
import { compressImage } from '../../../lib/imageCompressor';
import type { Auth } from './data';
import { SHAPE_FEATURES, SHAPE_SILHOUETTES, type ShapeForm } from './shapeData';

type SaveResult = { formId: string; asset: string };
type Mode = 'example' | 'form';

type Props = {
  auth: Auth;
  forms: ShapeForm[];
  onSaved: (result: SaveResult) => void;
  onCancel: () => void;
};

const FIELD = 'admin-input mt-1 block w-full min-w-0 p-2';
const LABEL = 'min-w-0 text-tea-text-sec';
const SOURCE_TYPES = ['Museum or exhibition', 'Maker catalogue', 'Specialist shop', 'Auction archive', 'Illustrated guide'];
const MAX_PHOTO_BYTES = 1_500_000;
const JPEG_PREFIX = 'data:image/jpeg;base64,';

function textField(name: string, label: string, options: { required?: boolean; maxLength?: number; type?: 'url' } = {}) {
  return (
    <label className={LABEL} key={name}>
      {label}
      <input className={FIELD} name={name} type={options.type ?? 'text'}
        required={options.required} maxLength={options.maxLength ?? 1200} />
    </label>
  );
}

async function readJpeg(file: File): Promise<string> {
  const jpeg = await compressImage(file, 1200, 0.85).catch(() => {
    throw new Error('This browser could not open the image. Choose a JPEG, PNG or WebP photo.');
  });
  if (jpeg.size > MAX_PHOTO_BYTES) throw new Error('Choose a smaller photo.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith(JPEG_PREFIX)) resolve(reader.result);
      else reject(new Error('The file could not be converted to JPEG.'));
    };
    reader.onerror = () => reject(new Error('The selected photo could not be read.'));
    reader.readAsDataURL(jpeg);
  });
}

function isSourceLink(value: string) {
  try {
    const url = new URL(value);
    return value.startsWith('https://') && Boolean(url.hostname) && !url.username && !url.password
      && !/[\s\\\u0000-\u001f\u007f]/.test(value);
  } catch {
    return false;
  }
}

export default function AddShapeReference({ auth, forms, onSaved, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>(forms.length ? 'example' : 'form');
  const [photo, setPhoto] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const photoSelection = useRef(0);
  const submitting = useRef(false);

  async function choosePhoto(file?: File) {
    if (!file) return;
    const selection = ++photoSelection.current;
    setPhoto('');
    setPhotoError('');
    setError('');
    setPreparing(true);
    try {
      const preview = await readJpeg(file);
      if (selection === photoSelection.current) setPhoto(preview);
    } catch (caught) {
      if (selection === photoSelection.current) {
        setPhotoError(caught instanceof Error ? caught.message : 'This photo could not be prepared.');
      }
    } finally {
      if (selection === photoSelection.current) setPreparing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || preparing) return;
    setError('');
    const fields = Object.fromEntries(
      Array.from(new FormData(event.currentTarget), ([key, value]) => [key, String(value).trim()] as const),
    );

    if (!fields.title || !fields.credit || !fields.sourceType) {
      setError('Enter the reference title and credit, and choose a source type.');
      return;
    }
    if (!isSourceLink(fields.recordUrl) || !isSourceLink(fields.imageUrl)) {
      setError('Use HTTPS links for the source record and source image.');
      return;
    }
    if (!photo) {
      setPhotoError('Choose a photo before saving.');
      chooseButton.current?.focus();
      return;
    }
    if (mode === 'example' && !forms.some(form => form.id === fields.formId)) {
      setError('Choose an existing form.');
      return;
    }
    if (mode === 'form' && (!/[\u3400-\u9fff]/u.test(fields.chinese) || !/\p{Script=Latin}/u.test(fields.pinyin))) {
      setError('Enter the Chinese form name and its pinyin.');
      return;
    }

    submitting.current = true;
    setSaving(true);
    let result: SaveResult;
    try {
      result = await authedFetch(API_URL + '/api/admin/yixing/shapes', {
        method: 'POST',
        expectedAuth: auth,
        reportIncident: false,
        retryTimeouts: false,
        body: JSON.stringify({ ...fields, mode, photo: photo.slice(JPEG_PREFIX.length) }),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this reference.');
      return;
    } finally {
      submitting.current = false;
      setSaving(false);
    }
    onSaved(result);
  }

  return (
    <>
      <h1 className={TYPOGRAPHY_CLASSES.h1}>Add shape reference</h1>
      <form className="mt-3" onSubmit={submit} onChange={() => setError('')} aria-busy={saving}>
        <fieldset disabled={saving} className="min-w-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={LABEL}>
              Add to the library
              <select className={FIELD} value={mode} onChange={event => setMode(event.currentTarget.value as Mode)}>
                {forms.length > 0 && <option value="example">Example for an existing form</option>}
                <option value="form">New form</option>
              </select>
            </label>
            <label className={LABEL} hidden={mode !== 'example'}>
              Existing form
              <select className={FIELD} name="formId" defaultValue="" required={mode === 'example'} disabled={mode !== 'example'}>
                <option value="" disabled>Choose a form</option>
                {forms.map(form => <option value={form.id} key={form.id}>{form.chinese} · {form.pinyin}</option>)}
              </select>
            </label>
          </div>

          <fieldset hidden={mode !== 'form'} disabled={mode !== 'form'} className="min-w-0 space-y-2">
            <legend className={TYPOGRAPHY_CLASSES.h2}>Form details</legend>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {textField('chinese', 'Chinese name', { required: true, maxLength: 80 })}
              {textField('pinyin', 'Pinyin', { required: true, maxLength: 120 })}
              <label className={LABEL + ' col-span-2 lg:col-span-1'}>
                Silhouette
                <select className={FIELD} name="silhouette" defaultValue="" required>
                  <option value="" disabled>Choose a silhouette</option>
                  {SHAPE_SILHOUETTES.map(shape => <option key={shape} value={shape}>{shape}</option>)}
                </select>
              </label>
              {textField('variants', 'Variants')}
              {textField('nearNeighbors', 'Similar forms')}
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {SHAPE_FEATURES.map(part => textField(part, part[0].toUpperCase() + part.slice(1)))}
            </div>
          </fieldset>

          <fieldset className="min-w-0 space-y-2">
            <legend className={TYPOGRAPHY_CLASSES.h2}>Source and photo</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {textField('title', 'Reference title', { required: true })}
              {textField('credit', 'Source credit', { required: true })}
              {textField('recordUrl', 'Source record URL', { required: true, type: 'url', maxLength: 2048 })}
              {textField('imageUrl', 'Source image URL', { required: true, type: 'url', maxLength: 2048 })}
              <label className={LABEL}>
                Source type
                <select className={FIELD} name="sourceType" defaultValue="" required>
                  <option value="" disabled>Choose a source type</option>
                  {SOURCE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              {textField('tradition', 'Region or tradition')}
              {textField('rights', 'Photo rights')}
              <label className={LABEL}>Notes
                <textarea className={FIELD} name="notes" rows={2} maxLength={1200} />
              </label>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              {photo && <img src={photo} className="h-24 w-24 rounded-md border border-tea-border bg-tea-surface object-contain" alt="Reference photo preview" />}
              <div className="min-w-0">
                <Button ref={chooseButton} type="button" variant="secondary" onClick={() => picker.current?.click()}>
                  {photo ? 'Change photo' : 'Choose photo'}
                </Button>
                {preparing && <p className={TYPOGRAPHY_CLASSES.bodyLight} role="status">Preparing photo…</p>}
                {photoError && <p className="mt-1 text-tea-text-sec" role="alert">{photoError}</p>}
              </div>
              <input ref={picker} type="file" className="hidden" accept="image/*" aria-label="Reference photo"
                onChange={event => {
                  void choosePhoto(event.currentTarget.files?.[0]);
                  event.currentTarget.value = '';
                }} />
            </div>
          </fieldset>

          {error && <p role="alert" className="text-tea-text-sec">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="quiet" className="text-tea-text-sec" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={preparing}>{saving ? 'Saving…' : 'Save reference'}</Button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
