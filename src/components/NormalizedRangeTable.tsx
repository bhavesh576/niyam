import type { NormalizedInstrument } from '../domain/models/normalizedInstrument'
import { R76_TABLE_4, describeTable3Band } from '../domain/constants/r76Tables'
import { formatMass } from '../utils/mass'
import { formatCount, subscript } from '../utils/text'
import { SectionHead } from './SectionHead'

interface NormalizedRangeTableProps {
  instrument: NormalizedInstrument
}

/**
 * The normalized range model produced by `normalizeConfiguration` after a successful validation.
 *
 * It makes the structure of a MULTI-INTERVAL instrument explicit: one continuous weighing range
 * Min → Max, cut into partial weighing ranges at Max₁, Max₂, … (§3.3.1), each with its own e and
 * its own n = Maxᵢ / eᵢ.
 */
export function NormalizedRangeTable({ instrument }: NormalizedRangeTableProps) {
  const table4Limit = R76_TABLE_4[instrument.accuracyClass]

  return (
    <div className="section">
      <SectionHead
        level={3}
        category="resolved"
        title="Normalized range model"
        note="Derived from the validated configuration — nothing here is entered"
      />

      <div className="table-scroll">
          <table className="model-table range-model-table">
          <caption>
            One weighing range Min → Max, divided into {formatCount(instrument.rangeCount)} partial weighing ranges
            (§3.3.1), each with its own verification scale interval eᵢ and its own nᵢ = Maxᵢ / eᵢ.
          </caption>
          <thead>
            <tr>
              <th scope="col">Partial range</th>
              <th scope="col">Weighing span (Minᵢ → Maxᵢ)</th>
              <th scope="col" className="numeric">
                eᵢ
              </th>
              <th scope="col" className="numeric">
                nᵢ = Maxᵢ / eᵢ
              </th>
              <th scope="col" className="numeric">
                Maxᵢ / eᵢ₊₁ (Table 4, ≥ {formatCount(table4Limit)})
              </th>
              <th scope="col">Table 3 band of eᵢ</th>
            </tr>
          </thead>
          <tbody>
            {instrument.ranges.map((range) => (
              <tr key={range.id}>
                <th scope="row">
                  Range {range.rangeNumber}
                  {range.isLast ? <span className="tag"> last</span> : null}
                </th>
                <td className="numeric">
                  {formatMass(range.lowerBoundGrams)} → {formatMass(range.upperBoundGrams)}
                </td>
                <td className="numeric">{formatMass(range.verificationIntervalGrams)}</td>
                <td className="numeric">
                  {formatCount(range.verificationIntervals)}
                  {range.verificationIntervalsAreExact ? '' : ' (not integral)'}
                </td>
                <td className="numeric">
                  {range.table4Ratio === null ? 'exempt (§3.3.3)' : formatCount(range.table4Ratio)}
                </td>
                <td>{range.table3Row ? describeTable3Band(range.table3Row) : '—'}</td>
              </tr>
            ))}
          </tbody>
          </table>
      </div>

      <p className="model-note">
        Min = Min₁ = {formatMass(instrument.minCapacityGrams)} · Max = Max{subscript(instrument.rangeCount)} ={' '}
        {formatMass(instrument.maxCapacityGrams)} · d = e₁ = {formatMass(instrument.displayDivisionGrams)} · accuracy
        class {instrument.accuracyClass} · {instrument.instrumentType} instrument.
      </p>
    </div>
  )
}
