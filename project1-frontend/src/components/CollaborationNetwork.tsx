/**
 * T1: 作者合作网络可视化组件
 * D3.js force-directed layout
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface AuthorNode {
  id: string;
  name: string;
  paper_count: number;
  h_index: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  cluster?: number;
}

// Simple clustering using connected components with BFS
function detectClusters(nodes: AuthorNode[], links: CollabLink[]): { nodeCluster: Map<string, number>; clusterStats: { id: number; count: number; percentage: number }[] } {
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

  const clusterStats = clusterSizes
    .map((count, id) => ({
      id,
      count,
      percentage: (count / nodes.length) * 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return { nodeCluster, clusterStats };
}

interface CollabLink {
  source: string | AuthorNode;
  target: string | AuthorNode;
  weight: number;
}

interface NetworkData {
  nodes: AuthorNode[];
  links: CollabLink[];
}

interface Props {
  width?: number;
  height?: number;
}

const CollaborationNetwork: React.FC<Props> = ({ width = 800, height = 600 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/collaboration-network?max_authors=150')
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

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // 缩放
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // 节点大小（论文数量）
    const nodeScale = d3.scaleSqrt()
      .domain([0, d3.max(data.nodes, d => d.paper_count) || 50])
      .range([5, 25]);

    // 边宽度（合作次数）
    const linkScale = d3.scaleLinear()
      .domain([1, d3.max(data.links, d => d.weight) || 10])
      .range([1, 5]);

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
      .attr('transform', `translate(${width - 170}, 20)`);

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
      .text('Papers');

    const paperSizes = [5, 20, 50];
    paperSizes.forEach((size, i) => {
      const r = nodeScale(size);
      legend.append('circle')
        .attr('cx', 10)
        .attr('cy', sizeY + 25 + i * 25)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', '#666');

      legend.append('text')
        .attr('x', 28)
        .attr('y', sizeY + 29 + i * 25)
        .style('font-size', '10px')
        .text(size.toString());
    });

    // 力导向模拟
    const simulation = d3.forceSimulation<AuthorNode>(data.nodes)
      .force('link', d3.forceLink<AuthorNode, CollabLink>(data.links)
        .id(d => d.id)
        .distance(80)
        .strength(d => Math.min(d.weight / 5, 1)))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<AuthorNode>().radius(d => nodeScale(d.paper_count) + 3));

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'collab-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0,0,0,0.85)')
      .style('color', 'white')
      .style('padding', '10px 14px')
      .style('border-radius', '6px')
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
      .attr('stroke', '#aaa')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', d => linkScale(d.weight));

    // 绘制节点
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(data.nodes)
      .enter().append('circle')
      .attr('r', d => nodeScale(d.paper_count))
      .attr('fill', d => getClusterColor(d.cluster || 0))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'grab')
      .on('mouseover', (event, d) => {
        const clusterIndex = clusterIdToIndex.get(d.cluster || 0);
        tooltip
          .style('opacity', 1)
          .html(`
            <strong>${d.name || 'Unknown'}</strong><br/>
            <strong>Papers:</strong> ${d.paper_count}<br/>
            <strong>H-Index:</strong> ${d.h_index.toFixed(1)}<br/>
            <strong>Cluster:</strong> ${clusterIndex !== undefined ? clusterIndex + 1 : 'N/A'}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');

        d3.select(event.target)
          .attr('stroke', '#ff6600')
          .attr('stroke-width', 3);

        // 高亮相连的边
        link.attr('stroke-opacity', l => {
          const src = typeof l.source === 'string' ? l.source : l.source.id;
          const tgt = typeof l.target === 'string' ? l.target : l.target.id;
          return (src === d.id || tgt === d.id) ? 1 : 0.1;
        });
      })
      .on('mouseout', (event) => {
        tooltip.style('opacity', 0);
        d3.select(event.target)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2);
        link.attr('stroke-opacity', 0.4);
      })
      .call(d3.drag<SVGCircleElement, AuthorNode>()
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

    // 添加作者名称标签（只显示论文数 > 10 的）
    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(data.nodes.filter(d => d.paper_count > 10))
      .enter().append('text')
      .text(d => d.name ? d.name.split(' ').slice(-1)[0] : '')  // 只显示姓氏
      .attr('font-size', 10)
      .attr('fill', '#333')
      .attr('text-anchor', 'middle')
      .attr('dy', -15)
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as AuthorNode).x || 0)
        .attr('y1', d => (d.source as AuthorNode).y || 0)
        .attr('x2', d => (d.target as AuthorNode).x || 0)
        .attr('y2', d => (d.target as AuthorNode).y || 0);

      node
        .attr('cx', d => d.x || 0)
        .attr('cy', d => d.y || 0);

      labels
        .attr('x', d => d.x || 0)
        .attr('y', d => d.y || 0);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [data, width, height]);

  if (loading) return <div>Loading collaboration network...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
      <h3 style={{ margin: '10px', color: '#333' }}>Author Collaboration Network - UMD Computer Science (2019-2024)</h3>
      <svg ref={svgRef} width={width} height={height} style={{ background: '#fafafa' }} />
      <div style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
        <strong>Interaction:</strong> Drag nodes to explore | Scroll to zoom | Hover to highlight connections
      </div>
      <div style={{ padding: '10px', fontSize: '11px', color: '#888', background: '#f5f5f5', borderTop: '1px solid #eee' }}>
        <strong>Scalability Solution:</strong> To manage 78,079 authors and 425,782 paper-author relationships,
        we display only the top {data?.nodes.length || 150} most prolific authors from the past 5 years.
        Edge width represents collaboration frequency. Authors with &gt;10 papers show name labels.
      </div>
    </div>
  );
};

export default CollaborationNetwork;
