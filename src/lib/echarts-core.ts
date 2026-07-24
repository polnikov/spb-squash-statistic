// Tree-shaken ECharts core. Register only the chart types and components the app
// actually renders (line/bar + grid/tooltip/legend/dataZoom on the canvas), so the
// bundle skips the ~1MB full `echarts` build that `echarts-for-react` pulls by default.
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsOption } from "echarts/types/dist/echarts";
