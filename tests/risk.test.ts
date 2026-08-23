import { describe, expect, it } from 'vitest';
import {
  MAX_CONFIDENCE,
  assess,
  assessAll,
  assessmentConfidence,
  healthBand,
  pmOverdueRatio,
  riskBand,
  riskDrivers,
  riskScore,
  summarise,
} from '@/domain/risk';
import type { Asset } from '@/domain/types';

function asset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'TRK-001',
    name: 'Track section 001',
    assetClass: 'track',
    section: 'Line A',
    position: 0.5,
    healthIndex: 90,
    healthIndex90dAgo: 90,
    failures12m: 0,
    daysSinceLastPm: 30,
    pmIntervalDays: 90,
    openWorkOrders: 0,
    serviceCritical: false,
    signals: [],
    ...over,
  };
}

describe('bands', () => {
  it('maps health to bands at the documented thresholds', () => {
    expect(healthBand(90)).toBe('healthy');
    expect(healthBand(75)).toBe('healthy');
    expect(healthBand(74)).toBe('watch');
    expect(healthBand(55)).toBe('watch');
    expect(healthBand(54)).toBe('critical');
  });

  it('maps risk to bands at the documented thresholds', () => {
    expect(riskBand(39)).toBe('low');
    expect(riskBand(40)).toBe('medium');
    expect(riskBand(69)).toBe('medium');
    expect(riskBand(70)).toBe('high');
  });
});

describe('pmOverdueRatio', () => {
  it('is zero while inside the interval and grows past it', () => {
    expect(pmOverdueRatio(asset({ daysSinceLastPm: 30, pmIntervalDays: 90 }))).toBe(0);
    expect(pmOverdueRatio(asset({ daysSinceLastPm: 180, pmIntervalDays: 90 }))).toBe(1);
  });

  it('never divides by a zero interval', () => {
    expect(pmOverdueRatio(asset({ pmIntervalDays: 0, daysSinceLastPm: 500 }))).toBe(0);
  });
});

describe('riskDrivers', () => {
  it('returns nothing for a healthy, on-schedule asset', () => {
    expect(riskDrivers(asset())).toEqual([]);
  });

  it('ranks drivers and normalises contributions to 1', () => {
    const drivers = riskDrivers(
      asset({
        healthIndex: 50,
        healthIndex90dAgo: 78,
        failures12m: 4,
        daysSinceLastPm: 200,
        pmIntervalDays: 90,
        signals: [{ name: 'Vibration', changePct: 40, weight: 1 }],
      }),
    );
    expect(drivers.length).toBeGreaterThan(3);
    const total = drivers.reduce((s, d) => s + d.contribution, 0);
    expect(total).toBeCloseTo(1, 5);
    for (let i = 1; i < drivers.length; i++) {
      expect(drivers[i - 1]!.contribution).toBeGreaterThanOrEqual(drivers[i]!.contribution);
    }
  });

  it('ignores signals that improved', () => {
    const drivers = riskDrivers(asset({ signals: [{ name: 'Temperature', changePct: -10, weight: 1 }] }));
    expect(drivers).toEqual([]);
  });
});

describe('riskScore', () => {
  it('is low for a healthy asset and high for a degraded one', () => {
    expect(riskScore(asset())).toBeLessThan(40);
    expect(
      riskScore(asset({ healthIndex: 40, failures12m: 5, daysSinceLastPm: 300, pmIntervalDays: 90 })),
    ).toBeGreaterThanOrEqual(70);
  });

  it('ranks a service-critical asset above an identical non-critical one', () => {
    const base = { healthIndex: 60, failures12m: 2 };
    expect(riskScore(asset({ ...base, serviceCritical: true }))).toBeGreaterThan(
      riskScore(asset({ ...base, serviceCritical: false })),
    );
  });

  it('stays within 0..100', () => {
    const extreme = asset({
      healthIndex: 0,
      healthIndex90dAgo: 100,
      failures12m: 99,
      daysSinceLastPm: 9999,
      pmIntervalDays: 1,
      serviceCritical: true,
      signals: [{ name: 'X', changePct: 999, weight: 1 }],
    });
    expect(riskScore(extreme)).toBeLessThanOrEqual(100);
    expect(riskScore(asset({ healthIndex: 100 }))).toBeGreaterThanOrEqual(0);
  });
});

