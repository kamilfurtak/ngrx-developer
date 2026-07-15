# Classic Store & Effects (Redux-style)

`@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`. Use for existing Redux-style codebases, or when
the team wants a strict global action log with Redux DevTools time-travel. For new code, prefer
SignalStore (see `signalstore.md`); the Events plugin (`events-plugin.md`) offers this same
dispatch-and-reduce flow on top of SignalStore.

## Contents
1. Actions
2. Reducers & registration
3. Selectors
4. Feature creators (`createFeature`)
5. Effects
6. `@ngrx/entity`

---

## 1. Actions

Actions are unique **events** (not commands). Shape: `{ type: '[Source] Event', ...props }`.
Create with `createAction` + `props`:

```ts
import { createAction, props } from '@ngrx/store';

export const login = createAction(
  '[Login Page] Login',
  props<{ username: string; password: string }>(),
);

store.dispatch(login({ username, password }));
```

Guidelines: write actions upfront; divide by event source; many small actions are fine; capture
**events not commands**; be descriptive. The `[Source]` names where it came from; the text names
what happened. (Class-based action creators are legacy — use `createAction`.)

**Dispatching from signals:** `store.dispatch(() => loadBook({ id: bookId() }))` re-dispatches
whenever `bookId` changes; inside an injection context the signal is tracked until the context is
destroyed. Outside one, pass `{ injector }` or manage the returned `EffectRef` for cleanup.

## 2. Reducers & registration

Reducers are **pure, synchronous** functions handling state transitions immutably via
`createReducer` + `on`.

```ts
import { createReducer, on } from '@ngrx/store';
import * as ScoreboardPageActions from './scoreboard-page.actions';

export interface State { home: number; away: number; }
export const initialState: State = { home: 0, away: 0 };

export const scoreboardReducer = createReducer(
  initialState,
  on(ScoreboardPageActions.homeScore, (state) => ({ ...state, home: state.home + 1 })),
  on(ScoreboardPageActions.resetScore, () => ({ home: 0, away: 0 })),
  on(ScoreboardPageActions.setScores, (state, { game }) => ({ home: game.home, away: game.away })),
);
```

All registered reducers receive every action; `on` decides which to handle. Spread for
immutability (shallow — copy each nested level).

**Standalone registration (preferred over NgModule):**

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideStore, provideState } from '@ngrx/store';

bootstrapApplication(AppComponent, {
  providers: [
    provideStore(),                                     // keep root empty
    provideState({ name: 'game', reducer: scoreboardReducer }), // register feature state
  ],
});
```

Feature state can also be registered in a route's `providers: [provideState(booksFeature)]`.
(NgModule equivalents: `StoreModule.forRoot({})` / `StoreModule.forFeature(...)`.)

## 3. Selectors

Pure, **memoized** functions for reading slices. `createSelector` (up to 8 input selectors) and
`createFeatureSelector`.

```ts
import { createSelector } from '@ngrx/store';

export const selectUser = (state: AppState) => state.selectedUser;
export const selectAllBooks = (state: AppState) => state.allBooks;

export const selectVisibleBooks = createSelector(
  selectUser, selectAllBooks,
  (user, books) => (user ? books.filter((b) => b.userId === user.id) : books),
);
```

Dictionary form (auto-projector): `createSelector({ books: selectBooks, query: selectQuery })`
yields `{ books, query }`. Selectors are memoized, so they only recompute when inputs change —
**combine at the selector level** rather than mapping in components. Name them `select*`. (Note:
selectors-with-props are deprecated and removed in v23 — pass runtime data via a factory returning
a selector instead.)

## 4. Feature creators — `createFeature`

Reduces selector boilerplate: generates the feature selector and a child selector per state
property.

```ts
import { createFeature, createReducer, on } from '@ngrx/store';

export const booksFeature = createFeature({
  name: 'books',
  reducer: createReducer(
    initialState,
    on(BookListPageActions.enter, (state) => ({ ...state, loading: true })),
    on(BooksApiActions.loadBooksSuccess, (state, { books }) => ({ ...state, books, loading: false })),
  ),
});

export const {
  name, reducer,
  selectBooksState, // feature selector ("select" + name + "State")
  selectBooks, selectLoading, // one per state property
} = booksFeature;
```

Add `extraSelectors: ({ selectBooks, selectQuery }) => ({ ... })` for derived selectors. Register
with `provideState(booksFeature)`. **Restriction:** no optional state properties — replace `prop?`
with `prop: T | null` (or `| undefined`) and include it in the initial state.

## 5. Effects

RxJS-powered side effects that listen to the action stream and (usually) dispatch new actions.
Isolate side effects from components. Since v15.2 effects can be **functional** (no class).

**Functional effect (preferred for new classic code):**

```ts
import { inject } from '@angular/core';
import { catchError, exhaustMap, map, of } from 'rxjs';
import { Actions, createEffect, ofType } from '@ngrx/effects';

export const loadActors = createEffect(
  (actions$ = inject(Actions), actorsService = inject(ActorsService)) =>
    actions$.pipe(
      ofType(ActorsPageActions.opened),
      exhaustMap(() =>
        actorsService.getAll().pipe(
          map((actors) => ActorsApiActions.actorsLoadedSuccess({ actors })),
          catchError((error: { message: string }) =>
            of(ActorsApiActions.actorsLoadedFailure({ error: error.message })),
          ),
        ),
      ),
    ),
  { functional: true },
);
```

**Class-based effect:**

```ts
@Injectable()
export class MoviesEffects {
  private actions$ = inject(Actions);
  private moviesService = inject(MoviesService);

  loadMovies$ = createEffect(() =>
    this.actions$.pipe(
      ofType('[Movies Page] Load Movies'),
      exhaustMap(() =>
        this.moviesService.getAll().pipe(
          map((movies) => ({ type: '[Movies API] Movies Loaded Success', payload: movies })),
          catchError(() => of({ type: '[Movies API] Movies Loaded Error' })),
        ),
      ),
    ),
  );
}
```

Key points: filter with `ofType`; **always** nest the API call inside a flattening operator
(`mergeMap`/`concatMap`/`exhaustMap`/`switchMap`) and `catchError` on the *inner* stream so an
error returns a new action instead of killing the effect. One effect should map one action to one
action; don't `dispatch` from inside effects (ESLint enforces both). Register with
`provideEffects([MoviesEffects])` / `provideEffects(loadActors)` (standalone) or
`EffectsModule.forRoot/forFeature`.

## 6. `@ngrx/entity`

Classic entity management. `createEntityAdapter<T>()` gives an `EntityState<T>` (`ids` +
`entities` map) and CRUD adapter methods (`addOne`, `setAll`, `updateOne`, `upsertMany`,
`removeOne`, …) used inside reducers, plus `adapter.getSelectors()` for `selectAll`, `selectEntities`,
`selectIds`, `selectTotal`. In Signals code, prefer `@ngrx/signals/entities` (`entities.md`).
