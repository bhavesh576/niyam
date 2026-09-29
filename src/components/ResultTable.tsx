import type { ReportTestPoint, WeighingReport } from '../domain/report/types'

interface ResultColumn {
  readonly symbol: string
  readonly cell: (point: ReportTestPoint) => string
}

interface ResultColumnGroup {
  readonly label: string
  readonly columns: readonly ResultColumn[]
}

/**
 * The fifteen columns of the result table, grouped by the part of the evaluation they belong to.
 *
 * Every cell is a value the report model took from the result of the Phase 3 evaluation — the table
 * rearranges those values, it does not compute any of them.
 */
const columnGroups: readonly ResultColumnGroup[] = [
  {
    label: 'Observation',
    columns: [
      { symbol: 'L', cell: (point) => point.observation.load.tableText },
      { symbol: 'I', cell: (point) => point.observation.indication.tableText },
      { symbol: 'ΔL', cell: (point) => point.observation.additionalLoad.tableText },
      { symbol: 'I_next', cell: (point) => point.observation.nextIndication.tableText },
    ],
  },
  {
    label: 'Resolved context',
    columns: [
      { symbol: 'range_L', cell: (point) => point.context.loadRange.tableText },
      { symbol: 'range_I', cell: (point) => point.context.indicationRange.tableText },
      { symbol: 'range_I_next', cell: (point) => point.context.nextIndicationRange.tableText },
      { symbol: 'e_L', cell: (point) => point.context.loadInterval.tableText },
      { symbol: 'e*', cell: (point) => point.context.changeoverInterval.tableText },
    ],
  },
  {
    label: 'Calculation',
    columns: [
      { symbol: 'P', cell: (point) => point.calculation.p.tableText },
      { symbol: 'E', cell: (point) => point.calculation.e.tableText },
      { symbol: 'E₀', cell: (point) => point.observation.zeroError.tableText },
      { symbol: 'Ec', cell: (point) => point.calculation.ec.tableText },
    ],
  },
  {
    label: 'Compliance',
    columns: [
      { symbol: 'MPE', cell: (point) => point.compliance.mpe.tableText },
      { symbol: 'Result', cell: (point) => point.compliance.verdict },
    ],
  },
]

interface ResultTableProps {
  report: WeighingReport
}

/**
 * The canonical result table: one row per test point, all fifteen columns visible at once, grouped
 * under the four parts of the evaluation they belong to.
 *
 * This is the one table both the result screen and the printed document show, and every cell is a
 * value the report model took from the result of the evaluation — the table rearranges those values,
 * it does not compute any of them. The chains, the substituted formulae and the range-aware notes
 * that explain a row are presented where they belong: on the test screen, and in sections C and D of
 * the document — not twice on the same screen.
 */
export function ResultTable({ report }: ResultTableProps) {
  const columns = columnGroups.flatMap((group) => group.columns)

  return (
    <div className="section">
      <div className="section-head">
        <h3 className="section-title">Result table</h3>
        <span className="actions-note">One row per test point · masses in g · signs kept on E₀, E and Ec</span>
      </div>

      <div className="table-scroll">
        <table className="model-table result-table">
          <caption>
            L, I, ΔL and I_next are the observation; range_L, range_I and range_I_next are the partial weighing range
            numbers the resolver assigned; e_L and e* are the verification scale intervals of those ranges; P, E, E₀ and
            Ec are the values of A.4.4.3; MPE is the absolute limit of Table 6 and Result is |Ec| against it.
          </caption>
          <thead>
            <tr>
              {columnGroups.map((group) => (
                <th key={group.label} className="result-group" scope="colgroup" colSpan={group.columns.length}>
                  {group.label}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((column) => (
                <th key={column.symbol} className="numeric" scope="col">
                  {column.symbol}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.testPoints.map((point) => (
              <tr key={point.label}>
                {columns.map((column) => (
                  <td
                    key={column.symbol}
                    className={
                      column.symbol === 'Result'
                        ? `numeric result-cell ${point.compliance.verdict === 'PASS' ? 'is-pass' : 'is-fail'}`
                        : 'numeric'
                    }
                  >
                    {column.cell(point)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
