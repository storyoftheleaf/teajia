// The `way` part of /account/host/:id. A mount point: slice H8 fills it with
// the walkthrough editor on the shared photo editor. Keep the export name and
// props.
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { HostTablePartProps } from './hostTableParts';

export function WalkthroughEditor(_props: HostTablePartProps) {
  return (
    <section aria-labelledby="host-part-way" data-host-part="way">
      <h2 id="host-part-way" className={TYPOGRAPHY_CLASSES.h2}>The way in</h2>
    </section>
  );
}
