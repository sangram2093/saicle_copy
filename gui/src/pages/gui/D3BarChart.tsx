/**
 * D3 Bar Chart Component
 * Renders a bar chart using D3.js
 */

import * as d3 from "d3";
import React, { useEffect, useRef } from "react";

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

    // Prepare data structure for grouped bars
    const groupedData = labels.map((label, i) => {
      const obj: any = { category: label };
      datasets.forEach((dataset) => {
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
      .domain(datasets.map((d) => d.label))
      .range([0, x0.bandwidth()])
      .padding(0.05);

    const yMax = Math.max(
      ...datasets.map((dataset) => Math.max(...dataset.data)),
    );
    const y = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .range([plotHeight, 0]);

    // Color scale
    const color = d3
      .scaleOrdinal()
      .domain(datasets.map((d) => d.label))
      .range(
        datasets.map((d) => {
          const bgColor = d.backgroundColor;
          return typeof bgColor === "string" ? bgColor : bgColor[0];
        }),
      );

    // Render bars
    g.selectAll("g.layer")
      .data(datasets)
      .join("g")
      .attr("class", "layer")
      .attr("fill", (d) => color(d.label) as string)
      .selectAll("rect")
      .data((d) => d.data.map((value, i) => ({ value, categoryIndex: i })))
      .join("rect")
      .attr("x", (d) => {
        const datasetIndex = datasets.findIndex((ds) =>
          ds.data.includes((d.value as number) + 0),
        );
        return (
          x0(labels[d.categoryIndex])! +
          x1(datasets[datasetIndex >= 0 ? datasetIndex : 0].label)!
        );
      })
      .attr("y", (d) => y(d.value as number))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => plotHeight - y(d.value as number))
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
      .append("rect")
      .attr("x", -19)
      .attr("width", 19)
      .attr("height", 19)
      .attr("fill", (d) => {
        const bgColor = d.backgroundColor;
        return typeof bgColor === "string" ? bgColor : bgColor[0];
      });

    legend
      .append("text")
      .attr("x", -24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text((d) => d.label);
  }, [labels, datasets, title, width, height]);

  return <svg ref={svgRef} />;
};

export default D3BarChart;
