/**
 * D3 Line Chart Component
 * Renders a line chart using D3.js with darker palette, arrows showing % change, clickable legend, and bottom legend
 */

import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

interface Dataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
}

interface D3LineChartProps {
  labels: string[];
  datasets: Dataset[];
  title?: string;
  width?: number;
  height?: number;
}

const D3LineChart: React.FC<D3LineChartProps> = ({
  labels,
  datasets,
  title = "Cost Trends Over Time",
  width = 800,
  height = 550,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hiddenDatasets, setHiddenDatasets] = useState<Set<string>>(new Set());

  // Darker color palette
  const darkerPalette = [
    "#1f77b4", // darker blue
    "#d62728", // darker red
    "#2ca02c", // darker green
    "#ff7f0e", // darker orange
    "#9467bd", // darker purple
    "#8c564b", // darker brown
    "#e377c2", // darker pink
    "#7f7f7f", // darker gray
    "#bcbd22", // darker olive
    "#17becf", // darker cyan
  ];

  useEffect(() => {
    if (!svgRef.current || !labels.length || !datasets.length) return;

    const margin = { top: 40, right: 30, bottom: 140, left: 80 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Filter visible datasets
    const visibleDatasets = datasets.filter(
      (d) => !hiddenDatasets.has(d.label),
    );

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background-color", "#f9fafb")
      .style("border-radius", "8px")
      .style("border", "1px solid #e5e7eb");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scalePoint().domain(labels).range([0, plotWidth]);

    const yMax = Math.max(
      ...visibleDatasets.map((dataset) => Math.max(...dataset.data)),
      0,
    );
    const y = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .range([plotHeight, 0]);

    // Create line generator
    const line = d3
      .line<number>()
      .x((d, i) => x(labels[i]) || 0)
      .y((d) => y(d));

    // Color scale using darker palette
    const color = d3
      .scaleOrdinal<string, string>()
      .domain(visibleDatasets.map((d) => d.label))
      .range(visibleDatasets.map((d, idx) => darkerPalette[idx % 10]));

    // Add grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1)
      .call(
        d3
          .axisLeft(y)
          .tickSize(-plotWidth)
          .tickFormat(() => ""),
      );

    // Render lines
    visibleDatasets.forEach((dataset) => {
      g.append("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", color(dataset.label))
        .attr("stroke-width", 2.5)
        .attr("d", line(dataset.data) || "");
    });

    // Add circles for data points
    visibleDatasets.forEach((dataset, idx) => {
      const sanitizedLabel = `points-${idx}`;
      g.selectAll(`.${sanitizedLabel}`)
        .data(dataset.data)
        .join("circle")
        .attr("class", sanitizedLabel)
        .attr("cx", (d, i) => x(labels[i]) || 0)
        .attr("cy", (d) => y(d))
        .attr("r", 4)
        .attr("fill", color(dataset.label))
        .attr("opacity", 0.7)
        .on("mouseover", function () {
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          d3.select(this).attr("r", 4).attr("opacity", 0.7);
        });
    });

    // Add arrows showing % change for each line
    visibleDatasets.forEach((dataset, datasetIdx) => {
      const firstValue = dataset.data[0];
      const lastValue = dataset.data[dataset.data.length - 1];

      if (
        firstValue !== undefined &&
        lastValue !== undefined &&
        firstValue > 0
      ) {
        const percentChange = ((lastValue - firstValue) / firstValue) * 100;

        const x1 = x(labels[0]) || 0;
        const x2 = x(labels[labels.length - 1]) || 0;
        const y1 = y(firstValue);
        const y2 = y(lastValue);

        // Arrow: 3 sides of rectangle bounded at bottom by the actual line
        // Top left point (3px above first data point)
        const topLeftY = y1 - 8;
        // Top right point (3px above last data point)
        const topRightY = y2 - 8;
        // Bottom points are on the actual line data
        const bottomLeftY = y1;
        const bottomRightY = y2;

        // Create path for arrow (3 sides: top, left, right - bottom is bounded by actual line)
        const arrowPath = `
          M ${x1} ${topLeftY}
          L ${x2} ${topRightY}
          L ${x2} ${bottomRightY}
          L ${x1} ${bottomLeftY}
          Z
        `;

        // Add arrow path (fill with transparency)
        g.append("path")
          .attr("d", arrowPath)
          .attr("fill", color(dataset.label))
          .attr("opacity", 0.15)
          .attr("stroke", color(dataset.label))
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "3,3");

        // Add arrow head at the end
        const arrowHeadSize = 6;
        g.append("polygon")
          .attr(
            "points",
            `${x2},${topRightY} ${x2 - arrowHeadSize},${topRightY - arrowHeadSize} ${x2 + arrowHeadSize},${topRightY - arrowHeadSize}`,
          )
          .attr("fill", color(dataset.label))
          .attr("opacity", 0.7);

        // Add percentage change annotation on the horizontal middle line of the arrow
        const textX = (x1 + x2) / 2;
        const textY = (topLeftY + topRightY) / 2 + 3; // Position text on the arrow line with slight offset down

        g.append("text")
          .attr("x", textX)
          .attr("y", textY)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .attr("fill", color(dataset.label))
          .attr("opacity", 0.9)
          .attr("pointer-events", "none")
          .text(`${percentChange > 0 ? "+" : ""}${percentChange.toFixed(1)}%`);
      }
    });

    // X axis
    const xAxis = d3.axisBottom(x);
    g.append("g")
      .attr("transform", `translate(0,${plotHeight})`)
      .call(xAxis)
      .append("text")
      .attr("x", plotWidth / 2)
      .attr("y", 50)
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("Date");

    // Y axis
    const yAxis = d3.axisLeft(y);
    g.append("g")
      .call(yAxis)
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - plotHeight / 2)
      .attr("dy", "1em")
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("Cost (EUR)");

    // Title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text(title);

    // Bottom legend (3-column layout)
    const legendItemWidth = plotWidth / 3;
    const legendGroup = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${margin.left}, ${height - 70})`);

    datasets.forEach((dataset, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const legendX = col * legendItemWidth;
      const legendY = row * 30;

      const isHidden = hiddenDatasets.has(dataset.label);
      const itemColor = isHidden ? "#d1d5db" : color(dataset.label);

      const legendItem = legendGroup
        .append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`)
        .style("cursor", "pointer")
        .on("click", function () {
          const newHidden = new Set(hiddenDatasets);
          if (newHidden.has(dataset.label)) {
            newHidden.delete(dataset.label);
          } else {
            newHidden.add(dataset.label);
          }
          setHiddenDatasets(newHidden);
        });

      // Line indicator
      legendItem
        .append("line")
        .attr("x1", 0)
        .attr("x2", 12)
        .attr("y1", 5)
        .attr("y2", 5)
        .attr("stroke", itemColor)
        .attr("stroke-width", 2.5);

      // Circle indicator
      legendItem
        .append("circle")
        .attr("cx", 6)
        .attr("cy", 5)
        .attr("r", 2.5)
        .attr("fill", itemColor);

      // Label
      legendItem
        .append("text")
        .attr("x", 18)
        .attr("y", 9)
        .attr("font-size", "12px")
        .attr("font-family", "sans-serif")
        .attr("fill", itemColor)
        .text(dataset.label);
    });
  }, [labels, datasets, title, width, height, hiddenDatasets]);

  return <svg ref={svgRef} />;
};

export default D3LineChart;
