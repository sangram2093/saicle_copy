/**
 * CioAssistRenderer Component
 * Renders cio_assist tool output as HTML table and charts using D3.js
 */

import React, { useEffect, useMemo, useState } from "react";
import D3BarChart from "./D3BarChart";
import D3LineChart from "./D3LineChart";
import {
  classifyFields,
  determineChartType,
  FieldTypes,
  formatCost,
  getDataRepresentationInfo,
  prepareBarChartData,
  prepareLineChartData,
  processRecords,
} from "./cioAssistUtils";

interface CioAssistRendererProps {
  jsonLines: string;
  toolName: string;
  onRepresentationChange?: (info: {
    hasTable: boolean;
    hasChart: boolean;
    representationMessage: string;
  }) => void;
}

interface RenderState {
  records: Record<string, unknown>[];
  fieldTypes: FieldTypes;
  chartType: "line" | "bar" | null;
  chartData: any;
  error: string | null;
  representationInfo?: {
    hasTable: boolean;
    hasChart: boolean;
    representationMessage: string;
  };
  costFields: string[];
  dateField?: string;
  dimensionFields: string[];
}

interface ArrowData {
  label: string;
  startValue: number;
  endValue: number;
  percentChange: number;
  color: string;
  datasetIndex: number;
}

/**
 * Main component for rendering cio_assist tool output
 */
