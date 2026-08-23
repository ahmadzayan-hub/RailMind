# Product Authority — RailMind (33)

The single, non-negotiable statement of what this product owns. No other
product in the portfolio may claim these responsibilities, and this product
may not expand into anyone else's.

## Primary User

The maintenance decision-maker on a rail network: the chief engineer,
maintenance director, and the reliability engineers who prepare their
recommendations.

## Job To Be Done

Answer, every morning, with evidence: **which assets will hurt us next, why,
and what should we do about them this week.**

## System of Record

RailMind owns none of the operational truth. It owns **its own decision
layer**: risk assessments, their drivers, recommended actions, engineer
review outcomes, and the audit trail of what was proposed, reviewed,
accepted or rejected, and what happened afterwards.

The asset register, work orders and maintenance history remain in **Maximo**.
RailMind never becomes a second copy of them.

## System of Intelligence

- Asset health scoring from condition, failure history and inspection data
- Failure-risk forecasting with named drivers, not a bare number
- Recommended interventions, prioritised by risk and consequence
- Learning from outcomes: did the recommended action prevent the failure

## Primary Workflow

```
Ingest (Maximo · condition monitoring · inspections · CSV/XLSX)
  → Asset health index + failure risk with drivers
  → Network health map: where is the risk, right now
  → Asset view: health, trend, drivers, evidence
  → Recommended action
  → Engineer review (mandatory for high risk)
  → Propose a Maximo work order
  → Outcome recorded and fed back
```

## Human Decision Boundary

- RailMind **recommends**. A human engineer decides.
- Any recommendation on a **high-risk** asset requires named engineer review
  before it can leave the system. This gate cannot be skipped from the
  interface.
- RailMind **proposes** a Maximo work order; it never raises, closes, or
  modifies one autonomously.
- RailMind performs **no safety-critical rail control action** of any kind:
  no possession, no speed restriction, no isolation, no signalling change.
- Every recommendation carries its drivers and the data behind them. A
  recommendation with no evidence is not shown.

## Measurable Outcome

**North star:** maintenance decisions that prevented a measurable failure or
cost.

Supporting: forecast precision on high-risk assets, share of recommendations
accepted by engineers, reduction in unplanned corrective work orders,
reduction in repeat failures on the same asset.

## Explicit Non-Goals

- Not a replacement for Maximo, and not an EAM system
- Not an operational control or signalling system
- Not a generic BI tool over maintenance tables
- Does not own contracts or supplier compliance → **VERTEX**
- Does not own executive commitments and follow-up → **ExecFlow**
- Does not own KPI targets and monthly management review → **Annual Plan**

## External Systems

- **Maximo** — asset register, work orders, maintenance history (system of
  record; read, and propose back)
- Condition monitoring and alarm feeds
- Inspection reports and CSV/XLSX imports
- **AI Assurance Lab (44)** — evaluates any model-backed scoring before it
  reaches production
- **Annual Plan** — consumes maintenance outcomes; RailMind does not
  recompute plan KPIs

## Data Ownership

RailMind owns its own database of assessments, reviews and outcomes. Other
products receive results through APIs and versioned domain events, never by
reading these tables. Asset and work-order data stays authoritative in
Maximo; RailMind holds only what it needs to explain a decision, and links
back rather than duplicating.
