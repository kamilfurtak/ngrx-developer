# Events plugin — `@ngrx/signals/events`

Since NgRx 19.2, the Events plugin adds a **Flux/Redux-style** layer to SignalStore: define
events, dispatch them, handle them with reducers and effect-like event handlers, keeping a
unidirectional flow. Reach for it in advanced scenarios — inter-store coordination or a decoupled
architecture. The default SignalStore approach (`withMethods` + `patchState`) is enough for most
cases.

Building blocks: **Event** (an occurrence, optionally with a payload) → **Dispatcher** (event bus)
→ **Store** (reducers + event handlers) → **View** (reads state, dispatches events).

## Contents

- [Defining events](#defining-events)
- [State transitions](#state-transitions--withreducer)
- [Side effects](#side-effects--witheventhandlers)
- [Dispatching events](#dispatching-events)
- [Scoped events](#scoped-events)

## Defining events

`event(type, payloadSchema?)` for one creator; `eventGroup({ source, events })` to group creators
under a source. Types are formatted `"[Source] EventName"`.

```ts
import { type } from '@ngrx/signals';
import { event, eventGroup } from '@ngrx/signals/events';
import { Book } from './book';

export const opened = event('[Book Search Page] Opened');
export const queryChanged = event('[Book Search Page] Query Changed', type<string>());

export const booksApiEvents = eventGroup({
  source: 'Books API',
  events: {
    loadedSuccess: type<Book[]>(),
    loadedFailure: type<string>(),
  },
});
// booksApiEvents.loadedSuccess([b1, b2]) -> { type: '[Books API] loadedSuccess', payload: [...] }
```

## State transitions — `withReducer`

Map events to state changes with `on`. A handler receives `(event, state)` and returns a partial
state object, a partial state updater, or an array of them.

```ts
import { signalStore, withState } from '@ngrx/signals';
import { on, withReducer } from '@ngrx/signals/events';

export const BookSearchStore = signalStore(
  withState({ query: '', books: [] as Book[], isLoading: false }),
  withReducer(
    on(opened, () => ({ isLoading: true })),
    on(queryChanged, ({ payload: query }) => ({ query, isLoading: true })),
    on(booksApiEvents.loadedSuccess, ({ payload: books }) => ({ books, isLoading: false })),
    on(booksApiEvents.loadedFailure, () => ({ isLoading: false })),
  ),
);
```

## Side effects — `withEventHandlers`

Effect-like handlers. The factory receives the store and returns a dictionary or array of
observables. Use the `Events` service's `on(...)` to get an observable of matching events; if a
handler emits a new event, it's dispatched automatically. Use `mapResponse`/`tapResponse` from
`@ngrx/operators` for success/error mapping.

```ts
import { switchMap, tap } from 'rxjs';
import { Events, withEventHandlers } from '@ngrx/signals/events';
import { mapResponse } from '@ngrx/operators';

withEventHandlers((store, events = inject(Events), booksService = inject(BooksService)) => ({
  loadBooksByQuery$: events.on(opened, queryChanged).pipe(
    switchMap(() =>
      booksService.getByQuery(store.query()).pipe(
        mapResponse({
          next: (books) => booksApiEvents.loadedSuccess(books),
          error: (e: { message: string }) => booksApiEvents.loadedFailure(e.message),
        }),
      ),
    ),
  ),
  logError$: events.on(booksApiEvents.loadedFailure).pipe(
    tap(({ payload }) => console.error(payload)),
  ),
}))
```

Handlers can also listen to any observable (e.g. `timer(0, 30_000)`), and return an array. For
custom state transitions that `withReducer` can't express, inject `ReducerEvents` instead of
`Events` — it receives events *before* `Events`, so state is updated before other handlers react.

## Dispatching events

Inject the `Dispatcher` and call `dispatch`:

```ts
import { Dispatcher } from '@ngrx/signals/events';

readonly dispatcher = inject(Dispatcher);
open() { this.dispatcher.dispatch(opened()); }
search(q: string) { this.dispatcher.dispatch(queryChanged(q)); }
```

Or reduce boilerplate with `injectDispatch(eventCreators)`, which returns an object of methods
that create and dispatch each event:

```ts
import { injectDispatch } from '@ngrx/signals/events';

readonly dispatch = injectDispatch(bookSearchEvents);
// template: (ngModelChange)="dispatch.queryChanged($event)"
// this.dispatch.opened();
```

## Scoped events

By default `Dispatcher` and `Events` are global. Isolate a feature/subtree with
`provideDispatcher()` (e.g. local state or micro-frontends); events dispatched inside the boundary
belong to the local scope unless explicitly forwarded via the dispatch config.
