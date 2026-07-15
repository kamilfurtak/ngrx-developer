# Entity management — `@ngrx/signals/entities`

The `withEntities` feature plus standalone updaters for managing entity collections in a
SignalStore. (For classic `@ngrx/entity`, see `classic-store.md`.)

## Contents

- [`withEntities`](#withentities)
- [Updaters](#updaters-use-with-patchstate)
- [Custom id selector](#custom-id-selector)
- [Named collections](#named-collections)
- [`withSelectedEntity`](#withselectedentity-custom-feature)

## `withEntities`

Adds entity state. By default entities need an `id` of type `EntityId` (`string | number`).

```ts
import { signalStore } from '@ngrx/signals';
import { withEntities } from '@ngrx/signals/entities';

type Todo = { id: number; text: string; completed: boolean };

export const TodosStore = signalStore(withEntities<Todo>());
```

Adds to the store:

- `ids: Signal<EntityId[]>` — state slice
- `entityMap: Signal<EntityMap<Todo>>` — state slice (id → entity)
- `entities: Signal<Todo[]>` — **computed** array of all entities

## Updaters (use with `patchState`)

All standalone functions from `@ngrx/signals/entities`. None throw if the target id doesn't exist.

```ts
import { patchState, signalStore, withMethods } from '@ngrx/signals';
import { addEntity, removeEntities, updateAllEntities, withEntities } from '@ngrx/signals/entities';

export const TodosStore = signalStore(
  withEntities<Todo>(),
  withMethods((store) => ({
    addTodo(todo: Todo) { patchState(store, addEntity(todo)); },
    removeEmpty() { patchState(store, removeEntities(({ text }) => !text)); },
    completeAll() { patchState(store, updateAllEntities({ completed: true })); },
  })),
);
```

Add:
- `addEntity(todo)` / `addEntities([a, b])` — ignored if id already present.
- `prependEntity(todo)` / `prependEntities([a, b])` — insert at the beginning; ignored if present.

Update (partial; `changes` can be an object or `(entity) => partial`):
- `updateEntity({ id, changes })`
- `updateEntities({ ids, changes })` or `updateEntities({ predicate, changes })`
- `updateAllEntities(changes)`

Set (add or replace):
- `setEntity(todo)` / `setEntities([a, b])`
- `setAllEntities([a, b, c])` — replaces the whole collection.

Upsert (add or **merge** — only provided props change, others remain):
- `upsertEntity(todo)` / `upsertEntities([a, b])`

Remove:
- `removeEntity(1)`
- `removeEntities([1, 2])` or `removeEntities((todo) => todo.completed)`
- `removeAllEntities()`

## Custom id selector

If the identifier isn't named `id`, pass a `SelectEntityId` via the config arg on `add*`, `set*`,
and `update*` (not needed for `remove*`, which infers the id):

```ts
import { SelectEntityId, addEntities, setEntity, updateAllEntities, withEntities } from '@ngrx/signals/entities';

type Todo = { key: number; text: string; completed: boolean };
const selectId: SelectEntityId<Todo> = (todo) => todo.key;

withMethods((store) => ({
  addTodos(todos: Todo[]) { patchState(store, addEntities(todos, { selectId })); },
  setTodo(todo: Todo) { patchState(store, setEntity(todo, { selectId })); },
  completeAll() { patchState(store, updateAllEntities({ completed: true }, { selectId })); },
  removeTodo(key: number) { patchState(store, removeEntity(key)); }, // no selectId needed
}))
```

## Named collections

Give a collection a prefix so a store can hold several. Specify the entity type with `type<T>()`
and a `collection` name:

```ts
import { signalStore, type } from '@ngrx/signals';
import { withEntities } from '@ngrx/signals/entities';

export const TodosStore = signalStore(
  withEntities({ entity: type<Todo>(), collection: 'todo' }),
);
```

Properties become `todoIds`, `todoEntityMap`, `todoEntities`. **All updaters on a named
collection require the collection name** (passed in their config object, e.g.
`addEntity(todo, { collection: 'todo' })`).

## `withSelectedEntity` (custom feature)

A reusable feature that tracks a selected entity. It requires the host store to already have
`withEntities` (declared via the `type` helper input), giving a compile error otherwise. See
`signalstore.md` §10 for the full implementation. Adds `selectedEntityId` state and a
`selectedEntity` computed signal.
