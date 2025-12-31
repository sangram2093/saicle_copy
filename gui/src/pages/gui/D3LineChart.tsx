/**
 * D3 Line Chart Component
 * Renders a line chart using D3.js
 */

import * as d3 from "d3";
import React, { useEffect, useRef } from "react";

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
  height = 500,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !labels.length || !datasets.length) return;

    const margin = { top: 40, right: 30, bottom: 60, left: 80 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

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
      ...datasets.map((dataset) => Math.max(...dataset.data)),
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

    // Color scale
    const color = d3
      .scaleOrdinal()
      .domain(datasets.map((d) => d.label))
      .range(
        datasets
          .map((d) => d.borderColor || "steelblue")
          .slice(0, datasets.length),
      );

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
    const linePaths = g
      .selectAll(".line")
      .data(datasets)
      .join("path")
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke", (d) => color(d.label) as string)
      .attr("stroke-width", 2.5)
      .attr("d", (d) => line(d.data) || "");

    // Add circles for data points
    datasets.forEach((dataset, datasetIdx) => {
      g.selectAll(`.points-${datasetIdx}`)
        .data(dataset.data)
        .join("circle")
        .attr("class", `points-${datasetIdx}`)
        .attr("cx", (d, i) => x(labels[i]) || 0)
        .attr("cy", (d) => y(d))
        .attr("r", 4)
        .attr("fill", color(dataset.label) as string)
        .attr("opacity", 0.7)
        .on("mouseover", function () {
          d3.select(this).attr("r", 6).attr("opacity", 1);
        })
        .on("mouseout", function () {
          d3.select(this).attr("r", 4).attr("opacity", 0.7);
        });
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

    // Legend
    const legend = svg
      .append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 12)
      .attr("text-anchor", "end")
      .selectAll("g")
      .data(datasets)
      .join("g")
      .attr("transform", (d, i) => `translate(${width - 20},${20 + i * 20})`);

    legend
      .append("line")
      .attr("x1", -19)
      .attr("x2", -5)
      .attr("y1", 9.5)
      .attr("y2", 9.5)
      .attr("stroke", (d) => color(d.label) as string)
      .attr("stroke-width", 2.5);

    legend
      .append("circle")
      .attr("cx", -12)
      .attr("cy", 9.5)
      .attr("r", 3)
      .attr("fill", (d) => color(d.label) as string);

    legend
      .append("text")
      .attr("x", -24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text((d) => d.label);
  }, [labels, datasets, title, width, height]);

  return <svg ref={svgRef} />;
};

export default D3LineChart;
