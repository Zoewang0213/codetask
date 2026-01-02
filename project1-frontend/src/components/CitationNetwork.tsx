/**
 * T1: 引用网络可视化组件
 * D3.js force-directed layout
 * 支持拖拽、缩放、hover 显示 tooltip
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  year: number | null;
  cited_by_count: number;
  patent_count: number;
  title: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  cluster?: number;
}

// Simple clustering using connected components with BFS
function detectClusters(nodes: Node[], links: Link[]): { nodeCluster: Map<string, number>; clusterStats: { id: number; count: number; percentage: number }[] } {
  const nodeMap = new Map<string, Node>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // Build adjacency list
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach(n => adjacency.set(n.id, new Set()));

  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    adjacency.get(sourceId)?.add(targetId);
    adjacency.get(targetId)?.add(sourceId);
  });

  const visited = new Set<string>();
  const nodeCluster = new Map<string, number>();
  let clusterCount = 0;
  const clusterSizes: number[] = [];

  // BFS to find connected components
  nodes.forEach(node => {
    if (visited.has(node.id)) return;

    const queue = [node.id];
    let componentSize = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      nodeCluster.set(current, clusterCount);
      componentSize++;

      adjacency.get(current)?.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }

    clusterSizes.push(componentSize);
    clusterCount++;
  });

  // Calculate percentages and sort by size
  const clusterStats = clusterSizes
    .map((count, id) => ({
      id,
      count,
      percentage: (count / nodes.length) * 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Top 8 clusters for legend

  return { nodeCluster, clusterStats };
}

interface Link {
  source: string | Node;
  target: string | Node;
}

interface NetworkData {
  nodes: Node[];
  links: Link[];
}

interface Props {
  width?: number;
  height?: number;
}

const CitationNetwork: React.FC<Props> = ({ width = 800, height = 600 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取数据
  useEffect(() => {
    fetch('http://localhost:5000/api/citation-network?max_nodes=200')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 绑定 D3 可视化
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 创建缩放容器
    const g = svg.append('g');

    // 缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // 节点大小比例尺
    const nodeScale = d3.scaleSqrt()
      .domain([0, d3.max(data.nodes, d => d.cited_by_count) || 100])
      .range([4, 20]);

    // Detect clusters
    const { nodeCluster, clusterStats } = detectClusters(data.nodes, data.links);

    // Assign cluster to each node
    data.nodes.forEach(node => {
      node.cluster = nodeCluster.get(node.id) || 0;
    });

    // Cluster colors (similar to PDF example)
    const clusterColors = [
      '#e41a1c', '#377eb8', '#4daf4a', '#984ea3',
      '#ff7f00', '#ffff33', '#a65628', '#f781bf',
      '#999999', '#66c2a5', '#fc8d62', '#8da0cb'
    ];

    // Map original cluster IDs to sorted indices for coloring
    const clusterIdToIndex = new Map<number, number>();
    clusterStats.forEach((stat, index) => {
      clusterIdToIndex.set(stat.id, index);
    });

    const getClusterColor = (clusterId: number) => {
      const index = clusterIdToIndex.get(clusterId);
      if (index !== undefined && index < clusterColors.length) {
        return clusterColors[index];
      }
      return '#999999';
    };

    // 添加图例
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - 160}, 20)`);

    // Modularity Class 图例
    legend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Modularity Class');

    clusterStats.forEach((stat, i) => {
      legend.append('rect')
        .attr('x', 0)
        .attr('y', 15 + i * 20)
        .attr('width', 14)
        .attr('height', 14)
        .attr('fill', clusterColors[i] || '#999');

      legend.append('text')
        .attr('x', 20)
        .attr('y', 26 + i * 20)
        .style('font-size', '11px')
        .text(`Cluster ${i + 1} (${stat.percentage.toFixed(1)}%)`);
    });

    // 节点大小图例
    const sizeY = 20 + clusterStats.length * 20 + 20;
    legend.append('text')
      .attr('x', 0)
      .attr('y', sizeY)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Citations');

    const sizes = [10, 100, 500];
    sizes.forEach((size, i) => {
      const r = nodeScale(size);
      legend.append('circle')
        .attr('cx', 10)
        .attr('cy', sizeY + 25 + i * 25)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', '#666');

      legend.append('text')
        .attr('x', 25)
        .attr('y', sizeY + 29 + i * 25)
        .style('font-size', '11px')
        .text(size.toString());
    });

    // 创建力导向模拟
    const simulation = d3.forceSimulation<Node>(data.nodes)
      .force('link', d3.forceLink<Node, Link>(data.links)
        .id(d => d.id)
        .distance(50))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<Node>().radius(d => nodeScale(d.cited_by_count) + 2));

    // 创建 tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0,0,0,0.8)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    // 绘制边
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1);

    // 绘制节点
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(data.nodes)
      .enter().append('circle')
      .attr('r', d => nodeScale(d.cited_by_count))
      .attr('fill', d => getClusterColor(d.cluster || 0))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'grab')
      .on('mouseover', (event, d) => {
        const clusterIndex = clusterIdToIndex.get(d.cluster || 0);
        tooltip
          .style('opacity', 1)
          .html(`
            <strong>Paper ID:</strong> ${d.id}<br/>
            <strong>Year:</strong> ${d.year || 'N/A'}<br/>
            <strong>Citations:</strong> ${d.cited_by_count}<br/>
            <strong>Patents:</strong> ${d.patent_count}<br/>
            <strong>Cluster:</strong> ${clusterIndex !== undefined ? clusterIndex + 1 : 'N/A'}<br/>
            ${d.title ? `<strong>Title:</strong> ${d.title}` : ''}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');

        // 高亮节点
        d3.select(event.target).attr('stroke', '#ff6600').attr('stroke-width', 3);
      })
      .on('mouseout', (event) => {
        tooltip.style('opacity', 0);
        d3.select(event.target).attr('stroke', '#fff').attr('stroke-width', 1.5);
      })
      .call(d3.drag<SVGCircleElement, Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // 更新位置
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as Node).x || 0)
        .attr('y1', d => (d.source as Node).y || 0)
        .attr('x2', d => (d.target as Node).x || 0)
        .attr('y2', d => (d.target as Node).y || 0);

      node
        .attr('cx', d => d.x || 0)
        .attr('cy', d => d.y || 0);
    });

    // 清理
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [data, width, height]);

  if (loading) return <div>Loading citation network...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
      <h3 style={{ margin: '10px', color: '#333' }}>Paper Citation Network - UMD Computer Science (2019-2024)</h3>
      <svg ref={svgRef} width={width} height={height} style={{ background: '#fafafa' }} />
      <div style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
        <strong>Interaction:</strong> Drag nodes to explore | Scroll to zoom | Hover for details
      </div>
      <div style={{ padding: '10px', fontSize: '11px', color: '#888', background: '#f5f5f5', borderTop: '1px solid #eee' }}>
        <strong>Scalability Solution:</strong> To handle the large dataset (87,738 papers, 126,892 citations),
        we filter to show only the top {data?.nodes.length || 200} most-cited papers from the past 5 years.
        This reduces visual clutter while preserving the most important citation relationships.
        The force-directed layout uses collision detection to prevent node overlap.
      </div>
    </div>
  );
};

export default CitationNetwork;
