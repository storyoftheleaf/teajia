import { inspectJpeg } from './familyJpeg';

const FEATURES = ['profile', 'foot', 'lid', 'knob', 'spout', 'handle'] as const;
const SOURCE_TYPES = ['Museum or exhibition', 'Maker catalogue', 'Specialist shop', 'Auction archive', 'Illustrated guide'];
const MAX_JPEG = 1_500_000;
const MAX_ENCODED_JPEG = Math.ceil(MAX_JPEG / 3) * 4;
const MAX_WRITE = 2_050_000;
const MEDIA_PATH = /^\/media\/([a-z0-9][a-z0-9-]{0,127}\.jpg)$/;
const OWNER_MEDIA = /^owner-[a-f0-9]{24}\.jpg$/;
const DEFAULT_RIGHTS = 'Owner-added photo for private comparison. Public reuse requires a documented permission or licence.';

type PrivateResponse = (body: BodyInit | null, status: number, type: string) => Response;
type Feature = typeof FEATURES[number];
type Exemplar = { asset: string; imageUrl: string; title: string; recordUrl: string; photoSha256?: string };
export type ShapeReferenceEvidence = {
  formId: string; asset: string; chinese: string; pinyin: string; title: string; recordUrl: string;
};
type OwnerExemplar = Exemplar & {
  id: string; credit: string; rights: string;
  sourceType: string; tradition: string; notes: string; reviewStatus: string; recordedOn: string;
};
type FormInfo = { id: string; chinese: string; pinyin: string; silhouette: string };
type Form = FormInfo & { exemplar: Exemplar; additionalExemplars?: Exemplar[] };
type OwnerForm = FormInfo & {
  kind: string; variants: string; nearNeighbors: string;
  features: Record<Feature, string>; supportingSources: [];
};
type Library = { schemaVersion: number; forms: Form[] } & Record<string, unknown>;
type Addition = { formId: string; form?: OwnerForm; exemplar: OwnerExemplar; photoSha256: string };
type Draft = { formId: string; form?: OwnerForm; exemplar: OwnerExemplar; photo: ArrayBuffer; photoSha256: string };

class ShapeInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function text(input: Record<string, unknown>, field: string, required = true, limit = 1200) {
  const value = input[field] === undefined ? '' : input[field];
  if (typeof value !== 'string') throw new ShapeInputError(`${field} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new ShapeInputError(`Enter ${field}.`);
  if (trimmed.length > limit) throw new ShapeInputError(`${field} is too long.`);
  return trimmed;
}

function sourceUrl(input: Record<string, unknown>, field: string) {
  const value = text(input, field, true, 2048);
  try {
    const url = new URL(value);
    if (value.startsWith('https://') && url.protocol === 'https:' && url.hostname
        && !url.username && !url.password && !/[\s\\\u0000-\u001f\u007f]/.test(value)) return value;
  } catch { /* The form needs a full HTTPS URL. */ }
  throw new ShapeInputError(`${field} must be an HTTPS link.`);
}

async function readInput(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ShapeInputError('Send a JSON reference.', 415);
  }
  if (Number(request.headers.get('Content-Length')) > MAX_WRITE) {
    throw new ShapeInputError('Choose a smaller JPEG photo.', 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new ShapeInputError('Send a JSON reference.');
  const decoder = new TextDecoder();
  let body = '';
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_WRITE) {
        await reader.cancel();
        throw new ShapeInputError('Choose a smaller JPEG photo.', 413);
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  let value: unknown;
  try { value = JSON.parse(body + decoder.decode()); } catch { throw new ShapeInputError('Invalid JSON reference.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ShapeInputError('Send a JSON reference.');
  return value as Record<string, unknown>;
}

function jpegBytes(encoded: unknown) {
  if (typeof encoded !== 'string') throw new ShapeInputError('Choose a JPEG photo.');
  if (encoded.length > MAX_ENCODED_JPEG) throw new ShapeInputError('Choose a smaller JPEG photo.', 413);
  let binary: string;
  try {
    if (encoded.length % 4 || /[^A-Za-z0-9+/=]/.test(encoded)) throw new Error('Invalid base64');
    binary = atob(encoded);
  } catch { throw new ShapeInputError('The selected photo could not be read.'); }
  if (binary.length > MAX_JPEG) throw new ShapeInputError('Choose a smaller JPEG photo.', 413);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const image = inspectJpeg(bytes);
  if (!image.ok || image.width > 1200 || image.height > 1200) {
    throw new ShapeInputError('Choose a JPEG photo prepared by the reference editor.');
  }
  return bytes.buffer;
}

async function readDraft(request: Request): Promise<Draft> {
  const input = await readInput(request);
  const mode = text(input, 'mode');
  if (mode !== 'example' && mode !== 'form') throw new ShapeInputError('Choose a new form or an example.');
  const recordUrl = sourceUrl(input, 'recordUrl');
  const imageUrl = sourceUrl(input, 'imageUrl');
  const sourceType = text(input, 'sourceType');
  if (!SOURCE_TYPES.includes(sourceType)) throw new ShapeInputError('Choose a source type.');
  const photo = jpegBytes(input.photo);
  const photoSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', photo))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  const id = 'owner-' + photoSha256.slice(0, 24);
  const exemplar: OwnerExemplar = {
    id, asset: `assets/${id}.jpg`, imageUrl, recordUrl, sourceType,
    title: text(input, 'title'), credit: text(input, 'credit'), rights: text(input, 'rights', false) || DEFAULT_RIGHTS,
    tradition: text(input, 'tradition', false), notes: text(input, 'notes', false),
    reviewStatus: 'Owner addition awaiting source review', recordedOn: new Date().toISOString().slice(0, 10),
  };
  if (mode === 'example') return { formId: text(input, 'formId', true, 120), exemplar, photo, photoSha256 };

  const chinese = text(input, 'chinese', true, 80);
  if (!/[\u3400-\u9fff]/u.test(chinese)) throw new ShapeInputError('Enter the Chinese form name.');
  const pinyin = text(input, 'pinyin', true, 120);
  const formId = pinyin.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').replace(/-(?:hu|teapot)$/, '');
  if (!/^[a-z][a-z0-9-]*$/.test(formId)) throw new ShapeInputError('Enter pinyin using Latin letters.');
  const features = Object.fromEntries(FEATURES.map(part => [part, text(input, part, false) || 'Open'])) as Record<Feature, string>;
  const form: OwnerForm = {
    id: formId, chinese, pinyin, silhouette: text(input, 'silhouette'),
    kind: 'Owner-added form · pending review', features, supportingSources: [],
    variants: text(input, 'variants', false), nearNeighbors: text(input, 'nearNeighbors', false),
  };
  return { formId, form, exemplar, photo, photoSha256 };
}

async function readLibrary(bucket: R2Bucket, prefix: string) {
  const object = await bucket.get(prefix + 'library.json');
  const data = await object?.json<Library>();
  if (data?.schemaVersion !== 1 || !Array.isArray(data.forms)) throw new Error('Shape library unavailable');
  return data;
}

async function readAdditions(bucket: R2Bucket, prefix: string) {
  const object = await bucket.get(prefix + 'additions.json');
  const data = await object?.json<{ schemaVersion: number; entries: Addition[] }>();
  if (object && (data?.schemaVersion !== 1 || !Array.isArray(data.entries))) throw new Error('Invalid shape additions');
  return { additions: data?.entries ?? [], etag: object?.etag };
}

function exemplars(form: Form) {
  return [form.exemplar, ...(form.additionalExemplars ?? [])];
}

function mergeForms(base: Form[], additions: Addition[]) {
  const forms = new Map(base.map(form => [form.id, form]));
  for (const { formId, form, exemplar } of additions) {
    const existing = forms.get(formId);
    if (!existing && form) {
      forms.set(formId, { ...form, exemplar });
    } else if (existing && !exemplars(existing).some(item => item.asset === exemplar.asset || item.imageUrl === exemplar.imageUrl)) {
      forms.set(formId, { ...existing, additionalExemplars: [...(existing.additionalExemplars ?? []), exemplar] });
    }
  }
  return [...forms.values()];
}

async function readMergedLibrary(bucket: R2Bucket, prefix: string): Promise<Library> {
  const [base, { additions }] = await Promise.all([readLibrary(bucket, prefix), readAdditions(bucket, prefix)]);
  return { ...base, forms: mergeForms(base.forms, additions) };
}

export async function findYixingShapeEvidence(
  bucket: R2Bucket, prefix: string, formId: string, asset: string,
): Promise<ShapeReferenceEvidence | null> {
  const { forms } = await readMergedLibrary(bucket, prefix);
  const form = forms.find(item => item.id === formId);
  if (!form) return null;
  const exemplar = exemplars(form).find(item => item.asset === asset);
  if (!exemplar || !exemplar.title || !exemplar.recordUrl) return null;
  return { formId, asset, chinese: form.chinese, pinyin: form.pinyin, title: exemplar.title, recordUrl: exemplar.recordUrl };
}

function normalizedLabel(value: string) {
  return value.normalize('NFKC').trim().replace(/[壶壺]$/u, '').trim().toLowerCase();
}

function imageIdentity(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch { return value; }
}

function createAddition(draft: Draft, forms: Form[], additions: Addition[]): Addition {
  const { exemplar, photoSha256 } = draft;
  const photoUrl = imageIdentity(exemplar.imageUrl);
  if (additions.some(addition => addition.photoSha256 === photoSha256)
      || forms.some(form => exemplars(form).some(item => item.asset === exemplar.asset
        || item.photoSha256 === photoSha256 || imageIdentity(item.imageUrl) === photoUrl))) {
    throw new ShapeInputError('That source photo is already in the library.', 409);
  }
  const newForm = draft.form;
  if (!newForm) {
    if (!forms.some(form => form.id === draft.formId)) throw new ShapeInputError('Choose an existing form.');
    return { formId: draft.formId, exemplar, photoSha256 };
  }

  const label = normalizedLabel(newForm.chinese);
  if (forms.some(form => normalizedLabel(form.chinese) === label)) {
    throw new ShapeInputError('That Chinese name already exists. Add an example to the existing form.', 409);
  }
  if (!forms.some(form => form.silhouette === newForm.silhouette)) throw new ShapeInputError('Choose a silhouette category.');
  let formId = draft.formId;
  if (formId === 'add' || forms.some(form => form.id === formId)) formId += '-' + photoSha256.slice(0, 8);
  if (forms.some(form => form.id === formId)) throw new ShapeInputError('That form ID already exists.', 409);
  return { formId, form: { ...newForm, id: formId }, exemplar, photoSha256 };
}

async function saveAddition(request: Request, bucket: R2Bucket, prefix: string) {
  const draft = await readDraft(request);
  const library = await readLibrary(bucket, prefix);
  const key = prefix + 'additions.json';
  const media = prefix + 'media/' + draft.exemplar.id + '.jpg';
  let staged = false;

  for (let attempt = 0; attempt < 4; attempt++) {
    const { additions, etag } = await readAdditions(bucket, prefix);
    const addition = createAddition(draft, mergeForms(library.forms, additions), additions);
    if (!staged) {
      // A reference becomes readable only once its metadata is appended.
      // A retried write can reuse a staged photo with the same checksum.
      const stored = await bucket.put(media, draft.photo, {
        onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'image/jpeg' },
        customMetadata: { sha256: draft.photoSha256 },
      });
      if (!stored && (await bucket.head(media))?.customMetadata?.sha256 !== draft.photoSha256) {
        throw new ShapeInputError('That photo is already in use.', 409);
      }
      staged = true;
    }
    const saved = await bucket.put(key, JSON.stringify({ schemaVersion: 1, entries: [...additions, addition] }), {
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    });
    if (saved) return { formId: addition.formId, asset: addition.exemplar.asset };
  }
  throw new ShapeInputError('The shape library changed. Try saving again.', 409);
}

export async function serveYixingShapeLibrary(
  request: Request, bucket: R2Bucket, path: string, prefix: string, respond: PrivateResponse,
) {
  const head = request.method === 'HEAD';
  const json = (body: unknown, status = 200) => respond(head ? null : JSON.stringify(body), status, 'application/json');
  try {
    if (!path && head) {
      const exists = await bucket.head(prefix + 'library.json');
      return exists ? json(null) : json({ error: 'Shape library unavailable' }, 503);
    }
    if (!path && request.method === 'GET') {
      return json(await readMergedLibrary(bucket, prefix));
    }
    if (!path && request.method === 'POST') return json(await saveAddition(request, bucket, prefix), 201);

    const media = MEDIA_PATH.exec(path);
    if (media && (request.method === 'GET' || head)) {
      const filename = media[1];
      if (OWNER_MEDIA.test(filename)) {
        const [base, { additions }] = await Promise.all([readLibrary(bucket, prefix), readAdditions(bucket, prefix)]);
        const asset = 'assets/' + filename;
        if (!additions.some(addition => addition.exemplar.asset === asset)
            && !base.forms.some(form => exemplars(form).some(item => item.asset === asset))) {
          return json({ error: 'Photo not found' }, 404);
        }
      }
      const key = prefix + 'media/' + filename;
      const object = head ? await bucket.head(key) : await bucket.get(key);
      if (!object) return json({ error: 'Photo not found' }, 404);
      return respond('body' in object ? (object as R2ObjectBody).body : null, 200, 'image/jpeg');
    }
    return json({ error: 'Shape library route not found' }, 404);
  } catch (error) {
    if (error instanceof ShapeInputError) return json({ error: error.message }, error.status);
    return json({ error: 'Private shape library unavailable' }, 503);
  }
}
