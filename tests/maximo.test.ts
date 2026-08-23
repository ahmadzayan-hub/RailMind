import { describe, expect, it } from 'vitest';
import { assess } from '@/domain/risk';
import { proposeWorkOrder, type EngineerReview } from '@/domain/maximo';
import type { Asset } from '@/domain/types';

function asset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'PTS-014',
    name: 'Points 014',
    assetClass: 'points',
    section: 'Line A',
    position: 0.3,
    healthIndex: 90,
    healthIndex90dAgo: 90,
    failures12m: 0,
    daysSinceLastPm: 10,
    pmIntervalDays: 90,
    openWorkOrders: 0,
    serviceCritical: false,
    signals: [],
    ...over,
  };
}

const highRisk = asset({
  healthIndex: 32,
  healthIndex90dAgo: 70,
  failures12m: 5,
  daysSinceLastPm: 300,
  pmIntervalDays: 90,
  serviceCritical: true,
});

const review: EngineerReview = {
  reviewerName: 'A. Zaian',
  decision: 'accepted',
  at: '2026-08-23T07:00:00.000Z',
};

describe('proposeWorkOrder', () => {
  it('refuses to produce a high-risk proposal without engineer review', () => {
    const out = proposeWorkOrder(assess(highRisk));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('engineer_review_required');
  });

  it('refuses an anonymous review', () => {
    const out = proposeWorkOrder(assess(highRisk), { ...review, reviewerName: '   ' });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('reviewer_name_missing');
  });

  it('produces nothing when the engineer rejects it', () => {
    const out = proposeWorkOrder(assess(highRisk), { ...review, decision: 'rejected' });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('review_rejected');
  });

  it('produces a priority-1 proposal once a named engineer accepts', () => {
    const out = proposeWorkOrder(assess(highRisk), review);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.proposal.priority).toBe(1);
      expect(out.proposal.assetId).toBe('PTS-014');
      expect(out.proposal.drivers.length).toBeGreaterThan(0);
      // RailMind proposes; it never submits.
      expect(out.proposal.submittedToMaximo).toBe(false);
    }
  });

  it('does not gate low and medium risk behind review', () => {
    const medium = proposeWorkOrder(assess(asset({ healthIndex: 70, daysSinceLastPm: 200 })));
    expect(medium.ok).toBe(true);
    if (medium.ok) expect(medium.proposal.priority).toBe(2);

    const low = proposeWorkOrder(assess(asset()));
    expect(low.ok).toBe(true);
    if (low.ok) expect(low.proposal.priority).toBe(3);
  });

  it('carries the evidence the engineer is asked to accept', () => {
    const out = proposeWorkOrder(assess(highRisk), review);
    if (!out.ok) throw new Error('expected a proposal');
    for (const d of out.proposal.drivers) {
      expect(d.detail.length).toBeGreaterThan(0);
      expect(d.contribution).toBeGreaterThan(0);
    }
  });
});
