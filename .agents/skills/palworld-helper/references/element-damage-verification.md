# Element damage verification

Read this reference whenever a task changes exact element multipliers, same-element behavior, Neutral exceptions, or compound defender rules.

## Publication boundary

Publish an exact multiplier or combination rule only when current-build source evidence and the isolated live damage-calculation route agree. A UI chart establishes directional intent at most. A static lookup establishes constants at most. Manual final-HP sampling is useful for discrepancy detection but is not sufficient because unrelated combat terms can change the observed damage.

Keep these two claims separate:

- **Element scale:** the verified multiplier returned for the resolved element-relation score.
- **Final damage:** the result after attack, defense, skills, passives, critical hits, weak-point hits, world settings, and any other combat modifiers.

## Required workflow

1. Run `scripts/run-element-damage-verification.ps1`; do not hand-edit `public/data/elements.json`.
2. Record the current client and dedicated-server build identifiers. They may use different depot build IDs, but both must come from the current official update snapshot and remain in private evidence.
3. Verify the build-matched weak-count lookup from the extracted game source or binary evidence.
4. Start two independent clean dedicated-server sessions through the repository driver. Do not reuse an already-running world or accept records from a previous session.
5. In each session, exercise every attacker element against all nine single-element defenders and all 36 unordered two-element defender combinations: 45 defender cases per attacker and 405 aggregation cases per session.
6. Observe both the direct weak-count lookup and the live damage-calculation route. Verify that each defender component is scored independently, that the component scores combine deterministically, and that the combined score selects the observed lookup multiplier.
7. Validate boundary and exception cases, including strong+strong, strong+neutral, strong+weak, weak+neutral, weak+weak, non-Neutral same-element behavior, and the Neutral-attack exception. Treat future-build changes as data refreshes, not reasons to preserve stale expectations.
8. Generate the private runtime report, then let the public importer consume it. The importer must reject missing sessions, incomplete coverage, duplicate or contradictory cases, non-finite values, source/runtime disagreement, stale fingerprints, or failed readiness flags.
9. Regenerate the public dataset, run schema and golden tests, localization checks, the production build, and responsive browser checks in both themes. Confirm dynamic and initial static HTML no longer show an unavailable notice when readiness passes.

## Required readiness gates

The private runtime report must establish all of the following before exact values reach public data:

- exact weak-count lookup verified;
- compound weak-count aggregation verified;
- live damage-calculation route verified;
- numeric multipliers ready for public use;
- dual-element rule ready for public use;
- two distinct completed session identities with full expected coverage.

If any gate fails, preserve the last verified public dataset only when the build policy explicitly allows it and labels it stale; otherwise fail generation and keep exact values unavailable. Never silently fall back to guessed or community-derived numbers.

## Repository boundary

Commit the reusable driver, validators, importer, tests, and intentionally published normalized data. Keep runtime JSONL, reports, fingerprints containing machine state, installed server files, UE4SS/mod packages, extraction logs, and absolute local paths under ignored `private/` storage. Audit the staged list and built artifact separately before pushing.
