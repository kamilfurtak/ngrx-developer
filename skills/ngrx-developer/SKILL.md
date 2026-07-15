---
name: ngrx-developer
description: Design, implement, review, test, debug, and migrate Angular state management with NgRx. Use for @ngrx/store, @ngrx/effects, @ngrx/signals and SignalStore, @ngrx/entity, @ngrx/component-store, @ngrx/router-store, @ngrx/data, Store DevTools, NgRx operators, ESLint rules, schematics, runtime checks, selectors, reducers, actions, effects, entity adapters, and NgRx version migrations.
---

# NgRx Developer

Produce version-aware NgRx code that fits the existing Angular application. Use the concise curated references first and the bundled official NgRx 21.1.1 guide snapshot for detail and verification.

## Inspect the project first

1. Read `package.json` and workspace configuration before recommending or changing code.
2. Determine the Angular and every installed `@ngrx/*` version, package manager, test runner, and whether the workspace uses Nx.
3. Search for existing Store, SignalStore, ComponentStore, provider, action, selector, effect, and test patterns. Preserve established conventions unless the user requests a migration.
4. Treat `references/guide/` as authoritative for NgRx 21.1.1. If a curated reference conflicts with the snapshot, the snapshot wins.
5. For another major version, inspect the matching `references/guide/migration/` files and installed package typings or source. Never emit an API merely because it exists in the snapshot.
6. If current or post-snapshot behavior is required, consult current official NgRx sources and distinguish that information from the bundled snapshot.

## Choose the state surface deliberately

- Prefer plain Angular signals or services when the problem does not justify NgRx.
- Prefer `@ngrx/signals` for new local, feature, or component state. Start with [SignalStore](references/signalstore.md), [reactivity](references/reactivity.md), and [entities](references/entities.md).
- Use `@ngrx/store` for shared, event-driven application state that benefits from actions, reducers, selectors, effects, and DevTools. Start with [classic Store](references/classic-store.md) and validate the decision against [Why Store](references/guide/store/why.md).
- Keep `@ngrx/component-store` where it is established. For new local state, follow the snapshot's preference for NgRx Signals; consult [the comparison](references/guide/component-store/comparison.md) before choosing or migrating.
- Add the SignalStore Events plugin only for advanced inter-store coordination or deliberately decoupled event flows. Read [Events plugin](references/events-plugin.md).
- Use the matching entity solution for normalized collections with stable identifiers and repeated collection operations.
- Provide state at the narrowest lifetime that owns it. Route-scoped SignalStores belong in route `providers`; do not also make the same store root-provided.

## Implement a coherent slice

1. Define ownership, invariants, public API, loading/error states, and side-effect boundaries.
2. Read only the smallest relevant curated reference, then open or search the official snapshot when exact signatures, edge cases, tests, or migration details matter.
3. Follow the project's standalone or NgModule provider style; do not mix registration styles casually.
4. Keep state transitions immutable, selectors/computed state pure, effects isolated, and public APIs strongly typed.
5. Model actions and events as occurrences with specific sources. Avoid command-like names when event semantics are appropriate.
6. Expose view-ready computed state or selectors instead of duplicating derivations in templates.
7. Catch effect errors inside the inner observable so the outer effect keeps listening. Choose flattening operators from the required cancellation and concurrency behavior.
8. Add focused tests for transitions, derived state, async behavior, registration, cancellation, and errors. Use TestBed when SignalStore features need injection context.
9. Run the narrowest formatter, lint, test, typecheck, and build targets. In Nx, use the workspace package manager and Nx.

When cancellation is contractual, use controllable observables or the repository's HTTP testing utility. Start a second request and prove the first is cancelled and cannot commit stale state.

## Curated reference map

- SignalStore composition, state, computed values, methods, hooks, custom features, and tests: [signalstore.md](references/signalstore.md)
- `signalState`, `patchState`, `signalMethod`, `rxMethod`, `tapResponse`, and flattening operators: [reactivity.md](references/reactivity.md)
- SignalStore entity collections and updaters: [entities.md](references/entities.md)
- Classic Store, actions, reducers, selectors, effects, and classic Entity: [classic-store.md](references/classic-store.md)
- SignalStore Events plugin: [events-plugin.md](references/events-plugin.md)
- NgRx flat ESLint configs and rule families: [eslint-rules.md](references/eslint-rules.md)

## Official snapshot fallback

- Store: `references/guide/store/`; Effects: `references/guide/effects/`; classic Entity: `references/guide/entity/`
- Signals and SignalStore: `references/guide/signals/`; operators: `references/guide/operators/`
- ComponentStore: `references/guide/component-store/`; Router Store: `references/guide/router-store/`; NgRx Data: `references/guide/data/`
- DevTools, schematics, components, and ESLint: `references/guide/store-devtools/`, `references/guide/schematics/`, `references/guide/component/`, `references/guide/eslint-plugin/`
- Migrations: search `references/guide/migration/v*.md` for every major crossed by the project.

Useful entry points: [SignalStore core](references/guide/signals/signal-store/index.md), [SignalStore testing](references/guide/signals/signal-store/testing.md), [Store actions](references/guide/store/actions.md), [Store selectors](references/guide/store/selectors.md), [Effects](references/guide/effects/index.md), and [Effects testing](references/guide/effects/testing.md).

## Search efficiently

Run searches from this skill directory:

```bash
rg -n "provideStore|provideState|StoreModule" references/guide/store references/guide/migration
rg -n "signalStore|withState|withComputed|withMethods|patchState" references/guide/signals
rg -n "rxMethod|tapResponse|withEntities|setAllEntities" references/guide/signals references/guide/operators
rg -n "createEffect|concatLatestFrom|functional" references/guide/effects references/guide/eslint-plugin
rg -n "provideMockStore|provideMockActions|overrideSelector" references/guide/store references/guide/effects
```

Resolve paths relative to the skill. Treat NgRx renderer elements such as `ngrx-docs-alert` and `ngrx-code-example` as wrappers around their enclosed prose and code.

## Snapshot provenance

The official guide snapshot is from `ngrx/platform` commit `fa0780ee1a4ecd0ceead4566c11795041d5f12e4`, package version 21.1.1:

`https://github.com/ngrx/platform/tree/fa0780ee1a4ecd0ceead4566c11795041d5f12e4/projects/www/src/app/pages/guide`

Retain the bundled [NgRx MIT license](references/ngrx-license.txt) with the snapshot.
