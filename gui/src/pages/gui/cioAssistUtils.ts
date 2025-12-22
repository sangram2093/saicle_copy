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
 * Check if a value is a valid date string
 */
export const isValidDate = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Classify fields in records based on their content and names
 * Returns an object mapping field names to their types
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

    // Check if date field (by name pattern or valid date value)
    if (dateFieldPattern.test(field) || isValidDate(value)) {
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
 * Returns 'line' if date field varies and cost fields exist, otherwise 'bar'
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

  // Check if date field values vary
  const dateValues = records
    .map((r) => {
      const dateVal = r[dateFields[0]];
      return isValidDate(dateVal)
        ? new Date(dateVal as string).getTime()
        : null;
    })
    .filter((v) => v !== null) as number[];

  if (dateValues.length === 0) return "bar";

  const minDate = Math.min(...dateValues);
  const maxDate = Math.max(...dateValues);

  // If dates vary, use line chart; otherwise use bar chart
  return minDate !== maxDate ? "line" : "bar";
};

/**
 * Format a numeric value as Euro currency with 2 decimal places
 */
export const formatCost = (value: number): string => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
 * Groups records by dimension fields with cost values on Y-axis
 */
export const prepareBarChartData = (
  records: Record<string, unknown>[],
  costFields: string[],
  dimensionFields: string[],
): ChartData => {
  // Get optimized dimension labels (only varying fields)
  const varyingDimensions = optimizeDimensionLabels(records, dimensionFields);

  // Create labels from varying dimension fields only
  const labels = records.map((r) => {
    if (Object.keys(varyingDimensions).length === 0) {
      return `Record ${records.indexOf(r) + 1}`;
    }
    return Object.keys(varyingDimensions)
      .map((f) => r[f])
      .join(" - ");
  });

  // Create datasets for each cost field
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
