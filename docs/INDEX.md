# Teajia documentation

Start with the [Pillar](PILLAR.md) to understand the product. Open [Consolidated Direction](CONSOLIDATED_DIRECTION.md) to choose work.

## Where a new piece of information goes

| Kind | Write it when | Its home and life cycle |
|---|---|---|
| Product promise | An owner decision changes who Teajia serves, what connects or who controls something | Update the [Pillar](PILLAR.md) in the change that alters the product. Put the operational detail in its domain contract. |
| Plan | A journey is chosen, or a dependency changes what can happen next | Edit [Direction](CONSOLIDATED_DIRECTION.md). Give the journey an observable finish. For a complex approved change, a scoped implementation brief may hold design detail. Link it from the journey and retire it after delivery. |
| Intake item | A gap, request or idea arrives before its priority is known | Add one sentence to [TODO](../TODO.md). Promote it into a journey, keep it conditional with a trigger, or close it. Capturing a request does not schedule it. |
| Contract or operator guide | More than one implementation depends on a rule, or a person needs a repeatable procedure | Maintain one domain reference. A contract defines permitted behavior. A guide gives the steps and recovery. Change the existing owner document first. |
| Evidence | A release, human journey, incident or experiment yields a result | Record the revision and environment in the release receipt, a dated change in the [changelog](CHANGELOG.md), and actual operator/reader/buyer results in [Launch Validation](LAUNCH_VALIDATION.md). Keep private material in its authorized system. |
| Historical decision | A plan has been replaced and its rationale might matter again | Move any surviving rule or outstanding obligation to the appropriate home above, fix current links and remove the superseded file. Git history retains its dated wording. Historical plans and audit findings confer no build priority. |

## References by task

- **Trace one tea** through intake, purchase, Stock and return. [Tea system map](agents/TEA-SYSTEM-MAP.md) · [Curate contract](CURATE_CONSUMER_CONTRACT.md) · [Receiving procedure](PURCHASE_LOGISTICS.md)
- **Work with roles, accounts and money.** [Members and access](MEMBERS_AND_ACCESS_GUIDE.md) · [Architecture](ARCHITECTURE.md) · [Money rules](claude/money.md) · [Agent permissions](claude/mcp.md)
- **Operate a shop.** [Daily workflows](STORE_OPERATOR_DAILY_WORKFLOWS.md) · [Opening stock](OPENING_STOCK_CSV_GUIDE.md) · [Australia operator guide](AUSTRALIA_LAUNCH_PLAYBOOK.md)
- **Edit or publish.** [Contributor editor](CONTRIBUTOR_EDITOR.md) · [AR Create handoff](AR_CREATE_TEA_LINK_CONTRACT.md) · [Tea Wisdom](TEA_WISDOM_BASE.md)
- **Change a screen or ship a release.** [Shared components](COMPONENTS.md) · [Design system](DESIGN_SYSTEM.md) · [Colour rules](COLOR_RULES.md) · [Testing](claude/testing.md) · [Verified releases](VERIFIED_RELEASES.md)
- **Recover an older decision.** [Historical plans and source material](plans/README.md)
