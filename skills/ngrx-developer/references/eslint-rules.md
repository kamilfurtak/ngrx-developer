# NgRx ESLint rules (`@ngrx/eslint-plugin`)

Use this when reviewing/linting NgRx code or setting up the plugin. Rules encode NgRx best
practices; frame review feedback around the *reasoning*, not just the violation. Default severity
is `error`; some rules have autofixes (`ng lint --fix`).

## Contents

- [Flat config setup](#flat-config-setup-eslint-v9)
- [Signals rules](#signals-rules-configssignals)
- [Store rules](#store-rules-configsstore)
- [Effects rules](#effects-rules-configseffects)
- [Component Store rules](#component-store-rules-configscomponentstore)
- [Operators and general rules](#operators--general)

## Flat config setup (ESLint v9+)

```js
const tseslint = require('typescript-eslint');
const ngrx = require('@ngrx/eslint-plugin');

module.exports = tseslint.config({
  files: ['**/*.ts'],
  extends: [
    ...ngrx.configs.all,          // everything, or pick per package:
    ...ngrx.configs.store,
    ...ngrx.configs.effects,
    ...ngrx.configs.componentStore,
    ...ngrx.configs.operators,
    ...ngrx.configs.signals,
    // rules needing type info:
    ...ngrx.configs.allTypeChecked,
    ...ngrx.configs.effectsTypeChecked,
    ...ngrx.configs.signalsTypeChecked,
  ],
  rules: {
    '@ngrx/with-state-no-arrays-at-root-level': 'warn', // override severity
  },
});
```

Type-checked configs require `parserOptions` for typed linting.

For a v20→21 migration, rules that require type information moved out of the ordinary configs:
`avoid-cyclic-effects` and `no-multiple-actions-in-effects` are in `effectsTypeChecked`;
`signal-state-no-arrays-at-root-level` and `with-state-no-arrays-at-root-level` are in
`signalsTypeChecked`. `allTypeChecked` aggregates the type-checked rules. Review the mapping in
`guide/migration/v21.md` and the generated rule table in `guide/eslint-plugin/index.md`.

## Signals rules (`configs.signals`)

- **`with-state-no-arrays-at-root-level`** — `withState` must take a record/dictionary, not an
  array/set/map/primitive at the root. State needs named slices so signals can be generated per
  property; put the array on a property.
- **`signal-state-no-arrays-at-root-level`** — same constraint for `signalState`.
- **`prefer-protected-state`** — a SignalStore should keep its state protected (the default) so
  updates stay inside the store; flags `{ protectedState: false }`.
- **`signal-store-feature-should-use-generic-type`** — a custom `signalStoreFeature` that accepts
  input should define a generic type, so it composes with proper type safety.

## Store rules (`configs.store`)

Actions:
- **`good-action-hygiene`** — enforces meaningful, well-named actions ("[Source] Event").
- **`prefer-action-creator`** — use `createAction` creators over legacy `Action` classes.
- **`prefer-action-creator-in-dispatch`** — dispatch action creators, not plain objects / old
  `Action` instances.
- **`prefer-action-creator-in-of-type`** — pass action creators to `ofType`, not raw strings.
- **`prefer-inline-action-props`** — use inline `props<{...}>()` types rather than separate
  interfaces/classes.

Reducers:
- **`avoid-duplicate-actions-in-reducer`** — a reducer should handle a given action only once.
- **`no-reducer-in-key-names`** — don't put "reducer" in state key names (it's redundant).
- **`on-function-explicit-return-type`** — give `on(...)` handlers an explicit return type to
  catch shape mismatches.

Selectors:
- **`prefix-selectors-with-select`** — name selectors `select*` (e.g. `selectEntity`).
- **`prefer-selector-in-select`** — pass a memoized selector to `select`, not a string or
  props-drilling, to get caching.
- **`avoid-mapping-selectors`** — don't `.pipe(map(...))` selector results in components; do the
  mapping in the selector so it's memoized and testable.
- **`avoid-combining-selectors`** — combine selectors at the selector level (`createSelector`),
  not by combining observables in the component.
- **`select-style`** — enforce a consistent `select` style (method vs pipeable operator).
- **`prefer-one-generic-in-create-for-feature-selector`** — use a single generic on
  `createFeatureSelector`.

Store usage:
- **`no-store-subscription`** — prefer the `async` pipe over manual `store.subscribe`, which leaks
  if not unsubscribed.
- **`no-typed-global-store`** — don't type the global `Store<T>`; rely on selectors for typing.
- **`no-multiple-global-stores`** — inject the global store once.
- **`use-consistent-global-store-name`** — name the injected store consistently across the app.

## Effects rules (`configs.effects`)

- **`no-dispatch-in-effects`** — an effect should map to actions via its return stream, not call
  `store.dispatch` imperatively.
- **`no-multiple-actions-in-effects`** — one effect maps one event to a single action; split
  multiple outputs into separate effects.
- **`avoid-cyclic-effects`** — avoid effects that re-emit an action they also filter on (infinite
  loop).
- **`no-effects-in-providers`** — register effect classes via `EffectsModule.forRoot/forFeature`
  (or `provideEffects`), not by listing them in `providers`.
- **`prefer-concat-latest-from`** — use `concatLatestFrom` over `withLatestFrom` so the selector
  isn't evaluated until the right action arrives (lazy).
- **`prefer-effect-callback-in-block-statement`** — write the effect callback as a block statement
  for easier debugging.
- **`use-effects-lifecycle-interface`** — implement the matching lifecycle interface
  (`OnInitEffects`, etc.) when using its method.

## Component Store rules (`configs.componentStore`)

- **`updater-explicit-return-type`** — `updater` functions need an explicit return type.
- **`require-super-ondestroy`** — an overridden `ngOnDestroy` in a `ComponentStore` subclass must
  call `super.ngOnDestroy()`.
- **`avoid-mapping-component-store-selectors`** / **`avoid-combining-component-store-selectors`** —
  the component-store equivalents of the store selector rules: map/combine at the selector level.

## Operators / general

- **`enforce-type-call`** — the `type` helper must be *called* (`type<Foo>()`), a common mistake
  when declaring payload/state types.
