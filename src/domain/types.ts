// RailMind domain model.
//
// Deliberately small: RailMind owns decisions, not the asset register.
// Every field here exists because a maintenance decision needs it.

export type AssetClass =
  | 'track'
  | 'points'
  | 'signalling'
  | 'traction_power'
  | 'rolling_stock'
  | 'depot';

/** Health band. Colour is derived from this, never the other way round. */
export type HealthBand = 'healthy' | 'watch' | 'critical';

export type RiskBand = 'low' | 'medium' | 'high';

export interface ConditionSignal {
  /** What was measured, in the engineer's language. */
  name: string;
  /** Percentage change against this asset's own baseline. */
  changePct: number;
  /** How much this signal contributes to the risk, 0..1. */
  weight: number;
}

export interface Asset {
  id: string;
  name: string;
  assetClass: AssetClass;
  /** Line or area the asset belongs to, for the network map. */
  section: string;
  /** Position along the line, 0..1, for map layout. */
  position: number;
  /** 0..100. Lower is worse. */
  healthIndex: number;
  /** Health index 90 days ago, for trend. */
  healthIndex90dAgo: number;
  /** Failures recorded in the last 12 months. */
  failures12m: number;
  /** Days since the last completed preventive maintenance. */
  daysSinceLastPm: number;
  /** Planned PM interval in days. */
  pmIntervalDays: number;
  /** Open Maximo work orders against this asset. */
  openWorkOrders: number;
  /** Does a failure here stop service? */
  serviceCritical: boolean;
  signals: ConditionSignal[];
}

export interface RiskDriver {
  name: string;
  /** Share of the risk score this driver accounts for, 0..1. */
  contribution: number;
  detail: string;
}

export type ActionKind =
  | 'inspect'
  | 'schedule_pm'
  | 'replace_component'
  | 'monitor';

export interface Recommendation {
  assetId: string;
  action: ActionKind;
  /** Plain instruction an engineer can act on. */
  summary: string;
  /** Hours until the action should start. */
  withinHours: number;
  /** Why: the ranked drivers behind it. */
  drivers: RiskDriver[];
  /** 0..1 confidence in the risk assessment behind this action. */
  confidence: number;
  /**
   * High-risk recommendations may not leave the system without a named
   * engineer's review. This is a product rule, not a UI preference.
   */
  requiresEngineerReview: boolean;
}

export interface Assessment {
  asset: Asset;
  healthBand: HealthBand;
  /** 0..100. Higher is worse. */
  riskScore: number;
  riskBand: RiskBand;
  /** Positive means health improved over 90 days. */
  trend90d: number;
  drivers: RiskDriver[];
  recommendation: Recommendation;
}
