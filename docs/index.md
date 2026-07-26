# Documentation

Documentation hub for **Stretch Timer**. See the [README](../README.md) for a project overview
and the [development plan](../PROJECT_PLAN.md) for status.

## Contents

| Document                             | Purpose                                                                     | Status    |
| ------------------------------------ | --------------------------------------------------------------------------- | --------- |
| [`architecture.md`](architecture.md) | Module structure, hash routing, rendering, PWA                              | available |
| [`timer-math.md`](timer-math.md)     | Drift-free countdown derivation, pause/resume invariant, display rule       | available |
| [`data-model.md`](data-model.md)     | Schema, session expansion, progress, pause-between, custom stretches, share | available |

## Test reports

Unit-test reports (with runtimes) live in [`../tests/reports/`](../tests/reports/):

- [`timer.md`](../tests/reports/timer.md) — countdown engine (9 tests, drift analysis)
- [`session.md`](../tests/reports/session.md) — session state machine (20 tests)
- [`store.md`](../tests/reports/store.md) — persistence store (6 tests)
- [`data.md`](../tests/reports/data.md) — custom-stretch merge & share/export (11 tests)
