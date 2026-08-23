# RailMind

Rail maintenance decision intelligence.

> Which assets will hurt us next, why, and what should we do this week.

RailMind is an **intelligence layer over Maximo, not a replacement for it.**
The asset register and work orders stay where they belong; RailMind adds the
decision: a health index, a failure risk with named drivers, and a
recommended action that a human engineer reviews before it goes anywhere.

## Product Authority

| | |
|---|---|
| **Primary User** | Chief engineer / maintenance director and their reliability engineers |
| **Job To Be Done** | Decide which assets to act on this week, with evidence |
| **System of Record** | Risk assessments, drivers, recommendations, engineer reviews, outcomes |
| **System of Intelligence** | Health scoring, failure-risk forecasting, driver attribution, prioritisation |
| **Explicit Non-Goals** | Replacing Maximo · operational or signalling control · generic BI · contract compliance (→ VERTEX) |

Full statement: [`docs/PRODUCT_AUTHORITY.md`](docs/PRODUCT_AUTHORITY.md).

## The rule that outranks every feature

RailMind **recommends**; an engineer **decides**. A recommendation on a
high-risk asset cannot leave the system without named engineer review, and
RailMind performs no safety-critical rail control action of any kind. It
*proposes* a Maximo work order; it never raises one by itself.

## Roadmap

- **P0 · See the risk** — network health map, asset view with drivers and
  evidence, recommendations behind the engineer-review gate, sample dataset
  so the product is explorable before any integration.
- **P1 · Real data** — Maximo read integration, condition-monitoring feed,
  CSV/XLSX import, outcome capture.
- **P2 · Learn** — forecast accuracy tracking, driver calibration, evaluation
  packs run through the AI Assurance Lab.

## KPI

`maintenance decisions that prevented a measurable failure or cost`
