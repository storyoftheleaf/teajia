// One tea type for both Curates. The shared store, sync, samples and
// graduation all read TeaCompass/types, so v2 reads the same file rather
// than a copy that drifts from it.
export * from '../TeaCompass/types';
