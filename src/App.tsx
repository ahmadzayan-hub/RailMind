import { useMemo, useState } from 'react';

import { AssetDetail } from '@/components/AssetDetail';
import { NetworkMap } from '@/components/NetworkMap';
import { PriorityList } from '@/components/PriorityList';
import { SAMPLE_NETWORK } from '@/data/sample-network';
import { assessAll, summarise } from '@/domain/risk';

export function App() {
  const assessments = useMemo(() => assessAll(SAMPLE_NETWORK), []);
  const summary = useMemo(() => summarise(assessments), [assessments]);
  // Open on the asset that most needs the engineer, not on an empty screen.
  const [selectedId, setSelectedId] = useState<string | null>(
    assessments[0]?.asset.id ?? null,
  );
  const selected = assessments.find((a) => a.asset.id === selectedId) ?? null;

  // Choosing from the list moves the reader to the assessment it opens.
  const selectFromList = (assetId: string) => {
    setSelectedId(assetId);
    const detail = document.getElementById('asset-detail');
    detail?.focus({ preventScroll: true });
    detail?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>RailMind</h1>
          <p className="sub">
            Which assets will hurt us next, why, and what to do this week.
          </p>
        </div>
        <p className="sub">
          {summary.total} assets · mean health {summary.meanHealth ?? '—'}/100
        </p>
      </header>

      <p className="notice">
        Sample network. These assets are synthetic and exist so the full journey can be
        walked before any Maximo integration. RailMind recommends; an engineer decides.
      </p>

      <div className="summary">
        <div className={`stat ${summary.critical > 0 ? 'alert' : ''}`}>
          <div className="n">{summary.critical}</div>
          <div className="l">Critical health</div>
        </div>
        <div className={`stat ${summary.watch > 0 ? 'watch' : ''}`}>
          <div className="n">{summary.watch}</div>
          <div className="l">Watch</div>
        </div>
        <div className="stat">
          <div className="n">{summary.healthy}</div>
          <div className="l">Healthy</div>
        </div>
        <div className={`stat ${summary.highRisk > 0 ? 'alert' : ''}`}>
          <div className="n">{summary.highRisk}</div>
          <div className="l">High failure risk</div>
        </div>
        <div className={`stat ${summary.awaitingReview > 0 ? 'watch' : ''}`}>
          <div className="n">{summary.awaitingReview}</div>
          <div className="l">Awaiting engineer review</div>
        </div>
      </div>

      <NetworkMap
        assessments={assessments}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <PriorityList
        assessments={assessments}
        selectedId={selectedId}
        onSelect={selectFromList}
      />

      <section className="block" aria-labelledby="asset-heading" id="asset-detail" tabIndex={-1}>
        <h2 id="asset-heading">Asset</h2>
        {selected ? (
          <AssetDetail assessment={selected} />
        ) : (
          <p className="notice">Select an asset on the map to see its assessment.</p>
        )}
      </section>

      <footer className="foot">
        Maximo remains the system of record for assets and work orders. RailMind performs
        no safety-critical rail control action and never raises a work order by itself.
      </footer>
    </div>
  );
}
