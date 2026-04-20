import 'chart.js'

declare module 'chart.js' {
  interface TooltipPositionerMap {
    centered: TooltipPositionerFunction<ChartType>
  }
}
