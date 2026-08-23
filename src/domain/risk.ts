// The risk engine.
//
// Deterministic and explainable on purpose: an engineer must be able to see
// why an asset scored what it scored, and a recommendation with no drivers
// is never produced. Weights live here, in one place, so they can be
// reviewed and later calibrated against outcomes.

import type {
  Asset,
  Assessment,
  HealthBand,
  Recommendation,
  RiskBand,
  RiskDriver,
} from './types';

export const HEALTH_THRESHOLDS = { watch: 75, critical: 55 } as const;
export const RISK_THRESHOLDS = { medium: 40, high: 70 } as const;

/**
 * Scoring weights, in one reviewable place so an engineer can challenge them
 * and P2 can calibrate them against recorded outcomes. Both the score and
 * the driver breakdown use these, so the explanation always matches the
 * number it explains.
 */
export const DEGRADATION_WEIGHT = 0.7;
export const FAILURE_WEIGHT = 6;
export const OVERDUE_WEIGHT = 25;
export const SIGNAL_WEIGHT = 0.25;
export const DECLINE_WEIGHT = 0.4;

export function healthBand(healthIndex: number): HealthBand {
  if (healthIndex < HEALTH_THRESHOLDS.critical) return 'critical';
  if (healthIndex < HEALTH_THRESHOLDS.watch) return 'watch';
  return 'healthy';
}

export function riskBand(riskScore: number): RiskBand {
  if (riskScore >= RISK_THRESHOLDS.high) return 'high';
  if (riskScore >= RISK_THRESHOLDS.medium) return 'medium';
  return 'low';
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(Math.max(n, min), max);
}

/** How overdue preventive maintenance is, as a ratio of its own interval. */
export function pmOverdueRatio(asset: Asset): number {
  if (asset.pmIntervalDays <= 0) return 0;
  return Math.max(0, asset.daysSinceLastPm - asset.pmIntervalDays) / asset.pmIntervalDays;
}

/**
 * Risk drivers, ranked. Each driver states its own contribution so the
 * recommendation can be explained rather than asserted.
 */
export function riskDrivers(asset: Asset): RiskDriver[] {
  const raw: RiskDriver[] = [];

  // Only a health index that has left the healthy band is a driver: an
  // asset at 90/100 has nothing for an engineer to act on.
  if (asset.healthIndex < HEALTH_THRESHOLDS.watch) {
    raw.push({
      name: 'Condition degradation',
      contribution: clamp(100 - asset.healthIndex) * DEGRADATION_WEIGHT,
      detail: `Health index ${asset.healthIndex}/100`,
    });
  }

  if (asset.failures12m > 0) {
    raw.push({
      name: 'Repeat failures',
      contribution: Math.min(asset.failures12m, 6) * FAILURE_WEIGHT,
      detail: `${asset.failures12m} failure(s) in 12 months`,
    });
  }

  const overdue = pmOverdueRatio(asset);
  if (overdue > 0) {
    raw.push({
      name: 'Maintenance overdue',
      contribution: Math.min(overdue, 2) * OVERDUE_WEIGHT,
      detail: `${asset.daysSinceLastPm} days since PM, interval ${asset.pmIntervalDays}`,
    });
  }

  for (const signal of asset.signals) {
    if (signal.changePct <= 0) continue;
    raw.push({
      name: signal.name,
      contribution: Math.min(signal.changePct, 100) * signal.weight * SIGNAL_WEIGHT,
      detail: `+${signal.changePct}% against baseline`,
    });
  }

  const decline = asset.healthIndex90dAgo - asset.healthIndex;
  if (decline > 0) {
    raw.push({
      name: 'Declining trend',
      contribution: Math.min(decline, 40) * DECLINE_WEIGHT,
      detail: `Down ${decline} points over 90 days`,
    });
  }

  const total = raw.reduce((sum, d) => sum + d.contribution, 0);
  if (total === 0) return [];
  return raw
    .map((d) => ({ ...d, contribution: d.contribution / total }))
    .sort((a, b) => b.contribution - a.contribution);
}

export function riskScore(asset: Asset): number {
  const degradation =
    asset.healthIndex < HEALTH_THRESHOLDS.watch
      ? clamp(100 - asset.healthIndex) * DEGRADATION_WEIGHT
      : 0;
  const failures = Math.min(asset.failures12m, 6) * FAILURE_WEIGHT;
  const overdue = Math.min(pmOverdueRatio(asset), 2) * OVERDUE_WEIGHT;
  const signals = asset.signals.reduce(
    (sum, s) => sum + Math.max(0, Math.min(s.changePct, 100)) * s.weight * SIGNAL_WEIGHT,
    0,
  );
  const decline = Math.max(0, asset.healthIndex90dAgo - asset.healthIndex) * DECLINE_WEIGHT;
  const base = degradation + failures + overdue + signals + decline;
  // A service-critical asset is not more likely to fail, but the same
  // probability carries more consequence, so it ranks higher for action.
  const consequence = asset.serviceCritical ? 1.15 : 1;
  return Math.round(clamp(base * consequence));
}

