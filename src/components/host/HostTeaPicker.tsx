// The `teas` part of /account/host/:id. A mount point: slice H6 fills it with
// the tea picker (Teajia's shop first, the host's chest second, a typed name
// last). Keep the export name and props.
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { HostTablePartProps } from './hostTableParts';

export function HostTeaPicker(_props: HostTablePartProps) {
  return (
    <section aria-labelledby="host-part-teas" data-host-part="teas">
      <h2 id="host-part-teas" className={TYPOGRAPHY_CLASSES.h2}>Teas</h2>
    </section>
  );
}
