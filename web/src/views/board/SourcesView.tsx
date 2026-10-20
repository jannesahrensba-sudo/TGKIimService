import type { Marker, SourceKind } from '@core/types';
import { MARKERS } from '@core/types';
import { useStore } from '../../data/store';
import { Badge, MarkerBadge, Panel } from '../../components/ui';

const KIND: Record<SourceKind, string> = {
  SAP_HELP: 'SAP Help',
  SAP_LEARNING: 'SAP Learning',
  SAP_COMMUNITY: 'SAP Community',
  SAP_PRODUKT: 'SAP Produkt/Discovery Center',
  SAP_NEWS: 'SAP News',
  TG_FOLIEN: 'TG-Folien (SAP)',
  TG_UNTERLAGE: 'TG-Unterlage',
  PRESSE: 'Presse/Sekundär',
};

/** Woher das Wissen kommt: Quellen, Verlässlichkeit, Markerverteilung im Prozess, offene Prüfaufträge. */
export function SourcesView() {
  const { model, go } = useStore();
  const nodes = model.processes.flatMap((p) => p.nodes);
  const markers = (Object.keys(MARKERS) as Marker[]).map((m) => ({ m, n: nodes.filter((x) => x.marker === m).length + model.sapAgents.filter((a) => a.marker === m).length }));
  const verify = [...nodes.filter((n) => n.marker === 'ZU_VERIFIZIEREN' || n.note).map((n) => ({ id: n.id, text: n.note ?? n.description, kind: 'Schritt' as const })), ...model.sapAgents.filter((a) => a.marker === 'ZU_VERIFIZIEREN' || a.note).map((a) => ({ id: a.id, text: a.note ?? a.description, kind: 'Agent' as const }))];
  return (
    <div className="page">
      <div className="note info">
        <span>
          Der SAP-Standard wurde für diese Plattform im Oktober 2026 recherchiert und validiert (SAP Learning, SAP Help, SAP-Community-Beiträge von SAP, Produktseiten, Discovery Center, SAP News). Release-spezifische Details – vor allem Fiori-App-IDs – sind als <b>zu verifizieren</b> markiert. Agenten aus den SAP-Folien der TG sind <b>Lab Preview / WIP</b> und keine Produktzusage. Ausführlich: <code>docs/recherche/standard-validierung.md</code> im Repository.
        </span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {markers.map(({ m, n }) => (
          <span key={m} className="row" style={{ gap: 4 }}>
            <MarkerBadge marker={m} /> <span className="num">{n}</span>
          </span>
        ))}
      </div>
      <div className="split">
        <Panel title={`Quellen (${model.sources.length})`} tight>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Quelle</th>
                  <th>Art</th>
                  <th>Verlässlichkeit</th>
                </tr>
              </thead>
              <tbody>
                {model.sources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}
                      {s.note && <div className="faint" style={{ fontSize: 'var(--fs-xs)' }}>{s.note}</div>}
                    </td>
                    <td>
                      <Badge square>{KIND[s.kind]}</Badge>
                      {s.date && <div className="faint mono" style={{ fontSize: 'var(--fs-xs)' }}>{s.date}</div>}
                    </td>
                    <td>
                      <Badge tone={s.reliability === 'hoch' ? 'positive' : s.reliability === 'mittel' ? 'warning' : 'critical'}>{s.reliability}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title={`Prüfaufträge (${verify.length})`} eyebrow="Zu verifizieren bzw. Hinweise">
          <ul className="list-plain">
            {verify.map((v) => (
              <li key={v.id} className="stack" style={{ gap: 2 }}>
                <button type="button" className="link-btn" onClick={() => (v.kind === 'Schritt' ? go('board', 'process', { node: v.id }) : go('board', 'agents', { agent: v.id }))}>
                  <span className="mono">{v.id}</span> ({v.kind})
                </button>
                <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                  {v.text}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
