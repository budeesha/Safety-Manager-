import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { FishboneData } from '../types';

interface FishboneProps {
  data: FishboneData;
}

export default function FishboneDiagram({ data }: FishboneProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 400;
    
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const centerX = 150;
    const endX = width - 50;
    const centerY = height / 2;

    // Center spine
    svg.append("line")
      .attr("x1", centerX)
      .attr("y1", centerY)
      .attr("x2", endX)
      .attr("y2", centerY)
      .attr("stroke", "#30363d")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)");

    // Arrowhead
    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", "5")
      .attr("refY", "5")
      .attr("markerWidth", "6")
      .attr("markerHeight", "6")
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "#30363d");

    const topCategories = [
      { name: "Man", items: data.Man, x: 250 },
      { name: "Machine", items: data.Machine, x: 450 },
      { name: "Material", items: data.Material, x: 650 },
    ];

    const bottomCategories = [
      { name: "Method", items: data.Method, x: 250 },
      { name: "Measurement", items: data.Measurement, x: 450 },
      { name: "Environment", items: data.Environment, x: 650 },
    ];

    const drawBranch = (category: any, isTop: boolean) => {
      const startY = isTop ? 50 : height - 50;
      const startX = category.x - 50;

      // Draw main branch
      svg.append("line")
        .attr("x1", startX)
        .attr("y1", startY)
        .attr("x2", category.x)
        .attr("y2", centerY)
        .attr("stroke", "#30363d")
        .attr("stroke-width", 2);

      // Category box
      const boxWidth = 100;
      const boxHeight = 30;
      
      const gBox = svg.append("g")
        .attr("transform", `translate(${startX - boxWidth/2}, ${startY - (isTop ? boxHeight : 0)})`);
        
      gBox.append("rect")
        .attr("width", boxWidth)
        .attr("height", boxHeight)
        .attr("fill", "#05070a")
        .attr("stroke", "#30363d")
        .attr("rx", 4);
        
      gBox.append("text")
        .attr("x", boxWidth / 2)
        .attr("y", boxHeight / 2 + 5)
        .attr("text-anchor", "middle")
        .attr("fill", "#8b949e")
        .attr("font-family", "sans-serif")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .text(category.name?.toUpperCase());

      // Draw items
      category.items.forEach((item: string, i: number) => {
        // Space items evenly along the branch
        const fraction = (i + 1) / (category.items.length + 1);
        const itemX = startX + (category.x - startX) * fraction;
        const itemY = startY + (centerY - startY) * fraction;

        const lineLen = 30;
        svg.append("line")
          .attr("x1", itemX)
          .attr("y1", itemY)
          .attr("x2", itemX - lineLen)
          .attr("y2", itemY)
          .attr("stroke", "#30363d")
          .attr("stroke-width", 1);

        svg.append("text")
          .attr("x", itemX - lineLen - 5)
          .attr("y", itemY + 4)
          .attr("text-anchor", "end")
          .attr("font-size", "10px")
          .attr("font-family", "sans-serif")
          .attr("fill", "#f0f6fc")
          .text(item.length > 25 ? item.substring(0, 25) + '...' : item);
      });
    };

    topCategories.forEach(c => drawBranch(c, true));
    bottomCategories.forEach(c => drawBranch(c, false));

    // Draw the "Problem" head
    svg.append("text")
      .attr("x", endX + 15)
      .attr("y", centerY + 4)
      .attr("text-anchor", "start")
      .attr("fill", "#ff6b00")
      .attr("font-family", "sans-serif")
      .attr("font-weight", "bold")
      .attr("font-size", "12px")
      .text("FAILURE");

  }, [data]);

  return (
    <div className="w-full overflow-x-auto bg-[#05070a] border border-[#30363d] rounded p-2">
      <svg ref={svgRef} className="w-full min-w-[800px] h-auto" />
    </div>
  );
}
