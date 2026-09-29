import type { CalculationLine } from '../domain/evaluation/types'
import { ClauseTag } from './ClauseTag'

interface CalculationTableProps {
  /** The four substitution lines, exactly as `calculationLines` produced them from the result. */
  lines: readonly CalculationLine[]
}

/**
 * The calculation of A.4.4.3 as a table: formula, the same formula with the entered values
 * substituted, the result, and the clause each line rests on.
 *
 * One component, used by the test screen and by the printed document, so the arithmetic is presented
 * identically in both and neither of them can word it differently. The values come from the
 * evaluation result; nothing here computes anything.
 */
export function CalculationTable({ lines }: CalculationTableProps) {
  return (
    <table className="model-table calculation-table">
      <caption>A.4.4.3 calculation: P = I + ½e* − ΔL, E = P − L, Ec = E − E₀, and |Ec| against the mpe.</caption>
      <thead>
        <tr>
          <th scope="col">Formula</th>
          <th scope="col">With the entered values</th>
          <th scope="col">Result</th>
          <th scope="col">Clause</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.formula}>
            <th scope="row" className="calculation-formula">
              {line.formula}
            </th>
            <td className="numeric">{line.substitution}</td>
            <td className="numeric calculation-result">{line.result}</td>
            <td className="calculation-clause">
              <ClauseTag>{line.clause}</ClauseTag>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
