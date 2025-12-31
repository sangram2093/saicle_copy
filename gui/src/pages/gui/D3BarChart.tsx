/**
 * D3 Bar Chart Component
 * Renders a bar chart using D3.js with darker palette, clickable legend, and bottom legend
 */

import * as d3 from "d3";
import React, { useEffect, useRef, useState } from "react";

interface Dataset {
  label: string;
  data: number[];
  backgroundColor: string | string[];
}

interface D3BarChartProps {
  labels: string[];
  datasets: Dataset[];
  title?: string;
  width?: number;
  height?: number;
}

const D3BarChart: React.FC<D3BarChartProps> = ({
  labels,
  datasets,
  title = "Cost by Category",
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

    if (visibleDatasets.length === 0) {
      // If all datasets are hidden, show SVG only
      d3.select(svgRef.current)
        .attr("width", width)
        .attr("height", height)
        .style("background-color", "#f9fafb")
        .style("border-radius", "8px")
        .style("border", "1px solid #e5e7eb");
      return;
    }

    // Prepare data structure for grouped bars
    const groupedData = labels.map((label, i) => {
      const obj: any = { category: label };
      visibleDatasets.forEach((dataset) => {
        obj[dataset.label] = dataset.data[i] || 0;
      });
      return obj;
    });

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
    const x0 = d3.scaleBand().domain(labels).range([0, plotWidth]).padding(0.1);

    const x1 = d3
      .scaleBand()
      .domain(visibleDatasets.map((d) => d.label))
      .range([0, x0.bandwidth()])
      .padding(0.05);

    const yMax = Math.max(
      ...visibleDatasets.map((dataset) => Math.max(...dataset.data)),
    );
    const y = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .range([plotHeight, 0]);

    // Color scale with darker palette
    const color = d3
      .scaleOrdinal()
      .domain(visibleDatasets.map((d) => d.label))
      .range(
        visibleDatasets.map(
          (d, idx) => darkerPalette[idx % darkerPalette.length],
        ),
      );

    // Render bars with grouped layout
    g.selectAll("g.group")
      .data(groupedData)
      .join("g")
      .attr("class", "group")
      .attr("transform", (d) => `translate(${x0(d.category)},0)`)
      .selectAll("rect")
      .data((d) =>
        visibleDatasets.map((dataset) => ({
          label: dataset.label,
          value: d[dataset.label],
        })),
      )
      .join("rect")
      .attr("x", (d) => x1(d.label) || 0)
      .attr("y", (d) => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => plotHeight - y(d.value))
      .attr("fill", (d) => color(d.label) as string)
      .attr("opacity", 0.8)
      .on("mouseover", function () {
        d3.select(this).attr("opacity", 1);
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.8);
      });

    // X axis
    const xAxis = d3.axisBottom(x0);
    g.append("g")
      .attr("transform", `translate(0,${plotHeight})`)
      .call(xAxis)
      .append("text")
      .attr("x", plotWidth / 2)
      .attr("y", 50)
      .attr("fill", "black")
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("Category");

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

    // Legend at bottom in 3-column horizontal layout
    const legendItemsPerRow = 3;
    const legendItemWidth = plotWidth / legendItemsPerRow;
    const legendGroup = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${margin.left},${height - 70})`);

    datasets.forEach((dataset, i) => {
      const row = Math.floor(i / legendItemsPerRow);
      const col = i % legendItemsPerRow;
      const legendX = col * legendItemWidth;
      const legendY = row * 30;

      const legendItem = legendGroup
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", `translate(${legendX},${legendY})`)
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

      const isHidden = hiddenDatasets.has(dataset.label);
      const itemColor = isHidden
        ? "#d1d5db"
        : darkerPalette[i % darkerPalette.length];

      legendItem
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", itemColor);

      legendItem
        .append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", "0.32em")
        .attr("fill", itemColor)
        .style("font-size", "12px")
        .text(dataset.label);
    });
  }, [labels, datasets, title, width, height, hiddenDatasets]);

  return <svg ref={svgRef} />;
};

export default D3BarChart;
