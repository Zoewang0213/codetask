/**
 * T3: 优化的网络可视化
 * 使用 Hierarchical Edge Bundling 和 Radial Layout
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  name: string;
  paper_count: number;
  h_index: number;
  group?: number;
}

interface Link {
  source: string;
  target: string;
  weight: number;
}

interface NetworkData {
  nodes: Node[];
  links: Link[];
}

interface Props {
  width?: number;
  height?: number;
  networkType?: 'citation' | 'collaboration';
}

const NetworkOptimized: React.FC<Props> = ({
  width = 800,
  height = 800,
  networkType = 'collaboration'
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bundlingStrength, setBundlingStrength] = useState(0.85);

  useEffect(() => {
    const url = networkType === 'citation'
      ? 'http://localhost:5000/api/citation-network?max_nodes=100'
      : 'http://localhost:5000/api/collaboration-network?max_authors=100';

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [networkType]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = Math.min(width, height) / 2 - 100;
    const innerRadius = radius - 80;

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // 将节点按照连接数分组排序
    const nodeConnections: Map<string, number> = new Map();
    data.links.forEach(link => {
      nodeConnections.set(link.source, (nodeConnections.get(link.source) || 0) + 1);
      nodeConnections.set(link.target, (nodeConnections.get(link.target) || 0) + 1);
    });

    const sortedNodes = [...data.nodes].sort((a, b) =>
      (nodeConnections.get(b.id) || 0) - (nodeConnections.get(a.id) || 0)
    );

    // 创建节点位置映射（radial layout）
    const nodePositions: Map<string, { x: number; y: number; angle: number }> = new Map();
    sortedNodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / sortedNodes.length - Math.PI / 2;
      nodePositions.set(node.id, {
        x: innerRadius * Math.cos(angle),
        y: innerRadius * Math.sin(angle),
        angle: angle
      });
    });

    // 颜色比例尺
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([0, d3.max(sortedNodes, d => d.h_index || d.paper_count) || 50]);

    // 创建边的路径生成器（带弯曲）
    const line = d3.line<{ x: number; y: number }>()
      .curve(d3.curveBundle.beta(bundlingStrength))
      .x(d => d.x)
      .y(d => d.y);

    // 绘制边
    const linkGroup = g.append('g').attr('class', 'links');

    data.links.forEach(link => {
      const source = nodePositions.get(link.source);
      const target = nodePositions.get(link.target);
      if (!source || !target) return;

      // 通过中心点创建弯曲路径
      const midX = (source.x + target.x) / 2 * (1 - bundlingStrength);
      const midY = (source.y + target.y) / 2 * (1 - bundlingStrength);

      const pathData = [
        { x: source.x, y: source.y },
        { x: midX, y: midY },
        { x: target.x, y: target.y }
      ];

      linkGroup.append('path')
        .attr('d', line(pathData))
        .attr('fill', 'none')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.3)
        .attr('stroke-width', Math.max(1, Math.min(link.weight / 2, 3)));
    });

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .style('position', 'absolute')
      .style('background', 'rgba(0,0,0,0.85)')
      .style('color', 'white')
      .style('padding', '10px 14px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    // 绘制节点
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const nodeScale = d3.scaleSqrt()
      .domain([0, d3.max(sortedNodes, d => d.paper_count) || 50])
      .range([4, 15]);

    nodeGroup.selectAll('circle')
      .data(sortedNodes)
      .enter().append('circle')
      .attr('cx', d => nodePositions.get(d.id)?.x || 0)
      .attr('cy', d => nodePositions.get(d.id)?.y || 0)
      .attr('r', d => nodeScale(d.paper_count))
      .attr('fill', d => colorScale(d.h_index || d.paper_count))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        tooltip
          .style('opacity', 1)
          .html(`
            <strong>${d.name || 'Node ' + d.id}</strong><br/>
            <strong>Papers:</strong> ${d.paper_count}<br/>
            <strong>H-Index:</strong> ${(d.h_index || 0).toFixed(1)}<br/>
            <strong>Connections:</strong> ${nodeConnections.get(d.id) || 0}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');

        d3.select(event.target)
          .attr('stroke', '#ff6600')
          .attr('stroke-width', 3);

        // 高亮相关的边
        linkGroup.selectAll('path')
          .attr('stroke-opacity', 0.05);

        data.links.forEach((link, i) => {
          if (link.source === d.id || link.target === d.id) {
            linkGroup.selectAll('path')
              .filter((_, idx) => idx === i)
              .attr('stroke', '#ff6600')
              .attr('stroke-opacity', 0.8)
              .attr('stroke-width', 2);
          }
        });
      })
      .on('mouseout', (event) => {
        tooltip.style('opacity', 0);
        d3.select(event.target)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2);

        linkGroup.selectAll('path')
          .attr('stroke', '#999')
          .attr('stroke-opacity', 0.3)
          .attr('stroke-width', 1);
      });

    // 添加名称标签（只显示连接数最多的前15个）
    const topNodes = sortedNodes.slice(0, 15);

    nodeGroup.selectAll('text')
      .data(topNodes)
      .enter().append('text')
      .attr('x', d => {
        const pos = nodePositions.get(d.id);
        if (!pos) return 0;
        const offset = pos.angle > -Math.PI / 2 && pos.angle < Math.PI / 2 ? 20 : -20;
        return pos.x + offset;
      })
      .attr('y', d => nodePositions.get(d.id)?.y || 0)
      .attr('text-anchor', d => {
        const pos = nodePositions.get(d.id);
        if (!pos) return 'middle';
        return pos.angle > -Math.PI / 2 && pos.angle < Math.PI / 2 ? 'start' : 'end';
      })
      .attr('dy', '0.35em')
      .style('font-size', '10px')
      .style('fill', '#333')
      .text(d => d.name ? d.name.split(' ').slice(-1)[0] : '');

    return () => {
      tooltip.remove();
    };
  }, [data, width, height, bundlingStrength]);

  if (loading) return <div>Loading optimized network...</div>;

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
      <h3 style={{ margin: '10px', color: '#333' }}>
        Optimized Network (Radial Layout + Edge Bundling)
      </h3>
      <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label>Bundling Strength:</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={bundlingStrength}
          onChange={(e) => setBundlingStrength(parseFloat(e.target.value))}
          style={{ width: '200px' }}
        />
        <span>{bundlingStrength.toFixed(2)}</span>
      </div>
      <svg ref={svgRef} width={width} height={height} style={{ background: '#fafafa' }} />
      <div style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
        Radial layout with hierarchical edge bundling | Adjust slider to control bundling strength
      </div>
    </div>
  );
};

export default NetworkOptimized;