describe('assessmentConfidence', () => {
  it('reports low confidence when there is little evidence', () => {
    expect(assessmentConfidence(asset({ daysSinceLastPm: 0, signals: [] }))).toBeLessThan(0.6);
  });

  it('rises with evidence but never exceeds 1', () => {
    const rich = asset({
      healthIndex: 60,
      healthIndex90dAgo: 80,
      failures12m: 2,
      signals: [
        { name: 'a', changePct: 5, weight: 1 },
        { name: 'b', changePct: 5, weight: 1 },
        { name: 'c', changePct: 5, weight: 1 },
      ],
    });
    expect(assessmentConfidence(rich)).toBeLessThanOrEqual(MAX_CONFIDENCE);
    expect(assessmentConfidence(rich)).toBeGreaterThan(0.8);
  });

  it('never claims certainty about a failure forecast', () => {
    const everything = asset({
      healthIndex: 10,
      healthIndex90dAgo: 95,
      failures12m: 9,
      daysSinceLastPm: 900,
      pmIntervalDays: 30,
      signals: [
        { name: 'a', changePct: 90, weight: 1 },
        { name: 'b', changePct: 90, weight: 1 },
        { name: 'c', changePct: 90, weight: 1 },
        { name: 'd', changePct: 90, weight: 1 },
      ],
    });
    expect(assessmentConfidence(everything)).toBeLessThan(1);
    expect(assessmentConfidence(everything)).toBe(MAX_CONFIDENCE);
  });
});

describe('assess', () => {
  it('recommends monitoring for a healthy asset and demands no review', () => {
    const a = assess(asset());
    expect(a.riskBand).toBe('low');
    expect(a.recommendation.action).toBe('monitor');
    expect(a.recommendation.requiresEngineerReview).toBe(false);
  });

  it('flags every high-risk recommendation for engineer review', () => {
    const a = assess(
      asset({ healthIndex: 35, failures12m: 5, daysSinceLastPm: 300, pmIntervalDays: 90 }),
    );
    expect(a.riskBand).toBe('high');
    expect(a.recommendation.requiresEngineerReview).toBe(true);
  });

  it('shortens the response window for a service-critical asset', () => {
    const critical = assess(asset({ healthIndex: 30, failures12m: 4, serviceCritical: true }));
    const ordinary = assess(asset({ healthIndex: 30, failures12m: 4, serviceCritical: false }));
    expect(critical.recommendation.withinHours).toBeLessThan(ordinary.recommendation.withinHours);
  });

  it('escalates to replacement when inspection has not held', () => {
    const a = assess(
      asset({ healthIndex: 40, failures12m: 4, daysSinceLastPm: 200, pmIntervalDays: 90 }),
    );
    expect(a.recommendation.action).toBe('replace_component');
  });

  it('brings an overdue medium-risk asset back onto its PM interval', () => {
    const a = assess(asset({ healthIndex: 70, daysSinceLastPm: 200, pmIntervalDays: 90 }));
    expect(a.riskBand).toBe('medium');
    expect(a.recommendation.action).toBe('schedule_pm');
  });

  it('always carries drivers behind a non-trivial recommendation', () => {
    const a = assess(asset({ healthIndex: 45, failures12m: 3 }));
    expect(a.drivers.length).toBeGreaterThan(0);
    expect(a.recommendation.drivers.length).toBeGreaterThan(0);
  });

  it('reports the 90-day trend signed toward improvement', () => {
    expect(assess(asset({ healthIndex: 70, healthIndex90dAgo: 80 })).trend90d).toBe(-10);
    expect(assess(asset({ healthIndex: 85, healthIndex90dAgo: 80 })).trend90d).toBe(5);
  });
});

describe('assessAll and summarise', () => {
  it('orders assessments worst first', () => {
    const list = assessAll([
      asset({ id: 'a', name: 'A', healthIndex: 95 }),
      asset({ id: 'b', name: 'B', healthIndex: 30, failures12m: 5 }),
      asset({ id: 'c', name: 'C', healthIndex: 70 }),
    ]);
    expect(list.map((a) => a.asset.id)).toEqual(['b', 'c', 'a']);
  });

  it('summarises bands, high risk and the review queue', () => {
    const s = summarise(
      assessAll([
        asset({ id: 'a', healthIndex: 95 }),
        asset({ id: 'b', healthIndex: 60 }),
        asset({ id: 'c', healthIndex: 30, failures12m: 5, daysSinceLastPm: 300, pmIntervalDays: 90 }),
      ]),
    );
    expect(s.total).toBe(3);
    expect(s.healthy).toBe(1);
    expect(s.watch).toBe(1);
    expect(s.critical).toBe(1);
    expect(s.highRisk).toBe(1);
    expect(s.awaitingReview).toBe(1);
    expect(s.meanHealth).toBe(62);
  });

  it('says nothing rather than zero when there are no assets', () => {
    expect(summarise([]).meanHealth).toBeNull();
  });
});
