# Reactivity: signalState, patchState, signalMethod, rxMethod

Utilities from `@ngrx/signals` and its `rxjs-interop` plugin for state and side effects. Use this
to pick the right side-effect tool and to write standalone signal-based state.

## Contents

- [Choosing a side-effect tool](#choosing-a-side-effect-tool)
- [`signalState`](#signalstate)
- [`patchState`](#patchstate)
- [`signalMethod`](#signalmethod)
- [`rxMethod`](#rxmethod-rxjs-interop-plugin)

## Choosing a side-effect tool

| Need | Use |
| --- | --- |
| Synchronous state change | plain method + `patchState` |
| Single async request, no cancellation | `async` method with `await` |
| Reactive stream: debounce, cancel in-flight (`switchMap`), react to a signal over time | `rxMethod` (`@ngrx/signals/rxjs-interop`) |
| Run a callback whenever an input signal changes (not store state) | `signalMethod` |

Lightweight component/service state without a full store → `signalState`.

## `signalState`

A lightweight signal-based state container for components, services, or standalone functions —
without the full SignalStore machinery. Instantiated with an initial **record/object literal**.

```ts
import { signalState } from '@ngrx/signals';

type UserState = { user: { firstName: string; lastName: string }; isAdmin: boolean };

const userState = signalState<UserState>({
  user: { firstName: 'Eric', lastName: 'Clapton' },
  isAdmin: false,
});
```

`signalState` returns a read-only signal (callable: `userState()`) that also exposes a signal per
property, with `DeepSignal` for nested objects (lazy, created on first access):

```ts
userState.user;            // DeepSignal<User>
userState.user.firstName;  // Signal<string>
userState.isAdmin;         // Signal<boolean>
```

Union-type semantics match SignalStore: a `DeepSignal` per object-literal member, primitives stay
`Signal`; narrow with `in`. Arrays/primitives live on properties, not at the root (ESLint:
`signal-state-no-arrays-at-root-level`).

Use it in `computed`/`effect` like any signal, and update it with `patchState`.

## `patchState`

Type-safe, immutable updates for both `signalState` and SignalStore instances.

```ts
import { patchState } from '@ngrx/signals';

patchState(userState, { isAdmin: true });
patchState(userState, (state) => ({ user: { ...state.user, firstName: 'Jimi' } }));
patchState(userState, { isAdmin: false }, (state) => ({ user: { ...state.user, lastName: 'Hendrix' } }));
```

Updaters must be immutable. Factor repeated updates into custom updater functions (see
`signalstore.md` §7).

## `signalMethod`

A factory for managing side effects driven by an input signal. It takes a callback and returns a
processor that accepts a static value, a `Signal`, or a computation function of the input type.

```ts
import { signalMethod } from '@ngrx/signals';

readonly logDoubledNumber = signalMethod<number>((num) => console.log(num * 2));

// call with a static value or a signal:
this.logDoubledNumber(1);          // logs 2
const n = signal(2);
this.logDoubledNumber(n);          // logs 4, and re-runs whenever n changes
this.logDoubledNumber(() => a() + b()); // computation combining signals
```

**Automatic cleanup:** `signalMethod` uses an internal `effect`. When called inside an injection
context, that context governs cleanup; otherwise the injector where the `signalMethod` was
*created* is used. So a `signalMethod` created in a component is cleaned up when that component is
destroyed, even if called from `ngOnInit`. One created in a root service lives for the app's
lifetime.

## `rxMethod` (rxjs-interop plugin)

RxJS integration is **opt-in** via `@ngrx/signals/rxjs-interop`. `rxMethod` takes a chain of RxJS
operators (via `pipe`) and returns a reactive method. The method accepts a static value, a
`Signal`, a computation function, **or an `Observable`** — and re-runs when a passed signal emits.

```ts
import { map, pipe, tap } from 'rxjs';
import { rxMethod } from '@ngrx/signals/rxjs-interop';

readonly logDoubledNumber = rxMethod<number>(
  pipe(map((num) => num * 2), tap(console.log)),
);
```

In a store, `rxMethod` shines for cancelable/reactive effects. Use a flattening operator
(`switchMap`, `concatMap`, `exhaustMap`, `mergeMap`) and wrap the inner call in `tapResponse`
(from `@ngrx/operators`) so an error doesn't complete the outer stream and permanently disable the
method:

```ts
loadByQuery: rxMethod<string>(
  pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap((query) => {
      // switchMap has already finalized the previous inner request.
      patchState(store, { isLoading: true });
      return booksService.getByQuery(query).pipe(
        tapResponse({
          next: (books) => patchState(store, { books }),
          error: console.error,
          finalize: () => patchState(store, { isLoading: false }),
        }),
      );
    }),
  ),
),
```

With `switchMap`, set loading inside the projection as above. If it is set in an upstream `tap`,
the canceled inner stream's `finalize` runs afterward and can incorrectly clear the new request's
loading state.

Wiring a signal into an `rxMethod` makes it re-run reactively — e.g. re-fetch whenever a query
signal changes:

```ts
constructor() {
  this.store.loadByQuery(this.store.filter.query); // pass the signal itself
}
```

Choosing the flattening operator: `switchMap` to cancel the previous request (typeahead),
`concatMap` to preserve order, `exhaustMap` to ignore new triggers while one is in flight (submit
buttons), `mergeMap` for full concurrency.
