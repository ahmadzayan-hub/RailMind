import { useEffect, useState } from 'react';

import { proposeWorkOrder, type WorkOrderProposal } from '@/domain/maximo';
import type { Assessment } from '@/domain/types';

interface Props {
  assessment: Assessment;
}

const ACTION_LABEL: Record<Assessment['recommendation']['action'], string> = {
  inspect: 'Inspect',
  schedule_pm: 'Schedule preventive maintenance',
  replace_component: 'Replace component',
  monitor: 'Monitor',
};

function hoursLabel(hours: number): string {
  if (hours < 48) return `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}

export function AssetDetail({ assessment }: Props) {
  const { asset, recommendation } = assessment;
  const [reviewer, setReviewer] = useState('');
  const [proposal, setProposal] = useState<WorkOrderProposal | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  // A review belongs to the asset it was given for; changing asset clears it.
  useEffect(() => {
    setReviewer('');
    setProposal(null);
    setBlocked(null);
  }, [asset.id]);

  function propose(decision: 'accepted' | 'rejected' | null) {
    const outcome = proposeWorkOrder(
      assessment,
      decision
        ? { reviewerName: reviewer, decision, at: new Date().toISOString() }
        : undefined,
    );
    if (outcome.ok) {
      setProposal(outcome.proposal);
      setBlocked(null);
      return;
    }
    setProposal(null);
    setBlocked(
      outcome.reason === 'engineer_review_required'
        ? 'This asset is high risk. A named engineer must review the recommendation before a work order can be proposed.'
        : outcome.reason === 'reviewer_name_missing'
          ? 'Enter the reviewing engineer’s name. An anonymous review is not a review.'
          : 'Recorded as rejected. No work order proposed.',
    );
  }

  const needsReview = recommendation.requiresEngineerReview;

  return (
    <div className="detail">
      <div className="card">
        <h3>{asset.name}</h3>
        <p className="meta">
          {asset.id} · {asset.section} · {asset.assetClass.replace('_', ' ')}
          {asset.serviceCritical ? ' · service critical' : ''}
        </p>
        <dl className="kv">
          <dt>Health index</dt>
          <dd>{asset.healthIndex} / 100</dd>
          <dt>90-day trend</dt>
          <dd>
            {assessment.trend90d > 0 ? '+' : ''}
            {assessment.trend90d} points
          </dd>
          <dt>Failure risk</dt>
          <dd>
            {assessment.riskScore} / 100{' '}
            <span className={`badge ${assessment.riskBand}`}>{assessment.riskBand}</span>
          </dd>
          <dt>Failures (12m)</dt>
          <dd>{asset.failures12m}</dd>
          <dt>Since last PM</dt>
          <dd>
            {asset.daysSinceLastPm} days (interval {asset.pmIntervalDays})
          </dd>
          <dt>Open work orders</dt>
          <dd>{asset.openWorkOrders}</dd>
        </dl>

        <h4 style={{ marginTop: 16, fontSize: 13 }}>Why</h4>
        {assessment.drivers.length === 0 ? (
          <p className="meta">Nothing is driving risk on this asset.</p>
        ) : (
          <ul className="drivers">
            {assessment.drivers.map((d) => (
              <li key={d.name}>
                <span className="name">
                  <span>{d.name}</span>
                  <span>{Math.round(d.contribution * 100)}%</span>
                </span>
                <span className="bar" aria-hidden="true">
                  <span style={{ width: `${Math.round(d.contribution * 100)}%` }} />
                </span>
                <span className="detail">{d.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Recommended action</h3>
        <p className="meta">
          {ACTION_LABEL[recommendation.action]} · within {hoursLabel(recommendation.withinHours)} ·
          confidence {Math.round(recommendation.confidence * 100)}%
        </p>
        <p style={{ marginTop: 10 }}>{recommendation.summary}</p>

        {needsReview ? (
          <div className="gate">
            <h4>Engineer review required</h4>
            <p>
              RailMind recommends; an engineer decides. High-risk assets cannot leave this
              system without a named review, and RailMind never raises a Maximo work order
              itself.
            </p>
            <label htmlFor="reviewer">Reviewing engineer</label>
            <input
              id="reviewer"
              type="text"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="Full name"
              autoComplete="off"
            />
            <div className="row">
              <button type="button" className="action" onClick={() => propose('accepted')}>
                Accept and propose work order
              </button>
              <button type="button" className="action ghost" onClick={() => propose('rejected')}>
                Reject
              </button>
            </div>
          </div>
        ) : (
          <div className="row">
            <button type="button" className="action" onClick={() => propose(null)}>
              Propose Maximo work order
            </button>
          </div>
        )}

        {blocked && (
          <p className="blocked" role="status">
            {blocked}
          </p>
        )}

        {proposal && (
          <div className="proposal" role="status">
            <h4>Work order proposal ready for Maximo</h4>
            <dl className="kv">
              <dt>Asset</dt>
              <dd>
                {proposal.assetName} ({proposal.assetId})
              </dd>
              <dt>Action</dt>
              <dd>{ACTION_LABEL[proposal.action]}</dd>
              <dt>Priority</dt>
              <dd>{proposal.priority}</dd>
              <dt>Start within</dt>
              <dd>{hoursLabel(proposal.withinHours)}</dd>
            </dl>
            <p className="meta" style={{ marginTop: 8 }}>
              Not submitted. Raise this in Maximo, which remains the system of record for
              work orders.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
