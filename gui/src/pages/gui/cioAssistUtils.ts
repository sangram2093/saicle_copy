/**
 * CioAssist Tool Output Utilities
 * Handles field classification, chart type detection, and data formatting
 */

export type FieldType = "date_field" | "cost_or_bill_values" | "dimension";

export interface FieldTypes {
  [field: string]: FieldType;
}

export interface ChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor: string | string[];
  tension?: number;
  fill?: boolean;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

/**
 * Check if a value is in ISO 8601 date format
 * Valid formats: YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, YYYY-MM-DDTHH:mm:ssZ, etc.
 */
export const isISODateFormat = (value: unknown): boolean => {
  if (typeof value !== "string") return false;

  // ISO 8601 date regex pattern
  // Matches: YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, YYYY-MM-DDTHH:mm:ssZ, YYYY-MM-DDTHH:mm:ss±HH:mm, etc.
  const isoDatePattern =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
  return isoDatePattern.test(value);
};

/**
 * Check if a value is a valid date string (loose validation, accepts multiple formats)
 */
export const isValidDate = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Classify fields in records based on their content and names
 * Returns an object mapping field names to their types
 *
 * A field is identified as date_field only if:
 * 1. Field name matches date pattern (date|time|period) AND
 * 2. Value is in ISO 8601 date format (necessary condition)
 */
export const classifyFields = (
  records: Record<string, unknown>[],
): FieldTypes => {
  const dateFieldPattern = /date|time|period/i;
  const fieldTypes: FieldTypes = {};

  if (!records || records.length === 0) return fieldTypes;

  const firstRecord = records[0];

  Object.keys(firstRecord).forEach((field) => {
    const value = firstRecord[field];

    // Check if date field: field name matches pattern AND value is in ISO format (necessary condition)
    if (dateFieldPattern.test(field) && isISODateFormat(value)) {
      fieldTypes[field] = "date_field";
    }
    // Check if cost/bill field (numeric values)
    else if (typeof value === "number") {
      fieldTypes[field] = "cost_or_bill_values";
    }
    // Other fields are dimensions
    else {
      fieldTypes[field] = "dimension";
    }
  });

  return fieldTypes;
};

/**
 * Determine chart type based on field types and data variation
 * Returns 'line' if date field varies (more than 3 unique dates) and cost fields exist, otherwise 'bar'
 */
export const determineChartType = (
  records: Record<string, unknown>[],
  fieldTypes: FieldTypes,
): "line" | "bar" => {
  const dateFields = Object.keys(fieldTypes).filter(
    (f) => fieldTypes[f] === "date_field",
  );
  const costFields = Object.keys(fieldTypes).filter(
    (f) => fieldTypes[f] === "cost_or_bill_values",
  );

  // No date or cost fields, use bar chart
  if (dateFields.length === 0 || costFields.length === 0) {
    return "bar";
  }

  // Check unique date values
  const uniqueDates = new Set(
    records
      .map((r) => {
        const dateVal = r[dateFields[0]];
        return isValidDate(dateVal)
          ? new Date(dateVal as string).toISOString().split("T")[0]
          : null;
      })
      .filter((v) => v !== null),
  );

  // Use line chart only if more than 3 unique dates, otherwise use bar chart
  return uniqueDates.size > 3 ? "line" : "bar";
};

/**
 * Format a numeric value as Euro currency with 2 decimal places
 */
export const formatCost = (value: number): string => {
  // Round to 2 decimal places
  if (isNaN(value) || value === null) return "€0.00";
  const roundedValue = parseFloat(value.toFixed(2));
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundedValue);
};

/**
 * Generate a distinct color for chart datasets
 */
const generateColor = (index: number): string => {
  const colors = [
    "rgb(75, 192, 192)",
    "rgb(255, 99, 132)",
    "rgb(54, 162, 235)",
    "rgb(255, 206, 86)",
    "rgb(153, 102, 255)",
    "rgb(255, 159, 64)",
  ];
  return colors[index % colors.length];
};

/**
 * Generate RGB values for a color
 */
const generateRGB = (index: number): string => {
  const colors = [
    "75, 192, 192",
    "255, 99, 132",
    "54, 162, 235",
    "255, 206, 86",
    "153, 102, 255",
    "255, 159, 64",
  ];
  return colors[index % colors.length];
};

/**
 * Remove common values from dimension fields to create optimized labels
 * Only keeps values that differ across records for that dimension
 */
const optimizeDimensionLabels = (
  records: Record<string, unknown>[],
  dimensionFields: string[],
): Record<string, string[]> => {
  const result: Record<string, string[]> = {};

  dimensionFields.forEach((field) => {
    const values = records.map((r) => String(r[field]));

    // Check if all values are the same
    const uniqueValues = Array.from(new Set(values));

    // Only include fields that have varying values
    if (uniqueValues.length > 1) {
      result[field] = values;
    }
  });

  return result;
};

/**
 * Prepare data for line chart
 * Groups by non-cost fields and sorts by date
 */
export const prepareLineChartData = (
  records: Record<string, unknown>[],
  dateField: string,
  costFields: string[],
  dimensionFields: string[],
): ChartData => {
  // Sort records by date
  const sortedRecords = [...records].sort((a, b) => {
    const dateA = isValidDate(a[dateField])
      ? new Date(a[dateField] as string).getTime()
      : 0;
    const dateB = isValidDate(b[dateField])
      ? new Date(b[dateField] as string).getTime()
      : 0;
    return dateA - dateB;
  });

  // Extract unique dates and sort
  const dateLabels = Array.from(
    new Set(
      sortedRecords.map((r) =>
        isValidDate(r[dateField])
          ? new Date(r[dateField] as string).toLocaleDateString()
          : "",
      ),
    ),
  ).filter((d) => d !== "");

  // Create dataset for each cost field
  const datasets: ChartDataset[] = costFields.map((costField, idx) => {
    const data = sortedRecords.map((record) => {
      const value = record[costField];
      return typeof value === "number" ? parseFloat(value.toFixed(2)) : 0;
    });

    return {
      label: costField,
      data: data,
      borderColor: generateColor(idx),
      backgroundColor: `rgba(${generateRGB(idx)}, 0.1)`,
      tension: 0.1,
      fill: false,
    };
  });

  return {
    labels: dateLabels,
    datasets: datasets,
  };
};

