/**
 * Test cases for cioAssistUtils
 */

import { describe, expect, it } from "vitest";
import {
  classifyFields,
  determineChartType,
  formatCost,
  isISODateFormat,
  isValidDate,
  prepareBarChartData,
  prepareLineChartData,
  processRecords,
} from "./cioAssistUtils";

// Sample test data
const sampleRecords = [
  {
    "allocated cost": 29999.0203,
    "business unit": "Investment bank",
    cio: "denis.roux@db.com",
    "reporting period end date": "2025-09-01T00:00:00+05:30",
  },
  {
    "allocated cost": 19999.0203,
    "business unit": "corporate bank",
    cio: "denis.roux@db.com",
    "reporting period end date": "2025-09-01T00:00:00+05:30",
  },
];

const varyingDateRecords = [
  {
    "allocated cost": 29999.02,
    "business unit": "Investment bank",
    cio: "denis.roux@db.com",
    "reporting period end date": "2025-09-01T00:00:00+05:30",
  },
  {
    "allocated cost": 25000.5,
    "business unit": "Investment bank",
    cio: "denis.roux@db.com",
    "reporting period end date": "2025-10-01T00:00:00+05:30",
  },
];

const manyDatesRecords = [
  {
    "allocated cost": 29999.02,
    "business unit": "Investment bank",
    cio: "denis.roux@db.com",
    "reporting period end date": "2025-09-01T00:00:00+05:30",
  },
  {
    "allocated cost": 25000.5,
    "business unit": "Investment bank",
    cio: "denis.roux@db.com",
    "reporting period end date": "2025-10-01T00:00:00+05:30",
  },
  {
    "allocated cost": 30000.0,
    "business unit": "Investment bank",
    cio: "denis.roux@db.com",
    "reporting period end date": "2025-11-01T00:00:00+05:30",
  },
];

