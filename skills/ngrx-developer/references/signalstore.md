# SignalStore reference

The complete SignalStore API. Mirrors the official `@ngrx/signals` docs.

## Contents
1. Creating a store
2. Providing and injecting
3. Reading state (signals & DeepSignal)
4. `withComputed`
5. `withMethods`
6. `withProps`
7. Updating state with `patchState`
8. `protectedState`
9. Lifecycle hooks (`withHooks`)
10. Custom features (`signalStoreFeature`)
11. Class-based stores and typing
12. Testing

---

## 1. Creating a store

A SignalStore is created with `signalStore`, which takes a sequence of *features* and returns an
injectable Angular service. Features add state, computed signals, properties, and methods.

```ts
import { signalStore, withState } from '@ngrx/signals';
import { Book } from './book';

type BookSearchState = {
  books: Book[];
  isLoading: boolean;
  filter: { query: string; order: 'asc' | 'desc' };
};

const initialState: BookSearchState = {
  books: [],
  isLoading: false,
  filter: { query: '', order: 'asc' },
};

export const BookSearchStore = signalStore(withState(initialState));
```

`withState` accepts the initial state (a **record/object literal** — not a bare array or
primitive). It also has a factory signature that runs in the injection context, so initial state
can come from a service or token:

```ts
const BOOK_SEARCH_STATE = new InjectionToken<BookSearchState>('BookSearchState', {
  factory: () => initialState,
});

const BookSearchStore = signalStore(withState(() => inject(BOOK_SEARCH_STATE)));
```

## 2. Providing and injecting

By default a SignalStore is **not** registered with any injector; add it to a `providers` array
at the component, route, or root level, then `inject` it.

```ts
@Component({
  /* ... */
  providers: [BookSearchStore], // component-scoped: tied to the component lifecycle
})
export class BookSearch {
  readonly store = inject(BookSearchStore);
}
```

Provide globally by passing `{ providedIn: 'root' }` as the first argument — a single shared
instance across the app:

```ts
export const BookSearchStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
);
```

Component-level provisioning is ideal for local/component state; `providedIn: 'root'` for global
state.

## 3. Reading state — signals & DeepSignal

For each state slice, a signal is generated automatically. Nested object properties become a
`DeepSignal`: readable as a whole and drilling into nested signals. Deeply nested signals are
created lazily on first access.

Given the state above, `BookSearchStore` exposes:

- `books: Signal<Book[]>`
- `isLoading: Signal<boolean>`
- `filter: DeepSignal<{ query: string; order: 'asc' | 'desc' }>`
- `filter.query: Signal<string>`
- `filter.order: Signal<'asc' | 'desc'>`

```ts
template: `
  <p>Books: {{ store.books() | json }}</p>
  <p>Query: {{ store.filter.query() }}</p>   <!-- nested signal -->
  <p>Pagination: {{ store.filter() | json }}</p> <!-- whole DeepSignal -->
`
```

**Union types.** When a slice's type is a union, `signalStore` creates a `DeepSignal` for each
object-literal member; primitives / dynamic records stay a regular `Signal`. Narrow with `in`
before drilling in:

```ts
type Status = { type: 'success'; data: string } | { type: 'error'; message: string };
// store.status: DeepSignal<{...success}> | DeepSignal<{...error}>
if ('message' in store.status) {
  console.log(store.status.message()); // Signal<string>
}
```

## 4. `withComputed`

Adds derived signals. The factory runs in the injection context and receives previously defined
state signals, props, and methods. Return `computed(...)` signals, or plain arrows (auto-wrapped
into computed).

```ts
import { computed } from '@angular/core';
import { signalStore, withComputed, withState } from '@ngrx/signals';

export const BookSearchStore = signalStore(
  withState(initialState),
  withComputed(({ books, filter }) => ({
    booksCount: computed(() => books().length),
    sortedBooks: () => {                       // auto-wrapped
      const dir = filter.order() === 'asc' ? 1 : -1;
      return books().toSorted((a, b) => dir * a.title.localeCompare(b.title));
    },
  })),
);
```

To let one computed reference another *within the same feature*, define a helper inside the
factory and return it alongside the rest (keeps everything in one call, which the team
recommends over splitting into cross-referencing features):

