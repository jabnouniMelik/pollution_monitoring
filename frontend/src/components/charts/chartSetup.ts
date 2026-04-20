/**
 * Register Chart.js components once for the entire app.
 * Import this module anywhere a chart is rendered (or in main.tsx).
 */
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js'
import 'chartjs-adapter-date-fns'

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
  TimeScale,
)

ChartJS.defaults.font.family =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
ChartJS.defaults.color = '#64748B'