describe("cioAssistUtils", () => {
  describe("isValidDate", () => {
    it("should return true for valid date string", () => {
      expect(isValidDate("2025-09-01T00:00:00+05:30")).toBe(true);
      expect(isValidDate("2025-01-15")).toBe(true);
      expect(isValidDate("2025/01/15")).toBe(true);
      expect(isValidDate("Jan-2025")).toBe(true);
      expect(isValidDate("Dec-2024")).toBe(true);
      expect(isValidDate("Sep-2025")).toBe(true);
    });

    it("should return false for non-string values", () => {
      expect(isValidDate(123)).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
    });

    it("should return false for invalid date strings", () => {
      expect(isValidDate("not a date")).toBe(false);
      expect(isValidDate("2025-13-01")).toBe(false);
    });
  });

  describe("isISODateFormat", () => {
    it("should return true for valid ISO 8601 date strings", () => {
      expect(isISODateFormat("2025-01-15")).toBe(true);
      expect(isISODateFormat("2025-12-22")).toBe(true);
      expect(isISODateFormat("2025-09-01T00:00:00")).toBe(true);
      expect(isISODateFormat("2025-09-01T00:00:00Z")).toBe(true);
      expect(isISODateFormat("2025-09-01T00:00:00+05:30")).toBe(true);
      expect(isISODateFormat("2025-09-01T00:00:00-05:00")).toBe(true);
      expect(isISODateFormat("2025-09-01T00:00:00.123Z")).toBe(true);
    });

    it("should return false for non-ISO date formats", () => {
      expect(isISODateFormat("2025/01/15")).toBe(false);
      expect(isISODateFormat("15-01-2025")).toBe(false);
      expect(isISODateFormat("01/15/2025")).toBe(false);
      expect(isISODateFormat("2025-Q1")).toBe(false);
      expect(isISODateFormat("January 15, 2025")).toBe(false);
      expect(isISODateFormat("Jan-2025")).toBe(false);
      expect(isISODateFormat("Dec-2024")).toBe(false);
      expect(isISODateFormat("Sep-2025")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isISODateFormat(123)).toBe(false);
      expect(isISODateFormat(null)).toBe(false);
      expect(isISODateFormat(undefined)).toBe(false);
      expect(isISODateFormat({})).toBe(false);
    });
  });

  describe("classifyFields", () => {
    it("should classify fields correctly", () => {
      const fieldTypes = classifyFields(sampleRecords);
      expect(fieldTypes["allocated cost"]).toBe("cost_or_bill_values");
      expect(fieldTypes["reporting period end date"]).toBe("date_field");
      expect(fieldTypes["business unit"]).toBe("dimension");
      expect(fieldTypes["cio"]).toBe("dimension");
    });

    it("should return empty object for empty records", () => {
      const fieldTypes = classifyFields([]);
      expect(fieldTypes).toEqual({});
    });

    it("should identify date fields by name pattern", () => {
      const records = [
        {
          "start date": "2025-01-01",
          "end time": "2025-01-31",
          "report period": "2025-01-15",
          value: 100,
        },
      ];
      const fieldTypes = classifyFields(records);
      expect(fieldTypes["start date"]).toBe("date_field");
      expect(fieldTypes["end time"]).toBe("date_field");
      expect(fieldTypes["report period"]).toBe("date_field");
      expect(fieldTypes["value"]).toBe("cost_or_bill_values");
    });

    it("should classify MMM-YYYY format as date_field", () => {
      const records = [
        {
          period: "Jan-2025",
          "reporting date": "Dec-2024",
          cost: 50000,
        },
      ];
      const fieldTypes = classifyFields(records);
      expect(fieldTypes["period"]).toBe("date_field");
      expect(fieldTypes["reporting date"]).toBe("date_field");
      expect(fieldTypes["cost"]).toBe("cost_or_bill_values");
    });
  });

  describe("determineChartType", () => {
    it("should return bar chart when dates are not varying", () => {
      const fieldTypes = classifyFields(sampleRecords);
      const chartType = determineChartType(sampleRecords, fieldTypes);
      expect(chartType).toBe("bar");
    });

    it("should return bar chart when dates are varying (up to 2 unique dates)", () => {
      const fieldTypes = classifyFields(varyingDateRecords);
      const chartType = determineChartType(varyingDateRecords, fieldTypes);
      expect(chartType).toBe("bar");
    });

    it("should return line chart when dates are varying (more than 2 unique dates)", () => {
      const manyDatesRecords = [
        {
          "allocated cost": 29999.02,
          "business unit": "Investment bank",
          cio: "denis.roux@db.com",
          "reporting period end date": "2025-09-01",
        },
        {
          "allocated cost": 25000.5,
          "business unit": "Investment bank",
          cio: "denis.roux@db.com",
          "reporting period end date": "2025-10-01",
        },
        {
          "allocated cost": 30000.0,
          "business unit": "Investment bank",
          cio: "denis.roux@db.com",
          "reporting period end date": "2025-11-01",
        },
        {
          "allocated cost": 27000.0,
          "business unit": "Investment bank",
          cio: "denis.roux@db.com",
          "reporting period end date": "2025-12-01",
        },
        {
          "allocated cost": 31000.0,
          "business unit": "Investment bank",
          cio: "denis.roux@db.com",
          "reporting period end date": "2026-01-01",
        },
      ];
      const fieldTypes = classifyFields(manyDatesRecords);
      const chartType = determineChartType(manyDatesRecords, fieldTypes);
      expect(chartType).toBe("line");
    });

    it("should return bar chart when no date fields exist", () => {
      const records = [
        { "business unit": "Investment bank", cost: 1000 },
        { "business unit": "corporate bank", cost: 2000 },
      ];
      const fieldTypes = classifyFields(records);
      const chartType = determineChartType(records, fieldTypes);
      expect(chartType).toBe("bar");
    });

    it("should return bar chart when no cost fields exist", () => {
      const records = [
        { name: "Item1", date: "2025-09-01" },
        { name: "Item2", date: "2025-10-01" },
      ];
      const fieldTypes = classifyFields(records);
      const chartType = determineChartType(records, fieldTypes);
      expect(chartType).toBe("bar");
    });
  });

  describe("formatCost", () => {
    it("should format cost with euro symbol and 2 decimals", () => {
      const formatted = formatCost(29999.0203);
      // Euro format varies by locale (German uses . for thousands, , for decimals)
      expect(formatted).toMatch(/29[.,]999[.,]02|29999[.,]02/);
      expect(formatted).toMatch(/€/);
    });

    it("should round to 2 decimal places", () => {
      const formatted = formatCost(100.126);
      expect(formatted).toMatch(/100/);
    });

    it("should handle zero values", () => {
      const formatted = formatCost(0);
      expect(formatted).toMatch(/0|EUR/i);
    });

    it("should handle negative values", () => {
      const formatted = formatCost(-100.5);
      expect(formatted).toMatch(/-/);
    });
  });

  describe("processRecords", () => {
    it("should round cost values to 2 decimal places", () => {
      const fieldTypes = classifyFields(sampleRecords);
      const processed = processRecords(sampleRecords, fieldTypes);

      expect(processed[0]["allocated cost"]).toBe(29999.02);
      expect(processed[1]["allocated cost"]).toBe(19999.02);
    });

    it("should preserve non-cost fields", () => {
      const fieldTypes = classifyFields(sampleRecords);
      const processed = processRecords(sampleRecords, fieldTypes);

      expect(processed[0]["business unit"]).toBe("Investment bank");
      expect(processed[0]["cio"]).toBe("denis.roux@db.com");
    });

    it("should handle records with no cost fields", () => {
      const records = [{ name: "test", description: "sample" }];
      const fieldTypes = classifyFields(records);
      const processed = processRecords(records, fieldTypes);

      expect(processed[0]["name"]).toBe("test");
      expect(processed[0]["description"]).toBe("sample");
    });
  });

  describe("prepareBarChartData", () => {
    it("should prepare bar chart data correctly", () => {
      const fieldTypes = classifyFields(sampleRecords);
      const costFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "cost_or_bill_values",
      );
      const dimensionFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "dimension",
      );

      const chartData = prepareBarChartData(
        sampleRecords,
        costFields,
        dimensionFields,
      );

      // With new implementation: each distinct dimension group gets its own dataset with its own color
      // sampleRecords has 2 records with different "business unit" values
      expect(chartData.labels).toHaveLength(2);
      expect(chartData.datasets).toHaveLength(2); // One dataset per dimension group
      expect(chartData.datasets[0].label).toBe("Investment bank"); // First dimension group
      expect(chartData.datasets[1].label).toBe("corporate bank"); // Second dimension group
      expect(chartData.datasets[0].data).toEqual([29999.02]);
      expect(chartData.datasets[1].data).toEqual([19999.02]);
    });

    it("should create correct number of datasets for multiple cost fields", () => {
      const records = [
        { category: "A", cost1: 100, cost2: 200 },
        { category: "B", cost1: 150, cost2: 250 },
      ];
      const fieldTypes = classifyFields(records);
      const costFields = ["cost1", "cost2"];
      const dimensionFields = ["category"];

      const chartData = prepareBarChartData(
        records,
        costFields,
        dimensionFields,
      );

      // With new implementation: each distinct dimension group gets its own dataset
      // records has 2 categories: A and B
      expect(chartData.datasets).toHaveLength(2);
      expect(chartData.datasets[0].label).toBe("A");
      expect(chartData.datasets[1].label).toBe("B");
      // Each dataset shows the first cost field (cost1) for that dimension
      expect(chartData.datasets[0].data).toEqual([100]);
      expect(chartData.datasets[1].data).toEqual([150]);
    });
  });

  describe("prepareLineChartData", () => {
    it("should prepare line chart data correctly", () => {
      const fieldTypes = classifyFields(manyDatesRecords);
      const dateFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "date_field",
      );
      const costFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "cost_or_bill_values",
      );
      const dimensionFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "dimension",
      );

      const chartData = prepareLineChartData(
        manyDatesRecords,
        dateFields[0],
        costFields,
        dimensionFields,
      );

      // With pivot table: dates as labels, dimension groups as datasets
      // manyDatesRecords has 1 dimension group combining all dimension fields
      expect(chartData.labels).toHaveLength(3);
      expect(chartData.datasets).toHaveLength(1); // One dataset per dimension group
      expect(chartData.datasets[0].label).toBe(
        "Investment bank - denis.roux@db.com",
      ); // Dimension group
      expect(chartData.datasets[0].data).toEqual([29999.02, 25000.5, 30000]);
    });

    it("should sort records by date ascending", () => {
      const unsortedRecords = [
        { date: "2025-11-01T00:00:00+05:30", value: 100 },
        { date: "2025-09-01T00:00:00+05:30", value: 300 },
        { date: "2025-10-01T00:00:00+05:30", value: 200 },
      ];

      const fieldTypes = classifyFields(unsortedRecords);
      const dateFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "date_field",
      );
      const costFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "cost_or_bill_values",
      );
      const dimensionFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "dimension",
      );

      const chartData = prepareLineChartData(
        unsortedRecords,
        dateFields[0],
        costFields,
        dimensionFields,
      );

      // Data should be sorted by date (ascending)
      // With no dimension fields, all records are grouped as "Total"
      expect(chartData.datasets).toHaveLength(1);
      expect(chartData.datasets[0].label).toBe("Total");
      expect(chartData.datasets[0].data).toEqual([300, 200, 100]);
    });

    it("should handle multiple dimension groups", () => {
      // Create records with multiple dimension groups
      const records = [
        {
          date: "2025-09-01T00:00:00+05:30",
          category: "A",
          value: 100,
        },
        {
          date: "2025-10-01T00:00:00+05:30",
          category: "A",
          value: 150,
        },
        {
          date: "2025-09-01T00:00:00+05:30",
          category: "B",
          value: 200,
        },
        {
          date: "2025-10-01T00:00:00+05:30",
          category: "B",
          value: 250,
        },
      ];

      const fieldTypes = classifyFields(records);
      const dateFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "date_field",
      );
      const costFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "cost_or_bill_values",
      );
      const dimensionFields = Object.keys(fieldTypes).filter(
        (f) => fieldTypes[f] === "dimension",
      );

      const chartData = prepareLineChartData(
        records,
        dateFields[0],
        costFields,
        dimensionFields,
      );

      // Should have 2 datasets (one per dimension group: A and B)
      expect(chartData.datasets).toHaveLength(2);
      expect(chartData.datasets[0].label).toBe("A");
      expect(chartData.datasets[0].data).toEqual([100, 150]);
      expect(chartData.datasets[1].label).toBe("B");
      expect(chartData.datasets[1].data).toEqual([200, 250]);
      expect(chartData.labels).toHaveLength(2);
    });
  });
});
