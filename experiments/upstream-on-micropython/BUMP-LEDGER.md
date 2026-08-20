# BUMP LEDGER — upstream build123d 0.11.1 → dev@44a8d7c1 (the future 0.12)

The deliverable of the `feat/upstream-b123d-dev-bump` experiment: every
category of work the version bump forced, with actual effort, to price
future bumps honestly. Target tree: gumyr/build123d@44a8d7c1 (239 commits
past v0.11.1; +2,453/−2,094 lines; build_common rebuilt around an immutable
`BuildScope` + a `BaseObjectMeta` construction-firewall METACLASS;
objects_curve refactored ~1,000 lines; new modules build_constants.py and
pack_utils.py).

Clock started 2026-08-20 11:30 PDT.

## A. Vendoring mechanics — ~40 min

| Task | Effort |
|---|---|
| Parameterize fetch-upstream-b123d.cjs (`--src/--out/--provenance`), add build_constants/pack_utils to FILES | 15 min |
| Vendor tree + LICENSE/NOTICE/provenance README; .gitignore allowlist entry | 5 min |
| Single active-version switch: `ACTIVE_UPSTREAM_VENDOR` const in UpstreamB123d.js; per-vendor module lists; build.cjs reads the const; MicroPythonRuntime dev-path + PoC default follow it | 20 min |

## B. Loader module list — ~10 min

- dev split `build_constants` out of build_common (compat re-import kept
  upstream-side) and `pack_utils` out of pack → two new entries, ordered
  before their importers. Keyed per vendor so 0.11.1 flip-back is intact.

## C. New source transforms — ~45 min (incl. diagnosis)

| Transform | Trigger | Effort |
|---|---|---|
| `stripPositionalOnlyMarkers` — PEP 570 `/` in def signatures (objects_curve `_localize` overload) | SyntaxError | 15 min |
| `rewriteDataclassFields` must STOP at the first def/decorator in the class body — dev's `BuildScope.derive()` has annotated kwonly params that the 0.11.1-era scan rewrote into statements | SyntaxError | 15 min |
| `cleanClassBases` strips `metaclass=<Name>` (accepting only BaseObjectMeta/ABCMeta, refusing others loudly) | SyntaxError (`class X(metaclass=M)` is a MicroPython TypeError) | 15 min |

## D. New stdlib shims — ~45 min

| Shim | Trigger | Effort |
|---|---|---|
| `contextlib` (AbstractContextManager + generator `contextmanager` + suppress) — MicroPython ships none | build_common import | 20 min |
| `itertools` superset (product, cycle, permutations, starmap, chain, combinations) — settrace build's builtin is partial | build_common `product`, operations_part `cycle/permutations/starmap` | 15 min |
| `dataclasses` upgrade: per-instance `default_factory` (BuildScope's identity-Location fields DOCUMENT that sharing is a bug) + `__post_init__` call | silent wrong geometry risk + validation loss | 10 min |

## E. New seam names / methods

| Item | Trigger | Effort |
|---|---|---|
| `Shape._wrapped` getter (dev build_common reads it raw in `_PublicationService.place`'s None-guard) + `Shape.wrapped` SETTER (publish(preserve_identity=True) assigns `.wrapped`) | Line published as None → builders empty | 20 min (diagnosis-heavy) |
| `_cs_current_builder()` in _finalize: dev deleted `Builder._current` (ContextVar) for the unified scope stack → version-agnostic helper for the seam's lite-op bridges | AttributeError at runtime | 10 min |

## F. The metaclass emulation (the big structural item) — ~1.5 h

Dev's `BaseObject(metaclass=BaseObjectMeta)` wraps EVERY builder-object
construction in an isolated BuildScope and publishes the finished instance
to its captured Builder. MicroPython has no metaclasses. Emulation
(in _finalize, guarded by `hasattr(build_common, 'BaseObjectMeta')`):

- `BaseObject.__new__` replacement = everything `BaseObjectMeta.__call__`
  did BEFORE construction (validate `_applies_to`, capture location/builder
  contexts, build + PUSH the isolated scope, set `owner.root`), leaving the
  pending (scope, token) on the instance. (Probed first: MicroPython's DFS
  attribute lookup DOES reach `BaseObject.__new__` through
  `BasePartObject(Part, BaseObject)`, and `__init__` still runs after a
  custom `__new__`.)
- Wrappers on the five terminal publisher `__init__`s (Base{Part,Sketch,
  Curve,Line,Edge}Object): pop + `_publish_to_context` when the outermost
  `__init__` completes. Rides on upstream's own convention that subclass
  `__init__` ENDS with `super().__init__(...)`.
- KNOWN COMPROMISES: statements after the terminal super() call would run
  outside the isolated scope (no library object does this); an `__init__`
  that raises before reaching the terminal super() leaks the pushed scope
  until the worker's between-runs `_cs_reset_all`.

## G. Intentional dev behavior changes (vs the 0.11.1 native reference)

(filled during the harness pass)

## H. Dev bugs found

(filled during the harness pass)

## Milestones

- 12:45 PDT: PoC goals (BuildLine length 20; BuildPart Box volume 125) pass
  on dev sources in the node inner loop.
