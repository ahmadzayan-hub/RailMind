import { useState } from 'react';

import type { Assessment, HealthBand } from '@/domain/types';

import { ACTION_LABEL, hoursLabel } from './labels';

interface Props {
  assessments: Assessment[];
  selectedId: string | null;
  onSelect: (assetId: string) => void;
}

type Filter = 'all' | HealthBand | 'review';

const FILTERS: { id: Filter; label: string; test: (a: Assessment) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'critical', label: 'Critical', test: (a) => a.healthBand === 'critical' },
  { id: 'watch', label: 'Watch', test: (a) => a.healthBand === 'watch' },
  { id: 'healthy', label: 'Healthy', test: (a) => a.healthBand === 'healthy' },
  { id: 'review', label: 'Needs engineer review', test: (a) => a.recommendation.requiresEngineerReview },
];

const BAND_LABEL: Record<HealthBand, string> = { healthy: 'Healthy', watch: 'Watch', critical: 'Critical' };

/**
 * This week's work list. Order comes from assessAll (highest failure risk first);
 * the list only filters, it never re-scores anything.
 */
export function PriorityList({ assessments, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const active = FILTERS.find((f) => f.id === filter);
  const rows = active ? assessments.filter(active.test) : assessments;

  return (
    <section className="block" aria-labelledby="priority-heading">
      <h2 id="priority-heading">Priority list</h2>
      <div className="filters" role="group" aria-label="Filter assets">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="chip"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label} <span className="count">{assessments.filter(f.test).length}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="notice">No assets match this filter.</p>
      ) : (
        <div className="table-wrap">
          <table className="priority">
            <caption className="sr-only">
              Assets ordered by failure risk, highest first. Showing {rows.length} of {assessments.length}.
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Asset</th>
                <th scope="col">Health</th>
                <th scope="col">Failure risk</th>
                <th scope="col">Recommended action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.asset.id} aria-current={selectedId === a.asset.id ? 'true' : undefined}>
                  <td className="num">{assessments.indexOf(a) + 1}</td>
                  <td>
                    <button type="button" className="row-link" onClick={() => onSelect(a.asset.id)}>
                      {a.asset.name}
                    </button>
                    <div className="meta">{a.asset.section}</div>
                  </td>
                  <td className="num">
                    {a.asset.healthIndex}/100 <span className={`band ${a.healthBand}`}>{BAND_LABEL[a.healthBand]}</span>
                  </td>
                  <td>
                    <span className={`badge ${a.riskBand}`}>
                      {a.riskBand} · {a.riskScore}
                    </span>
                  </td>
                  <td>
                    {ACTION_LABEL[a.recommendation.action]}
                    <div className="meta">
                      within {hoursLabel(a.recommendation.withinHours)}
                      {a.recommendation.requiresEngineerReview ? ' · needs named engineer review' : ''}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