```ts
withComputed(({ filter }) => {
  const sortDirection = computed(() => (filter.order() === 'asc' ? 1 : -1));
  return { sortDirection, sortDirectionReversed: () => sortDirection() * -1 };
})
```

## 5. `withMethods`

Adds methods. The factory runs in the injection context and receives the store instance
(including previously defined signals, props, methods). Return a dictionary of functions.

```ts
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export const BookSearchStore = signalStore(
  withState(initialState),
  withMethods((store) => ({
    updateQuery(query: string): void {
      patchState(store, (state) => ({ filter: { ...state.filter, query } }));
    },
    updateOrder(order: 'asc' | 'desc'): void {
      patchState(store, (state) => ({ filter: { ...state.filter, order } }));
    },
  })),
);
```

Inject dependencies via a default parameter:

```ts
withMethods((store, booksService = inject(BooksService)) => ({
  async loadAll(): Promise<void> {
    patchState(store, { isLoading: true });
    const books = await booksService.getAll();
    patchState(store, { books, isLoading: false });
  },
}))
```

For reactive/cancelable side effects use `rxMethod` (see `reactivity.md`).

## 6. `withProps`

Adds static properties, observables, injected dependencies, or any other custom property to the
store (as opposed to signals or methods). The factory runs in the injection context. Use it when
you want to expose something that isn't state, a computed, or a method — e.g. an observable
derived from a signal, or a shared injected service. See the official "Custom Store Properties"
guide for details.

## 7. Updating state — `patchState`

`patchState(storeOrState, ...updaters)` is the only way to change state. Arguments after the
instance are partial-state objects and/or updater functions `(state) => partial`, applied left
to right.

```ts
import { patchState } from '@ngrx/signals';

patchState(store, { isLoading: true });
patchState(store, (state) => ({ filter: { ...state.filter, query } }));
patchState(store, { isLoading: false }, (state) => ({ books: [...state.books, book] }));
```

**Updates must be immutable** — never mutate `state`; spread to produce new objects.

### Custom state updaters

Factor repeated updates into functions returning a partial or a `PartialStateUpdater`. They test
easily, tree-shake, and combine in one `patchState` call:

```ts
import { PartialStateUpdater } from '@ngrx/signals';

function setFirstName(firstName: string): PartialStateUpdater<{ user: User }> {
  return (state) => ({ user: { ...state.user, firstName } });
}
const setAdmin = () => ({ isAdmin: true });

patchState(userState, setFirstName('Stevie'), setAdmin());
```

## 8. `protectedState`

By default the store's state is **protected**: it can only be updated from within the store's own
methods (external code calling `patchState(instance, ...)` is a type error). This is the
recommended default — it keeps the data flow predictable and update logic co-located.

Opt out only deliberately:

```ts
export const BookSearchStore = signalStore(
  { protectedState: false }, // ⚠️ now outside code can patchState the instance
  withState(initialState),
);
```

In review, treat `protectedState: false` as something that needs justification.

## 9. Lifecycle hooks — `withHooks`

Run logic on store init/destroy. Both hooks receive the store instance; `onInit` runs in the
injection context (so `inject`, `takeUntilDestroyed`, etc. work).

```ts
import { withHooks } from '@ngrx/signals';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

withHooks({
  onInit(store) {
    interval(2_000).pipe(takeUntilDestroyed()).subscribe(() => store.increment());
  },
  onDestroy(store) {
    console.log('count on destroy', store.count());
  },
})
```

Second signature — a factory — to share code between hooks or use injected deps in `onDestroy`:

```ts
withHooks((store) => {
  const logger = inject(Logger);
  let handle = 0;
  return {
    onInit() { handle = setInterval(() => store.increment(), 2_000); },
    onDestroy() { logger.info('count on destroy', store.count()); clearInterval(handle); },
  };
})
```

## 10. Custom features — `signalStoreFeature`

Encapsulate reusable patterns. `signalStoreFeature(...features)` merges features into one.

