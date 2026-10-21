import type { InstalledTeaAiEnvironment } from './curateInstalledAi';

export interface TeaVoiceEnvironment extends InstalledTeaAiEnvironment {
  GROQ_API_KEY?: string;
}

export const INSTALLED_VOICE_MODEL = '@cf/openai/whisper-large-v3-turbo';
export const VOICE_TRANSCRIPTION_TIMEOUT_MS = 20_000;

export class TeaVoiceTranscriptionError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message);
    this.name = 'TeaVoiceTranscriptionError';
  }
}

export function hasTeaVoiceProvider(env: TeaVoiceEnvironment): boolean {
  return Boolean(env.GROQ_API_KEY?.trim()) || typeof env.AI?.run === 'function';
}

function audioBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32_768)));
  }
  return btoa(chunks.join(''));
}

/** Transcribes already validated audio; owns no recording, note, or tea writes.
 * Cloudflare's Whisper Turbo schema accepts base64 audio and returns text:
 * https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/
 */
export async function transcribeTeaVoice(
  env: TeaVoiceEnvironment,
  audio: Uint8Array | ArrayBuffer,
  mimeType: string,
  fileName = 'recording.webm',
): Promise<string> {
  const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
  if (!bytes.byteLength) throw new TeaVoiceTranscriptionError('The recording is empty.', 'invalid_audio', 400);
  if (!hasTeaVoiceProvider(env)) throw new TeaVoiceTranscriptionError('Transcription provider unavailable', 'provider_unavailable', 503);

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const work = async (): Promise<unknown> => {
      if (env.GROQ_API_KEY?.trim()) {
        const form = new FormData();
        form.append('file', new File([bytes.slice().buffer], fileName, { type: mimeType }), fileName);
        form.append('model', 'whisper-large-v3-turbo');
        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST', headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` }, body: form, signal: controller.signal,
        });
        if (!response.ok) throw new TeaVoiceTranscriptionError('Transcription failed', 'provider_error', 502);
        return response.json();
      }
      // Transcribe in the spoken language; do not translate or supply guessed tea details.
      return env.AI!.run!(INSTALLED_VOICE_MODEL, { audio: audioBase64(bytes), task: 'transcribe' });
    };
    const result = await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new TeaVoiceTranscriptionError('Transcription took too long. Try again.', 'provider_timeout', 504));
          controller.abort();
        }, VOICE_TRANSCRIPTION_TIMEOUT_MS);
      }),
    ]);
    const text = result && typeof result === 'object' && !Array.isArray(result) && 'text' in result ? result.text : undefined;
    if (typeof text !== 'string' || !text.trim()) throw new TeaVoiceTranscriptionError('No speech could be transcribed. Try recording again.', 'provider_error', 502);
    return text.trim();
  } catch (error) {
    if (error instanceof TeaVoiceTranscriptionError) throw error;
    throw new TeaVoiceTranscriptionError('Transcription failed', 'provider_error', 502);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
