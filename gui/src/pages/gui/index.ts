/**
 * CioAssist Module Exports
 *
 * This module provides utilities and components for rendering cio_assist tool output
 * as HTML tables and interactive charts.
 */

export { CioAssistRenderer, default } from "./CioAssistRenderer";

export {
  classifyFields,
  determineChartType,
  formatCost,
  isValidDate,
  prepareBarChartData,
  prepareLineChartData,
  processRecords,
} from "./cioAssistUtils";

export type {
  ChartData,
  ChartDataset,
  FieldType,
  FieldTypes,
} from "./cioAssistUtils";
