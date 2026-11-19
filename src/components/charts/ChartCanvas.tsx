import { useEffect, useRef } from "react"
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartDataset,
} from "chart.js"

// Registro explícito (tree-shaking): só os tipos usados pelos relatórios entram no chunk.
Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip)

export type ChartKind = "bar" | "horizontalBar" | "line" | "doughnut"

export interface ChartSeries {
  label: string
  values: number[]
}

export interface ChartCanvasProps {
  kind: ChartKind
  /** Accessible name of the chart and caption of its data table. */
  title: string
  labels: string[]
  series: ChartSeries[]
  /** CSS custom properties (design tokens) used in order for series, or for slices in a doughnut. */
  colorTokens?: string[]
  tall?: boolean
}

const DEFAULT_COLOR_TOKENS = ["--navy", "--sage", "--green", "--slate", "--mint"]

function readToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function buildDatasets(props: ChartCanvasProps, palette: string[]): ChartDataset<"bar" | "line" | "doughnut">[] {
  return props.series.map((chartSeries, seriesIndex) => {
    const seriesColor = palette[seriesIndex % palette.length]
    if (props.kind === "doughnut") {
      const sliceColors = chartSeries.values.map((_value, sliceIndex) => palette[sliceIndex % palette.length])
      return { label: chartSeries.label, data: chartSeries.values, backgroundColor: sliceColors, borderWidth: 1 }
    }
    if (props.kind === "line") {
      return { label: chartSeries.label, data: chartSeries.values, borderColor: seriesColor, backgroundColor: seriesColor, tension: 0.25, pointRadius: 4 }
    }
    return { label: chartSeries.label, data: chartSeries.values, backgroundColor: seriesColor, borderRadius: 4, maxBarThickness: 40 }
  })
}

function buildConfig(props: ChartCanvasProps): ChartConfiguration<"bar" | "line" | "doughnut"> {
  const palette = (props.colorTokens ?? DEFAULT_COLOR_TOKENS).map(readToken)
  const textColor = readToken("--slate")
  const gridColor = readToken("--line")
  const isDoughnut = props.kind === "doughnut"
  const axisScales = {
    x: { ticks: { color: textColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
    y: { ticks: { color: textColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
  }
  return {
    type: props.kind === "horizontalBar" ? "bar" : props.kind,
    data: { labels: props.labels, datasets: buildDatasets(props, palette) },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersReducedMotion() ? false : undefined,
      indexAxis: props.kind === "horizontalBar" ? "y" : "x",
      plugins: {
        legend: { display: isDoughnut || props.series.length > 1, position: "bottom", labels: { color: textColor } },
      },
      scales: isDoughnut ? {} : axisScales,
    },
  }
}

/**
 * Reusable Chart.js wrapper for backend-provided report data.
 *
 * Colors come from the CSS design tokens, the chart is destroyed on unmount or
 * when its data changes, and a visually hidden table repeats the values for
 * screen readers. When the canvas has no 2D context (for example in jsdom),
 * only the table is rendered. Load it through `LazyChart` outside lazy screens
 * so Chart.js stays out of the initial bundle.
 */
export default function ChartCanvas(props: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { kind, title, labels, series, colorTokens, tall } = props

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d")
    if (!context) return undefined
    const chart = new Chart(context, buildConfig({ kind, title, labels, series, colorTokens }))
    return () => chart.destroy()
  }, [kind, title, labels, series, colorTokens])

  return (
    <figure className={tall ? "chart-canvas tall" : "chart-canvas"}>
      <div className="chart-canvas-area">
        <canvas ref={canvasRef} role="img" aria-label={title} />
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Categoria</th>
            {series.map((chartSeries) => (
              <th scope="col" key={chartSeries.label}>
                {chartSeries.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, labelIndex) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {series.map((chartSeries) => (
                <td key={chartSeries.label}>{chartSeries.values[labelIndex]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
