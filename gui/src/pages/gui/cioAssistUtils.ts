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
 * 2. Value is a valid date string (supports ISO and other formats like MMM-YYYY)
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

    // Check if date field: field name matches pattern AND value is a valid date (ISO or other formats)
    if (dateFieldPattern.test(field) && isValidDate(value)) {
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

  // Use line chart if more than 2 unique dates (i.e., 3 or more), otherwise use bar chart
  return uniqueDates.size > 2 ? "line" : "bar";
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
 * Prepare data for line chart as a pivot table
 * First column is date field, other columns are dimension groups with their cost values
 * Organizes data: dates as labels, each dimension group gets its own dataset (column)
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

  // Extract unique dates sorted and format as labels
  const uniqueDateStrings = Array.from(
    new Set(
      sortedRecords
        .map((r) => {
          const dateVal = r[dateField];
          return isValidDate(dateVal)
            ? new Date(dateVal as string).toISOString().split("T")[0]
            : null;
        })
        .filter((v) => v !== null),
    ),
  ).sort();

  const dateLabels = uniqueDateStrings.map((dateStr) =>
    new Date(dateStr as string).toLocaleDateString(),
  );

  // Get unique dimension group combinations
  const dimensionGroupsSet = new Set<string>();
  const pivotData = new Map<string, Map<string, number>>();

  sortedRecords.forEach((record) => {
    // Create dimension group key
    const dimensionGroupKey =
      dimensionFields.length > 0
        ? dimensionFields.map((f) => record[f]).join(" - ")
        : "Total";

    dimensionGroupsSet.add(dimensionGroupKey);

    // Get date key
    const dateVal = record[dateField];
    const dateKey = isValidDate(dateVal)
      ? new Date(dateVal as string).toISOString().split("T")[0]
      : null;

    if (!dateKey) return;

    // Initialize pivot structure if needed
    if (!pivotData.has(dimensionGroupKey)) {
      pivotData.set(dimensionGroupKey, new Map());
    }

    // Add cost value to the pivot table cell
    const costValue = record[costFields[0]];
    const value =
      typeof costValue === "number" ? parseFloat(costValue.toFixed(2)) : 0;

    const currentValue = pivotData.get(dimensionGroupKey)?.get(dateKey) || 0;
    pivotData.get(dimensionGroupKey)?.set(dateKey, currentValue + value);
  });

  // Create dataset for each dimension group with data for each date
  const dimensionGroups = Array.from(dimensionGroupsSet).sort();
  const datasets: ChartDataset[] = dimensionGroups.map(
    (dimensionGroup, idx) => {
      const dateValueMap = pivotData.get(dimensionGroup) || new Map();
      const data = uniqueDateStrings.map(
        (dateStr) => dateValueMap.get(dateStr as string) || 0,
      );

      return {
        label: dimensionGroup,
        data: data,
        borderColor: generateColor(idx),
        backgroundColor: `rgba(${generateRGB(idx)}, 0.1)`,
        tension: 0.1,
        fill: false,
      };
    },
  );

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

  // Group records by dimension to assign same color to same dimension group
  const groupedByDimension = new Map<string, Record<string, unknown>[]>();

  records.forEach((r) => {
    const groupKey =
      Object.keys(varyingDimensions).length === 0
        ? "Total"
        : Object.keys(varyingDimensions)
            .map((f) => r[f])
            .join(" - ");

    if (!groupedByDimension.has(groupKey)) {
      groupedByDimension.set(groupKey, []);
    }
    groupedByDimension.get(groupKey)!.push(r);
  });

  // Create a dataset for each dimension group (each gets its own color)
  const datasets: ChartDataset[] = Array.from(groupedByDimension.entries()).map(
    ([groupKey, groupRecords], idx) => ({
      label: groupKey,
      data: groupRecords.map((r) => {
        const value = r[costFields[0]];
        return typeof value === "number" ? parseFloat(value.toFixed(2)) : 0;
      }),
      backgroundColor: generateColor(idx),
    }),
  );

  const labels = records.map((r, index) => {
    // Create a label for each record (for the x-axis)
    if (costFields.length > 0) {
      return `${costFields[0]} - ${index + 1}`;
    }
    return `Record ${index + 1}`;
  });

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