/**
 * Prepare data for bar chart
 * Groups records by dimension fields (excluding date field) with bars per date value
 * For each unique dimension group, shows bars for each date value (sorted ascending)
 */
export const prepareBarChartData = (
  records: Record<string, unknown>[],
  costFields: string[],
  dimensionFields: string[],
  dateField?: string,
): ChartData => {
  // Filter out date field from dimension fields if it exists
  const groupByFields = dimensionFields.filter((f) => f !== dateField);

  // If there's a date field, group by other fields and create bars per date
  if (dateField) {
    // Get unique dates sorted ascending
    const uniqueDates = Array.from(
      new Set(
        records
          .map((r) => {
            const dateVal = r[dateField];
            return isValidDate(dateVal)
              ? new Date(dateVal as string).toISOString().split("T")[0]
              : null;
          })
          .filter((v) => v !== null),
      ),
    ).sort();

    // Get unique group values
    const groupedData = new Map<string, Map<string, number>>();

    records.forEach((record) => {
      const groupKey =
        groupByFields.length > 0
          ? groupByFields.map((f) => record[f]).join(" - ")
          : "Total";

      const dateKey = isValidDate(record[dateField])
        ? new Date(record[dateField] as string).toISOString().split("T")[0]
        : null;

      if (!dateKey) return;

      if (!groupedData.has(groupKey)) {
        groupedData.set(groupKey, new Map());
      }

      const costValue = record[costFields[0]];
      const value =
        typeof costValue === "number" ? parseFloat(costValue.toFixed(2)) : 0;

      const currentValue = groupedData.get(groupKey)?.get(dateKey) || 0;
      groupedData.get(groupKey)?.set(dateKey, currentValue + value);
    });

    // Create datasets for each group
    const datasets: ChartDataset[] = Array.from(groupedData.entries()).map(
      ([groupKey, dateValues], idx) => ({
        label: groupKey,
        data: uniqueDates.map((date) => dateValues.get(date) || 0),
        backgroundColor: generateColor(idx),
      }),
    );

    return {
      labels: uniqueDates,
      datasets: datasets,
    };
  }

  // Original logic for bar chart without date field
  const varyingDimensions = optimizeDimensionLabels(records, dimensionFields);

  const labels = records.map((r) => {
    if (Object.keys(varyingDimensions).length === 0) {
      return `Record ${records.indexOf(r) + 1}`;
    }
    return Object.keys(varyingDimensions)
      .map((f) => r[f])
      .join(" - ");
  });

  const datasets: ChartDataset[] = costFields.map((costField, idx) => ({
    label: costField,
    data: records.map((r) => {
      const value = r[costField];
      return typeof value === "number" ? parseFloat(value.toFixed(2)) : 0;
    }),
    backgroundColor: generateColor(idx),
  }));

  return {
    labels: labels,
    datasets: datasets,
  };
};

/**
 * Process records: round cost values to 2 decimal places
 */
export const processRecords = (
  records: Record<string, unknown>[],
  fieldTypes: FieldTypes,
): Record<string, unknown>[] => {
  const costFields = Object.keys(fieldTypes).filter(
    (f) => fieldTypes[f] === "cost_or_bill_values",
  );

  return records.map((record) => ({
    ...record,
    ...costFields.reduce(
      (acc, field) => {
        const value = record[field];
        acc[field] =
          typeof value === "number" ? parseFloat(value.toFixed(2)) : value;
        return acc;
      },
      {} as Record<string, unknown>,
    ),
  }));
};

/**
 * Determine data representation format used by CioAssistRenderer
 * Returns information about whether table and/or chart is displayed
 */
export interface DataRepresentationInfo {
  hasTable: boolean;
  hasChart: boolean;
  representationMessage: string;
}

export const getDataRepresentationInfo = (
  recordCount: number,
  chartData: any,
): DataRepresentationInfo => {
  const hasTable = recordCount > 1;
  const hasChart = chartData !== null;

  let representationMessage = "The tool output has been presented as: ";

  if (hasTable && hasChart) {
    representationMessage +=
      "both a data table and a chart visualization. The table shows the raw data, and the chart provides a visual representation. ";
    representationMessage +=
      "If you can provide additional value-added observations or insights based on the data patterns visible in both formats, please share them. ";
    representationMessage +=
      "Otherwise, no need to provide the data in table format as markdown.";
  } else if (hasTable && !hasChart) {
    representationMessage +=
      "a data table. If you can provide additional value-added observations or insights based on the tabular data, please share them. ";
    representationMessage +=
      "Otherwise, no need to reproduce the table as markdown.";
  } else if (!hasTable && hasChart) {
    representationMessage +=
      "a chart visualization. Since there is only one row of data, a table view was not shown. ";
    representationMessage +=
      "If you can provide additional value-added observations or insights based on the chart, please share them. ";
    representationMessage +=
      "Otherwise, no need to provide the data in any additional format.";
  } else {
    representationMessage +=
      "neither a table nor a chart (insufficient data). ";
    representationMessage +=
      "Please provide any relevant observations if possible.";
  }

  return {
    hasTable,
    hasChart,
    representationMessage,
  };
};
