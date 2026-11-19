import { lazy, Suspense } from "react"
import type { ChartCanvasProps } from "./ChartCanvas"

const ChartCanvas = lazy(() => import("./ChartCanvas"))

/**
 * `ChartCanvas` loaded on demand, so dashboards that show a chart do not put
 * Chart.js in the initial bundle. Shows a polite loading placeholder meanwhile.
 */
export default function LazyChart(props: ChartCanvasProps) {
  return (
    <Suspense
      fallback={
        <div className={props.tall ? "chart-canvas tall chart-loading" : "chart-canvas chart-loading"} role="status">
          Carregando gráfico…
        </div>
      }
    >
      <ChartCanvas {...props} />
    </Suspense>
  )
}
