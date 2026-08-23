import type { Assessment, HealthBand } from '@/domain/types';

interface Props {
  assessments: Assessment[];
  selectedId: string | null;
  onSelect: (assetId: string) => void;
}

const BAND_LABEL: Record<HealthBand, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  critical: 'Critical',
};

/** Band marker: shape and letter carry the meaning; colour only reinforces. */
const BAND_MARK: Record<HealthBand, string> = { healthy: '●', watch: '!', critical: '×' };

export function NetworkMap({ assessments, selectedId, onSelect }: Props) {
  const sections = [...new Set(assessments.map((a) => a.asset.section))];

  return (
    <section className="block" aria-labelledby="map-heading">
      <h2 id="map-heading">Network health</h2>
      {sections.map((section) => {
        const inSection = assessments
          .filter((a) => a.asset.section === section)
          .sort((a, b) => a.asset.position - b.asset.position);
        return (
          <div className="line-row" key={section}>
            <div className="line-name">{section}</div>
            <div className="line-track" role="group" aria-label={`${section} assets`}>
              {inSection.map((a) => (
                <button
                  key={a.asset.id}
                  type="button"
                  className="node"
                  data-band={a.healthBand}
                  style={{ insetInlineStart: `${8 + a.asset.position * 84}%` }}
                  aria-pressed={selectedId === a.asset.id}
                  aria-label={`${a.asset.name}: ${BAND_LABEL[a.healthBand]}, health ${a.asset.healthIndex} of 100, risk ${a.riskBand}`}
                  onClick={() => onSelect(a.asset.id)}
                >
                  <span aria-hidden="true">{BAND_MARK[a.healthBand]}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <ul className="legend" aria-label="Legend">
        {(['healthy', 'watch', 'critical'] as HealthBand[]).map((band) => (
          <li className="key" key={band}>
            <span className={`swatch ${band}`} aria-hidden="true" />
            {BAND_LABEL[band]}
          </li>
        ))}
      </ul>
    </section>
  );
}