export const CioAssistRenderer: React.FC<CioAssistRendererProps> = ({
  jsonLines,
  toolName,
  onRepresentationChange,
}) => {
  const [chartTypeOverride, setChartTypeOverride] = useState<
    "bar" | "line" | null
  >(null);
  const [visibleDatasets, setVisibleDatasets] = useState<Set<number>>(
    new Set(),
  );

  const renderState = useMemo<RenderState>(() => {
    try {
      // Check if tool name contains 'cio_assist'
      if (!toolName?.toLowerCase().includes("cio_assist") || !jsonLines) {
        return {
          records: [],
          fieldTypes: {},
          chartType: null,
          chartData: null,
          error: null,
          costFields: [],
          dateField: undefined,
          dimensionFields: [],
        };
      }

      // Parse JSONL format (one JSON object per line)
      const lines = jsonLines
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      const records = lines.map((line) => {
        try {
          return JSON.parse(line.trim());
        } catch (e) {
          throw new Error(`Failed to parse JSON line: ${line}`);
        }
      });

      if (records.length === 0) {
        return {
          records: [],
          fieldTypes: {},
          chartType: null,
          chartData: null,
          error: "No records found",
          costFields: [],
          dateField: undefined,
          dimensionFields: [],
        };
      }

      // Classify fields
      const fieldTypes = classifyFields(records);

      // Get field names by type
      const dateFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "date_field",
      );
      const costFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "cost_or_bill_values",
      );
      const dimensionFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "dimension",
      );

      // Process records (round cost values to 2 decimals)
      const processedRecords = processRecords(records, fieldTypes);

      // Determine chart type
      const chartType = determineChartType(processedRecords, fieldTypes);

      // Prepare chart data
      let chartData = null;
      if (
        chartType === "line" &&
        dateFields.length > 0 &&
        costFields.length > 0
      ) {
        chartData = prepareLineChartData(
          processedRecords,
          dateFields[0],
          costFields,
          dimensionFields,
        );
      } else if (costFields.length > 0) {
        chartData = prepareBarChartData(
          processedRecords,
          costFields,
          dimensionFields,
          dateFields.length > 0 ? dateFields[0] : undefined,
        );
      }

      return {
        records: processedRecords,
        fieldTypes,
        chartType,
        chartData,
        error: null,
        representationInfo: getDataRepresentationInfo(
          processedRecords.length,
          chartData,
        ),
        costFields,
        dateField: dateFields.length > 0 ? dateFields[0] : undefined,
        dimensionFields,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      return {
        records: [],
        fieldTypes: {},
        chartType: null,
        chartData: null,
        error: errorMessage,
        representationInfo: undefined,
        costFields: [],
        dateField: undefined,
        dimensionFields: [],
      };
    }
  }, [jsonLines, toolName]);

  const {
    records,
    fieldTypes,
    chartType,
    chartData,
    error,
    representationInfo,
  } = renderState;

  // Call callback when representation info changes
  useEffect(() => {
    if (onRepresentationChange && representationInfo) {
      onRepresentationChange(representationInfo);
    }
  }, [representationInfo, onRepresentationChange]);

  // Render error state
  if (error) {
    return (
      <div
        style={{
          color: "#dc2626",
          padding: "16px",
          borderRadius: "6px",
          backgroundColor: "#fecaca",
        }}
      >
        <strong>Error:</strong> {error}
      </div>
    );
  }

  // Render empty state
  if (records.length === 0) {
    return (
      <div style={{ padding: "16px", color: "#6b7280" }}>
        No data to display
      </div>
    );
  }

  const fieldNames = Object.keys(records[0]);

  return (
    <div style={{ padding: "20px" }}>
      {/* HTML Table - Only display if multiple rows */}
      {records.length > 1 && (
        <div style={{ marginBottom: "40px" }}>
          <h3
            style={{
              fontSize: "1.125rem",
              fontWeight: "600",
              marginBottom: "16px",
            }}
          >
            Data Table
          </h3>
          <div
            style={{
              overflowX: "auto",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
            }}
          >
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                backgroundColor: "#fff",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f3f4f6",
                    borderBottom: "2px solid #e5e7eb",
                  }}
                >
                  {fieldNames.map((field) => (
                    <th
                      key={field}
                      style={{
                        border: "1px solid #e5e7eb",
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#1f2937",
                      }}
                    >
                      <div>{field}</div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                          marginTop: "4px",
                          fontWeight: "400",
                        }}
                      >
                        ({fieldTypes[field]})
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record, rowIdx) => (
                  <tr
                    key={rowIdx}
                    style={{
                      backgroundColor: rowIdx % 2 === 0 ? "#fff" : "#f9fafb",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    {fieldNames.map((field) => (
                      <td
                        key={`${rowIdx}-${field}`}
                        style={{
                          border: "1px solid #e5e7eb",
                          padding: "12px",
                          color: "#374151",
                        }}
                      >
                        {fieldTypes[field] === "cost_or_bill_values"
                          ? formatCost(record[field] as number)
                          : fieldTypes[field] === "date_field"
                            ? new Date(record[field] as string).toLocaleString()
                            : String(record[field])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData && (
        <div style={{ marginTop: "40px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: "600",
                margin: "0",
              }}
            >
              {(chartTypeOverride || chartType) === "line"
                ? "Trend Analysis"
                : "Cost Breakdown"}
            </h3>

            {/* Chart Type Toggle */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              {/* Bar Chart SVG Toggle */}
              <button
                onClick={() => setChartTypeOverride("bar")}
                title="Switch to Bar Chart"
                style={{
                  padding: "6px",
                  borderRadius: "4px",
                  border:
                    chartTypeOverride === "bar" ||
                    (chartTypeOverride === null && chartType === "bar")
                      ? "2px solid #3b82f6"
                      : "1px solid #d1d5db",
                  backgroundColor:
                    chartTypeOverride === "bar" ||
                    (chartTypeOverride === null && chartType === "bar")
                      ? "#eff6ff"
                      : "#fff",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    color:
                      chartTypeOverride === "bar" ||
                      (chartTypeOverride === null && chartType === "bar")
                        ? "#1e40af"
                        : "#6b7280",
                  }}
                >
                  {/* Bar Chart Icon - 3 vertical bars */}
                  <rect x="3" y="12" width="3" height="8" fill="currentColor" />
                  <rect
                    x="10"
                    y="6"
                    width="3"
                    height="14"
                    fill="currentColor"
                  />
                  <rect
                    x="17"
                    y="9"
                    width="3"
                    height="11"
                    fill="currentColor"
                  />
                </svg>
              </button>

              {/* Line Chart SVG Toggle */}
              <button
                onClick={() => setChartTypeOverride("line")}
                title="Switch to Line Chart"
                style={{
                  padding: "6px",
                  borderRadius: "4px",
                  border:
                    chartTypeOverride === "line"
                      ? "2px solid #3b82f6"
                      : "1px solid #d1d5db",
                  backgroundColor:
                    chartTypeOverride === "line" ? "#eff6ff" : "#fff",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    color: chartTypeOverride === "line" ? "#1e40af" : "#6b7280",
                  }}
                >
                  {/* Line Chart Icon - connected points */}
                  <polyline
                    points="3,18 8,12 13,14 20,5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="3" cy="18" r="2" fill="currentColor" />
                  <circle cx="8" cy="12" r="2" fill="currentColor" />
                  <circle cx="13" cy="14" r="2" fill="currentColor" />
                  <circle cx="20" cy="5" r="2" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>

          <div
            style={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              padding: "20px",
              backgroundColor: "#f9fafb",
              minHeight: "650px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {(chartTypeOverride || chartType) === "line" ? (
              <D3LineChart
                labels={chartData.labels}
                datasets={chartData.datasets}
                title="Trend Analysis"
                width={950}
                height={650}
              />
            ) : (
              <D3BarChart
                labels={chartData.labels}
                datasets={chartData.datasets}
                title="Cost Breakdown"
                width={950}
                height={650}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CioAssistRenderer;