/**
 * Confidence in the assessment: how much evidence stands behind it.
 * Thin evidence must not be presented as a confident call, and a failure
 * forecast is never certain, so this is capped below 1 no matter how much
 * evidence accumulates.
 */
export const MAX_CONFIDENCE = 0.95;

export function assessmentConfidence(asset: Asset): number {
  let score = 0.4;
  if (asset.signals.length >= 1) score += 0.15;
  if (asset.signals.length >= 3) score += 0.1;
  if (asset.failures12m > 0) score += 0.15;
  if (asset.daysSinceLastPm > 0) score += 0.1;
  if (asset.healthIndex90dAgo !== asset.healthIndex) score += 0.1;
  return Math.min(MAX_CONFIDENCE, Number(score.toFixed(2)));
}

function recommend(asset: Asset, band: RiskBand, drivers: RiskDriver[]): Recommendation {
  const top = drivers[0];
  let action: Recommendation['action'] = 'monitor';
  let withinHours = 720; // 30 days
  let summary = `Keep ${asset.name} under routine monitoring.`;

  if (band === 'high') {
    action = 'inspect';
    withinHours = asset.serviceCritical ? 72 : 168;
    summary = `Inspect ${asset.name} within ${asset.serviceCritical ? 72 : 168} hours.`;
  } else if (band === 'medium') {
    if (pmOverdueRatio(asset) > 0) {
      action = 'schedule_pm';
      withinHours = 336; // 14 days
      summary = `Bring ${asset.name} back onto its PM interval within 14 days.`;
    } else {
      action = 'inspect';
      withinHours = 336;
      summary = `Inspect ${asset.name} within 14 days.`;
    }
  }

  // A repeat-failure asset that is already critical needs the component
  // addressed, not another inspection that finds the same thing.
  if (band === 'high' && asset.failures12m >= 3 && healthBand(asset.healthIndex) === 'critical') {
    action = 'replace_component';
    summary = `Plan component replacement on ${asset.name}; inspection alone has not held.`;
  }

  return {
    assetId: asset.id,
    action,
    summary: top ? `${summary} Main driver: ${top.name.toLowerCase()}.` : summary,
    withinHours,
    drivers: drivers.slice(0, 3),
    confidence: assessmentConfidence(asset),
    // The gate: high risk never leaves the system unreviewed.
    requiresEngineerReview: band === 'high',
  };
}

export function assess(asset: Asset): Assessment {
  const drivers = riskDrivers(asset);
  const score = riskScore(asset);
  const band = riskBand(score);
  return {
    asset,
    healthBand: healthBand(asset.healthIndex),
    riskScore: score,
    riskBand: band,
    trend90d: asset.healthIndex - asset.healthIndex90dAgo,
    drivers,
    recommendation: recommend(asset, band, drivers),
  };
}

/** Worst first: what needs the engineer today. */
export function assessAll(assets: Asset[]): Assessment[] {
  return assets
    .map(assess)
    .sort((a, b) => b.riskScore - a.riskScore || a.asset.name.localeCompare(b.asset.name));
}

export interface NetworkSummary {
  total: number;
  critical: number;
  watch: number;
  healthy: number;
  highRisk: number;
  awaitingReview: number;
  /** Rounded mean health index, or null when there are no assets. */
  meanHealth: number | null;
}

export function summarise(assessments: Assessment[]): NetworkSummary {
  if (assessments.length === 0) {
    return { total: 0, critical: 0, watch: 0, healthy: 0, highRisk: 0, awaitingReview: 0, meanHealth: null };
  }
  const sum = assessments.reduce((acc, a) => acc + a.asset.healthIndex, 0);
  return {
    total: assessments.length,
    critical: assessments.filter((a) => a.healthBand === 'critical').length,
    watch: assessments.filter((a) => a.healthBand === 'watch').length,
    healthy: assessments.filter((a) => a.healthBand === 'healthy').length,
    highRisk: assessments.filter((a) => a.riskBand === 'high').length,
    awaitingReview: assessments.filter((a) => a.recommendation.requiresEngineerReview).length,
    meanHealth: Math.round(sum / assessments.length),
  };
}
