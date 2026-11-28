# Teajia’s sections

The phone bar, desktop rail and Home use the same four section names, in this order. The shared navigation module owns their spelling, order, active state and fallback routes. [Navigation definitions](../src/components/navSections.ts)

| Section | Entry | What belongs there |
|---|---|---|
| Read | `/read` | Stories, Lessons and Wisdom. Lessons is at `/read/lessons`. The reference and glossary live under `/wisdom`. Legacy Craft and Learn addresses take the reader to the relevant destination. |
| Tea table | `/tea-table` | Tastings and recaps people deliberately shared after a sit. Sessions and People also belong to this section. A private invitation and the guest’s private record retain their own access rules. |
| Tea spaces | `/tea-houses` | Places to sit, visit or build, and ways to work with Adrian. A tea house can contain several spaces. A person can have a tea space of their own. |
| Shop | `/shop` | The shop’s teas, teaware and offers. Related pages reuse the same tea and preserve the buyer’s route back to their collection, invoice or sit. |

Your Table at `/account` holds the signed-in member’s private records. Manage at `/admin` opens the rooms granted to the active account and role. These have their own entries. [Manage rooms](../src/components/manageNav.ts)

The Pillar explains what people can do together and what remains private. Direction holds the current delivery order. The earlier overhaul records the alternatives and the rollout switches in use when the decisions were made. [Pillar](PILLAR.md) · [Direction](CONSOLIDATED_DIRECTION.md) · [Original section overhaul](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/docs/SECTIONS.md)
