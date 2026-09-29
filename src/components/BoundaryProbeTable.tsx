import { massDraftFromGrams } from '../domain/models/draft'
import type { TestConditionDraft } from '../domain/models/testCondition'
import { withTestConditionField } from '../domain/models/testCondition'
import type { BoundaryProbe, BoundaryProbePoint } from '../domain/resolution/boundaries'
import {
  applicableIntervalLabel,
  mpeLabel,
  probeChangeLabel,
  rangeLabel,
} from '../domain/resolution/describe'
import { formatMass } from '../utils/mass'
import { formatCount } from '../utils/text'

interface BoundaryProbeTableProps {
  probes: readonly BoundaryProbe[]
  draft: TestConditionDraft
  onDraftChange: (next: TestConditionDraft) => void
}

const POSITION_LABELS: Record<BoundaryProbePoint['position'], string> = {
  below: 'just below',
  at: 'exactly at',
  above: 'just above',
}

/**
 * The boundary table: every range changeover and every reachable Table 6 bracket edge of the
 * instrument, each resolved just below / exactly at / just above.
 *
 * Boundary cases are shown in full — including the probe points that fall outside the weighing
 * range, which are rendered with the status the resolver gave them instead of being dropped. The
 * `Use` button copies a probe load into the test load field, so the panel above shows the same
 * resolution for a value the user can see in the table.
 */
export function BoundaryProbeTable({ probes, draft, onDraftChange }: BoundaryProbeTableProps) {
  function applyProbeLoad(point: BoundaryProbePoint) {
    onDraftChange(withTestConditionField(draft, 'load', massDraftFromGrams(point.loadGrams, 'g')))
  }

  return (
    <div className="probe-wrap">
      <table className="model-table probe-table">
        <caption>
          Boundary behaviour — each boundary probed just below, exactly at and just above. Probe loads are placed one
          verification scale interval either side of the boundary; that spacing is a presentation choice, not an R-76
          requirement (R-76 does not prescribe test loads).
        </caption>
        <thead>
          <tr>
            <th scope="col">Boundary</th>
            <th scope="col">Position</th>
            <th scope="col" className="numeric">
              Test load L
            </th>
            <th scope="col">Partial weighing range of L</th>
            <th scope="col" className="numeric">
              Applicable e
            </th>
            <th scope="col" className="numeric">
              m = L / e
            </th>
            <th scope="col">Table 6 bracket</th>
            <th scope="col" className="numeric">
              mpe (initial verification)
            </th>
            <th scope="col" aria-label="Use this load" />
          </tr>
        </thead>

        {probes.map((probe) => (
          <tbody key={`${probe.kind}-${probe.boundaryGrams}`} className="probe-group">
            {probe.points.map((point, position) => {
              const { ranges, mpe } = point.resolution
              const resolved = ranges.range_L.status === 'resolved'

              return (
                <tr
                  key={point.position}
                  className={
                    [point.position === 'at' ? 'probe-at' : '', resolved ? '' : 'probe-unresolved']
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                >
                  {position === 0 ? (
                    <th scope="rowgroup" rowSpan={probe.points.length} className="probe-boundary">
                      <span className="probe-label">{probe.label}</span>
                      <span className="probe-change">{probeChangeLabel(probe)}</span>
                      <span className="probe-detail">{probe.detail}</span>
                    </th>
                  ) : null}
                  <td className="probe-position">{POSITION_LABELS[point.position]}</td>
                  <td className="numeric">{formatMass(point.loadGrams)}</td>
                  <td>{rangeLabel(ranges.range_L)}</td>
                  <td className="numeric">{resolved ? applicableIntervalLabel(ranges.range_L) : 'no applicable e'}</td>
                  <td className="numeric">{mpe.m === null ? '—' : formatCount(mpe.m)}</td>
                  <td>{mpe.bracket === null ? '—' : mpe.bracket.mCellText}</td>
                  <td className="numeric">{mpeLabel(mpe, ranges.range_L)}</td>
                  <td>
                    <button
                      type="button"
                      className="button button-quiet probe-apply"
                      onClick={() => applyProbeLoad(point)}
                      aria-label={`Use ${formatMass(point.loadGrams)} as the test load`}
                    >
                      Use
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        ))}
      </table>
    </div>
  )
}
