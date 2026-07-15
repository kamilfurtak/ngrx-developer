# NgRx Developer Agent Skill

[![skills.sh](https://skills.sh/b/kamilfurtak/ngrx-developer)](https://skills.sh/kamilfurtak/ngrx-developer)

An agent skill for designing, implementing, reviewing, testing, debugging, and migrating Angular state management with NgRx.

It combines concise, agent-oriented guidance with a pinned snapshot of the official NgRx documentation. Agents load the curated references first and use the full documentation snapshot when exact API details, edge cases, or migrations matter.

## Install

```bash
npx skills add kamilfurtak/ngrx-developer --skill ngrx-developer -g
```

To install for a specific supported agent, add its identifier, for example:

```bash
npx skills add kamilfurtak/ngrx-developer --skill ngrx-developer -g -a codex
```

## Update

```bash
npx skills update ngrx-developer -g
```

## Included coverage

- `@ngrx/signals`, SignalStore, entity management, RxJS interop, and Events
- classic `@ngrx/store`, Effects, selectors, reducers, actions, and Entity
- ComponentStore, Router Store, NgRx Data, Store DevTools, operators, and schematics
- NgRx ESLint rules, testing patterns, and version migrations
- official NgRx 21.1.1 guide snapshot pinned to commit `fa0780ee1a4ecd0ceead4566c11795041d5f12e4`

## Repository layout

```text
skills/ngrx-developer/
├── SKILL.md
├── agents/openai.yaml
└── references/
    ├── *.md
    └── guide/
```

The skill follows the open [Agent Skills specification](https://agentskills.io/specification) and is discoverable by the [skills CLI](https://github.com/vercel-labs/skills).

## Licensing

The skill instructions and curated references are licensed under the repository MIT license. The bundled NgRx documentation remains under the NgRx MIT license included at `skills/ngrx-developer/references/ngrx-license.txt`.

This project is not affiliated with or endorsed by the NgRx team.