```ts
import { computed } from '@angular/core';
import { signalStoreFeature, withComputed, withState } from '@ngrx/signals';

export type RequestStatus = 'idle' | 'pending' | 'fulfilled' | { error: string };
export type RequestStatusState = { requestStatus: RequestStatus };

export function withRequestStatus() {
  return signalStoreFeature(
    withState<RequestStatusState>({ requestStatus: 'idle' }),
    withComputed(({ requestStatus }) => ({
      isPending: computed(() => requestStatus() === 'pending'),
      isFulfilled: computed(() => requestStatus() === 'fulfilled'),
      error: computed(() => {
        const s = requestStatus();
        return typeof s === 'object' ? s.error : null;
      }),
    })),
  );
}

// Prefer standalone updaters over feature methods — tree-shakeable, testable, composable:
export const setPending = (): RequestStatusState => ({ requestStatus: 'pending' });
export const setFulfilled = (): RequestStatusState => ({ requestStatus: 'fulfilled' });
export const setError = (error: string): RequestStatusState => ({ requestStatus: { error } });
```

Compose features in a store:

```ts
export const BooksStore = signalStore(
  withEntities<Book>(),
  withRequestStatus(),
  withMethods((store, booksService = inject(BooksService)) => ({
    async loadAll() {
      patchState(store, setPending());
      const books = await booksService.getAll();
      patchState(store, setAllEntities(books), setFulfilled());
    },
  })),
);
```

### Features with required input

A feature can require the host store to already expose certain state/props/methods, declared with
the `type` helper as the first argument. This gives compile-time errors if the host is missing
them:

```ts
import { signalStoreFeature, type, withComputed, withState } from '@ngrx/signals';
import { EntityId, EntityState } from '@ngrx/signals/entities';

export type SelectedEntityState = { selectedEntityId: EntityId | null };

export function withSelectedEntity<Entity>() {
  return signalStoreFeature(
    { state: type<EntityState<Entity>>() }, // requires withEntities to be present
    withState<SelectedEntityState>({ selectedEntityId: null }),
    withComputed(({ entityMap, selectedEntityId }) => ({
      selectedEntity: computed(() => {
        const id = selectedEntityId();
        return id ? entityMap()[id] : null;
      }),
    })),
  );
}
```

A custom feature that accepts input **should define a generic type** (ESLint:
`signal-store-feature-should-use-generic-type`). Prefer loosely-coupled, independent features.

### Logging feature example

```ts
import { effect } from '@angular/core';
import { getState, signalStoreFeature, withHooks } from '@ngrx/signals';

export function withLogger(name: string) {
  return signalStoreFeature(
    withHooks({
      onInit(store) {
        effect(() => console.log(`${name} state changed`, getState(store)));
      },
    }),
  );
}
```

`getState(store)` returns the full current state object — handy for logging/devtools.

## 11. Class-based stores and typing

The functional style is recommended, but a class can extend `signalStore(...)`:

```ts
@Injectable()
export class CounterStore extends signalStore(
  { protectedState: false },
  withState({ count: 0 }),
) {
  readonly doubleCount = computed(() => this.count() * 2);
  increment(): void { patchState(this, { count: this.count() + 1 }); }
}
```

Get a store's type with `InstanceType`, and to inject via constructor, export a type of the same
name:

```ts
export const CounterStore = signalStore(withState({ count: 0 }));
export type CounterStore = InstanceType<typeof CounterStore>;

@Component({ /* ... */ })
export class Counter {
  constructor(readonly store: CounterStore) {}
}
```

## 12. Testing

A SignalStore is an Angular service — test it with `TestBed` (needed for DI and the injection
context that `rxMethod`, `signalMethod`, and `inject` require; `new` won't work for those).
Assert on the **public API only** — initial state, computed values, and the effect of calling
methods — not internal state, and don't spy on the store's own methods (extract complex logic
into a service and mock that instead).

```ts
// providedIn: 'root'  → TestBed.inject(CounterStore) is enough.
// local store          → provide it in the testing module first.
describe('CounterStore', () => {
  it('derives doubleCount and updates on increment', () => {
    TestBed.configureTestingModule({ providers: [CounterStore] });
    const store = TestBed.inject(CounterStore);
    expect(store.doubleCount()).toBe(0);
    store.increment();
    expect(store.doubleCount()).toBe(2);
  });
});
```

**`unprotected` helper** (`@ngrx/signals/testing`): wraps a protected store instance to return a
writable view so a test can `patchState` it directly when there's no public setter.

```ts
import { unprotected } from '@ngrx/signals/testing';
patchState(unprotected(store), { count: 5 });
```
