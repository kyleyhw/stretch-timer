# Documentation

Documentation hub for **Stretch Timer**. See the [README](../README.md) for a project overview
and the [development plan](../PROJECT_PLAN.md) for status.

## Contents

| Document                         | Purpose                                                                    | Status      |
| -------------------------------- | -------------------------------------------------------------------------- | ----------- |
| `architecture.md`                | Module structure, hash routing, state-driven rendering                     | forthcoming |
| [`timer-math.md`](timer-math.md) | Drift-free countdown derivation, pause/resume invariant, display rule      | available   |
| `data-model.md`                  | Stretch/routine JSON schema, `localStorage` layout, session step-expansion | forthcoming |

## Test reports

Unit-test reports (with runtimes) live in [`../tests/reports/`](../tests/reports/):

- [`timer.md`](../tests/reports/timer.md) — countdown engine (9 tests, drift analysis)
