import { useState, useRef, useLayoutEffect } from "react";
import * as d3 from "d3";
import { Link } from "react-router";
import type { TechStackData, TechNode } from "~/lib/techstack.server";

export function TechStackGraph({ data }: { data: TechStackData }) {
  const [selected, setSelected] = useState<TechNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const svgEl = svgRef.current;
    const container = containerRef.current;
    if (!svgEl || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    d3.select(svgEl).selectAll("*").remove();
    const svg = d3.select(svgEl).attr("width", width).attr("height", height);

    const simulation = d3
      .forceSimulation(data.nodes as unknown as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(data.links as unknown as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
          .id((d: d3.SimulationNodeDatum) => (d as unknown as TechNode).id)
          .distance((d: d3.SimulationLinkDatum<d3.SimulationNodeDatum>) =>
            100 / Math.sqrt((d as unknown as { strength: number }).strength || 1),
          ),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3
          .forceCollide()
          .radius(
            (d: d3.SimulationNodeDatum) =>
              Math.sqrt((d as unknown as TechNode).count) * 15 + 10,
          ),
      );

    const g = svg.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const link = g
      .append("g")
      .selectAll("line")
      .data(data.links)
      .enter()
      .append("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d) => Math.sqrt(d.strength) * 2);

    const maxCount = Math.max(1, ...data.nodes.map((n) => n.count));
    const fillFor = (count: number) => {
      const intensity = count / maxCount;
      if (intensity < 0.2) return "#e9d5ff";
      if (intensity < 0.4) return "#c084fc";
      if (intensity < 0.6) return "#9333ea";
      if (intensity < 0.8) return "#7c3aed";
      return "#5b21b6";
    };

    const node = g
      .append("g")
      .selectAll<SVGGElement, TechNode>("g")
      .data(data.nodes)
      .enter()
      .append("g")
      .style("cursor", "pointer")
      .on("click", (_event, d) => setSelected(d));

    node
      .append("circle")
      .attr("r", (d) => Math.sqrt(d.count) * 10 + 5)
      .attr("fill", (d) => fillFor(d.count))
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 2);

    node
      .append("text")
      .text((d) => d.label)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("fill", "#fff")
      .style("font-size", (d) => Math.min(Math.sqrt(d.count) * 5 + 10, 20) + "px")
      .style("font-weight", "bold")
      .style("pointer-events", "none")
      .style("text-shadow", "0 0 3px rgba(0,0,0,0.8)");

    const drag = d3
      .drag<SVGGElement, TechNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        (d as unknown as d3.SimulationNodeDatum).fx = (d as unknown as d3.SimulationNodeDatum).x;
        (d as unknown as d3.SimulationNodeDatum).fy = (d as unknown as d3.SimulationNodeDatum).y;
      })
      .on("drag", (event, d) => {
        (d as unknown as d3.SimulationNodeDatum).fx = event.x;
        (d as unknown as d3.SimulationNodeDatum).fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        (d as unknown as d3.SimulationNodeDatum).fx = null;
        (d as unknown as d3.SimulationNodeDatum).fy = null;
      });
    node.call(drag);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as unknown as d3.SimulationNodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as unknown as d3.SimulationNodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as unknown as d3.SimulationNodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as unknown as d3.SimulationNodeDatum).y ?? 0);
      node.attr(
        "transform",
        (d) =>
          `translate(${(d as unknown as d3.SimulationNodeDatum).x ?? 0},${(d as unknown as d3.SimulationNodeDatum).y ?? 0})`,
      );
    });

    return () => {
      simulation.stop();
    };
  }, [data]);

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      <div
        ref={containerRef}
        className="flex-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden"
      >
        <svg ref={svgRef}></svg>
      </div>
      <div className="w-96 shrink-0 overflow-y-auto rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
        {selected ? (
          <div>
            <h2 className="text-xl font-semibold capitalize text-gray-900 dark:text-white mb-2">
              {selected.label}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Referenced in {selected.count} source
              {selected.count === 1 ? "" : "s"}
            </p>

            {selected.companies.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Companies
                </h3>
                <div className="space-y-1.5 mb-4">
                  {selected.companies.map((c) => (
                    <Link
                      key={c.id}
                      to={`/companies/${c.id}`}
                      className="block rounded bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </>
            )}

            {selected.skills.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Skill presets
                </h3>
                <div className="space-y-1.5 mb-4">
                  {selected.skills.map((s) => (
                    <div
                      key={s.id}
                      className="rounded bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <span className="font-medium">{s.category}</span>{" "}
                      <span className="text-gray-500">/ {s.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Often used with
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.links
                .filter((l) => l.source === selected.id || l.target === selected.id)
                .sort((a, b) => b.strength - a.strength)
                .slice(0, 10)
                .map((l, i) => {
                  const rel = l.source === selected.id ? l.target : l.source;
                  const node = data.nodes.find((n) => n.id === rel);
                  if (!node) return null;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelected(node)}
                      className="rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-3 py-1 text-xs hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      {node.label}
                    </button>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400 text-sm space-y-3">
            <p className="font-medium text-gray-700 dark:text-gray-300">
              Click a node to explore
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Click to see sources</li>
              <li>Drag to rearrange</li>
              <li>Scroll to zoom</li>
              <li>Drag background to pan</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
