// Proposing work to Maximo.
//
// RailMind never raises, closes or edits a Maximo work order. It produces a
// proposal that a named engineer reviews and then submits in Maximo. The
// gate below is the product rule from docs/PRODUCT_AUTHORITY.md expressed
// in code, so no interface can route around it.

import type { Assessment } from './types';

export interface WorkOrderProposal {
  assetId: string;
  assetName: string;
  action: Assessment['recommendation']['action'];
  priority: 1 | 2 | 3;
  withinHours: number;
  description: string;
  /** The evidence the engineer is being asked to accept. */
  drivers: { name: string; detail: string; contribution: number }[];
  confidence: number;
  /** Always false here: RailMind proposes, Maximo is where it becomes real. */
  submittedToMaximo: false;
}

export interface EngineerReview {
  reviewerName: string;
  decision: 'accepted' | 'rejected';
  note?: string;
  /** ISO timestamp, supplied by the caller so this stays pure. */
  at: string;
}

export type ProposalOutcome =
  | { ok: true; proposal: WorkOrderProposal }
  | { ok: false; reason: 'engineer_review_required' | 'reviewer_name_missing' | 'review_rejected' };

/**
 * Build a work-order proposal from an assessment.
 * A high-risk recommendation requires a named engineer's acceptance first;
 * without it, nothing is produced and the caller is told why.
 */
export function proposeWorkOrder(
  assessment: Assessment,
  review?: EngineerReview,
): ProposalOutcome {
  const { recommendation, asset } = assessment;

  if (recommendation.requiresEngineerReview) {
    if (!review) return { ok: false, reason: 'engineer_review_required' };
    if (!review.reviewerName.trim()) return { ok: false, reason: 'reviewer_name_missing' };
    if (review.decision === 'rejected') return { ok: false, reason: 'review_rejected' };
  }

  const priority: WorkOrderProposal['priority'] =
    assessment.riskBand === 'high' ? 1 : assessment.riskBand === 'medium' ? 2 : 3;

  return {
    ok: true,
    proposal: {
      assetId: asset.id,
      assetName: asset.name,
      action: recommendation.action,
      priority,
      withinHours: recommendation.withinHours,
      description: recommendation.summary,
      drivers: recommendation.drivers.map((d) => ({
        name: d.name,
        detail: d.detail,
        contribution: Number(d.contribution.toFixed(3)),
      })),
      confidence: recommendation.confidence,
      submittedToMaximo: false,
    },
  };
}
