/**
 * CioAssistRenderer Component
 * Renders cio_assist tool output as HTML table and charts
 */

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import React, { useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  classifyFields,
  determineChartType,
  FieldTypes,
  formatCost,
  prepareBarChartData,
  prepareLineChartData,
  processRecords,
} from "./cioAssistUtils";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface CioAssistRendererProps {
  jsonLines: string;
  toolName: string;
}

interface RenderState {
  records: Record<string, unknown>[];
  fieldTypes: FieldTypes;
  chartType: "line" | "bar" | null;
  chartData: any;
  error: string | null;
}

/**
 * Main component for rendering cio_assist tool output
 */
export const CioAssistRenderer: React.FC<CioAssistRendererProps> = ({
  jsonLines,
  toolName,
}) => {
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
        );
      }

      return {
        records: processedRecords,
        fieldTypes,
        chartType,
        chartData,
        error: null,
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
      };
    }
  }, [jsonLines, toolName]);

  const { records, fieldTypes, chartType, chartData, error } = renderState;

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
      {/* HTML Table */}
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

      {/* Chart */}
      {chartData && (
        <div style={{ marginTop: "40px" }}>
          <h3
            style={{
              fontSize: "1.125rem",
              fontWeight: "600",
              marginBottom: "16px",
            }}
          >
            {chartType === "line" ? "Trend Analysis" : "Cost Breakdown"}
          </h3>
          <div
            style={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              padding: "20px",
              backgroundColor: "#f9fafb",
            }}
          >
            {chartType === "line" ? (
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: {
                      position: "top" as const,
                      labels: {
                        padding: 15,
                        font: { size: 12 },
                      },
                    },
                    title: {
                      display: true,
                      text: "Cost Trends Over Time",
                      font: { size: 14, weight: "bold" },
                    },
                  },
                  scales: {
                    y: {
                      title: {
                        display: true,
                        text: "Cost (EUR)",
                        font: { weight: "bold" },
                      },
                      beginAtZero: true,
                    },
                    x: {
                      title: {
                        display: true,
                        text: "Date",
                        font: { weight: "bold" },
                      },
                    },
                  },
                }}
              />
            ) : (
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: {
                      position: "top" as const,
                      labels: {
                        padding: 15,
                        font: { size: 12 },
                      },
                    },
                    title: {
                      display: true,
                      text: "Cost by Category",
                      font: { size: 14, weight: "bold" },
                    },
                  },
                  scales: {
                    y: {
                      title: {
                        display: true,
                        text: "Cost (EUR)",
                        font: { weight: "bold" },
                      },
                      beginAtZero: true,
                    },
                    x: {
                      title: {
                        display: true,
                        text: "Category",
                        font: { weight: "bold" },
                      },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CioAssistRenderer;
