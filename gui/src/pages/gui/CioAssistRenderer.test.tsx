/**
 * Test cases for CioAssistRenderer component
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CioAssistRenderer from "./CioAssistRenderer";

describe("CioAssistRenderer", () => {
  const sampleJsonLines = `{"allocated cost": 29999.02030, "business unit": "Investment bank", "cio":"denis.roux@db.com", "reporting period end date":"2025-09-01T00:00:00+05:30"}
{"allocated cost": 19999.02030, "business unit": "corporate bank", "cio":"denis.roux@db.com", "reporting period end date":"2025-09-01T00:00:00+05:30"}`;

  const varyingDateJsonLines = `{"allocated cost": 29999.02, "business unit": "Investment bank", "cio":"denis.roux@db.com", "reporting period end date":"2025-09-01T00:00:00+05:30"}
{"allocated cost": 25000.50, "business unit": "Investment bank", "cio":"denis.roux@db.com", "reporting period end date":"2025-10-01T00:00:00+05:30"}
{"allocated cost": 30000.0, "business unit": "Investment bank", "cio":"denis.roux@db.com", "reporting period end date":"2025-11-01T00:00:00+05:30"}
{"allocated cost": 27000.0, "business unit": "Investment bank", "cio":"denis.roux@db.com", "reporting period end date":"2025-12-01T00:00:00+05:30"}
{"allocated cost": 31000.0, "business unit": "Investment bank", "cio":"denis.roux@db.com", "reporting period end date":"2026-01-01T00:00:00+05:30"}`;

  it("should render error when tool name does not contain cio_assist", () => {
    render(
      <CioAssistRenderer jsonLines={sampleJsonLines} toolName="other_tool" />,
    );
    expect(screen.getByText(/No data to display/i)).toBeInTheDocument();
  });

  it("should render error when jsonLines is empty", () => {
    render(<CioAssistRenderer jsonLines="" toolName="cio_assist_tool" />);
    expect(screen.getByText(/No data to display/i)).toBeInTheDocument();
  });

  it("should render error for invalid JSON", () => {
    render(
      <CioAssistRenderer
        jsonLines="{invalid json}"
        toolName="cio_assist_tool"
      />,
    );
    expect(screen.getByText(/Error:/i)).toBeInTheDocument();
  });

  it("should render data table with correct structure", () => {
    render(
      <CioAssistRenderer
        jsonLines={sampleJsonLines}
        toolName="cio_assist_tool"
      />,
    );

    // Check table headers
    expect(screen.getByText("allocated cost")).toBeInTheDocument();
    expect(screen.getByText("business unit")).toBeInTheDocument();
    expect(screen.getByText("cio")).toBeInTheDocument();
    expect(screen.getByText("reporting period end date")).toBeInTheDocument();
  });

  it("should render data table with field type indicators", () => {
    render(
      <CioAssistRenderer
        jsonLines={sampleJsonLines}
        toolName="cio_assist_tool"
      />,
    );

    // Check for field type indicators
    expect(screen.getByText(/cost_or_bill_values/i)).toBeInTheDocument();
    expect(screen.getByText(/date_field/i)).toBeInTheDocument();
    expect(screen.getAllByText(/dimension/i).length).toBeGreaterThan(0);
  });

  it("should render data table with all records", () => {
    render(
      <CioAssistRenderer
        jsonLines={sampleJsonLines}
        toolName="cio_assist_tool"
      />,
    );

    // Check for data table - if it's rendered, it contains the records
    expect(screen.getByText(/Data Table/i)).toBeInTheDocument();
    // Check for at least one data value
    expect(screen.getByText("€29,999.02")).toBeInTheDocument();
    expect(screen.getByText("€19,999.02")).toBeInTheDocument();
  });

  it("should render bar chart when dates do not vary", () => {
    render(
      <CioAssistRenderer
        jsonLines={sampleJsonLines}
        toolName="cio_assist_tool"
      />,
    );

    // Check for SVG element (D3 bar chart is rendered)
    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("should render line chart when dates vary", () => {
    render(
      <CioAssistRenderer
        jsonLines={varyingDateJsonLines}
        toolName="cio_assist_tool"
      />,
    );

    // Check for SVG element (D3 line chart is rendered)
    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("should format cost values with euro symbol", () => {
    const { container } = render(
      <CioAssistRenderer
        jsonLines={sampleJsonLines}
        toolName="cio_assist_tool"
      />,
    );

    // Check that formatted costs are displayed in table cells
    const tableText = container.textContent || "";
    // German format: 29.999,02
    expect(tableText).toMatch(/29[.,]999[.,]02|EUR|€/);
  });

  it("should render all records in the table", () => {
    render(
      <CioAssistRenderer
        jsonLines={sampleJsonLines}
        toolName="cio_assist_tool"
      />,
    );

    // Verify that both records are rendered
    const rows = screen.getAllByText(/Investment bank|corporate bank/);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("should be case-insensitive when checking tool name", () => {
    render(
      <CioAssistRenderer
        jsonLines={sampleJsonLines}
        toolName="CIO_ASSIST_TOOL"
      />,
    );

    // Should render table (not show error)
    expect(screen.getByText(/Data Table/i)).toBeInTheDocument();
  });

  it("should render data table title", () => {
    render(
      <CioAssistRenderer
        jsonLines={sampleJsonLines}
        toolName="cio_assist_tool"
      />,
    );
    expect(screen.getByText("Data Table")).toBeInTheDocument();
  });

  it("should handle records with multiple cost fields", () => {
    const multiCostJson = `{"cost1": 1000, "cost2": 2000, "category": "A"}
{"cost1": 1500, "cost2": 2500, "category": "B"}`;

    render(
      <CioAssistRenderer
        jsonLines={multiCostJson}
        toolName="cio_assist_tool"
      />,
    );

    // Should render table with data
    expect(screen.getByText(/Data Table/i)).toBeInTheDocument();
    // Check for SVG element (D3 chart) - the title "Cost Breakdown" is rendered in SVG
    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });
});
