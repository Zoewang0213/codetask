/**
 * T2: 时间线可视化组件
 * 显示过去10年的论文发表趋势
 * 点击某年 → 触发专利分布更新
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface TimelineData {
  year: number;
  paper_count: number;
  total_citations: number;
  total_patents: number;
}

interface Props {
  width?: number;
  height?: number;
  onYearSelect?: (year: number | null) => void;
  selectedYear?: number | null;
}

const Timeline: React.FC<Props> = ({
  width = 800,
  height = 300,
  onYearSelect,
  selectedYear
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<TimelineData[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:5000/api/timeline')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 60, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X 轴（年份）
    const xScale = d3.scaleBand<number>()
      .domain(data.map(d => d.year))
      .range([0, innerWidth])
      .padding(0.2);

    // Y 轴（论文数量）
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.paper_count) || 0])
      .nice()
      .range([innerHeight, 0]);

    // 绘制坐标轴
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d => String(d)))
      .selectAll('text')
      .style('font-size', '12px');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '12px');

    // Y 轴标签
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Number of Papers');

    // 绘制柱状图
    const bars = g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.year) || 0)
      .attr('y', d => yScale(d.paper_count))
      .attr('width', xScale.bandwidth())
      .attr('height', d => innerHeight - yScale(d.paper_count))
      .attr('fill', d => d.year === selectedYear ? '#ff6600' : '#4a90d9')
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (onYearSelect) {
          onYearSelect(d.year === selectedYear ? null : d.year);
        }
      })
      .on('mouseover', function(event, d) {
        if (d.year !== selectedYear) {
          d3.select(this).attr('fill', '#6ba3e0');
        }
      })
      .on('mouseout', function(event, d) {
        if (d.year !== selectedYear) {
          d3.select(this).attr('fill', '#4a90d9');
        }
      });

    // 添加数值标签
    g.selectAll('.label')
      .data(data)
      .enter().append('text')
      .attr('class', 'label')
      .attr('x', d => (xScale(d.year) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.paper_count) - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#333')
      .text(d => d.paper_count.toLocaleString());

    // 添加专利引用线条（次坐标轴）
    const yPatentScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.total_patents) || 0])
      .nice()
      .range([innerHeight, 0]);

    // 右侧 Y 轴
    g.append('g')
      .attr('transform', `translate(${innerWidth},0)`)
      .call(d3.axisRight(yPatentScale))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#e67e22');

    g.append('text')
      .attr('transform', 'rotate(90)')
      .attr('y', -innerWidth - 45)
      .attr('x', innerHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#e67e22')
      .text('Patent Citations');

    // 绘制专利引用折线
    const line = d3.line<TimelineData>()
      .x(d => (xScale(d.year) || 0) + xScale.bandwidth() / 2)
      .y(d => yPatentScale(d.total_patents));

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#e67e22')
      .attr('stroke-width', 2)
      .attr('d', line);

    // 绘制专利数据点
    g.selectAll('.patent-dot')
      .data(data)
      .enter().append('circle')
      .attr('class', 'patent-dot')
      .attr('cx', d => (xScale(d.year) || 0) + xScale.bandwidth() / 2)
      .attr('cy', d => yPatentScale(d.total_patents))
      .attr('r', 4)
      .attr('fill', '#e67e22');

    // 添加图例
    const legend = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${innerWidth - 150}, -10)`);

    // 论文数量图例
    legend.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 16)
      .attr('height', 16)
      .attr('fill', '#4a90d9')
      .attr('rx', 3);

    legend.append('text')
      .attr('x', 22)
      .attr('y', 12)
      .style('font-size', '11px')
      .text('Paper Count');

    // 专利引用图例
    legend.append('line')
      .attr('x1', 0)
      .attr('y1', 32)
      .attr('x2', 16)
      .attr('y2', 32)
      .attr('stroke', '#e67e22')
      .attr('stroke-width', 2);

    legend.append('circle')
      .attr('cx', 8)
      .attr('cy', 32)
      .attr('r', 4)
      .attr('fill', '#e67e22');

    legend.append('text')
      .attr('x', 22)
      .attr('y', 36)
      .style('font-size', '11px')
      .text('Patent Citations');

  }, [data, width, height, selectedYear, onYearSelect]);

  if (loading) return <div>Loading timeline...</div>;

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
      <h3 style={{ margin: '10px', color: '#333' }}>
        UMD CS Publication Timeline (2014-2024)
        {selectedYear && <span style={{ color: '#ff6600', marginLeft: '10px' }}>
          | Viewing: {selectedYear}
        </span>}
      </h3>
      <svg ref={svgRef} width={width} height={height} style={{ background: '#fafafa' }} />
      <div style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
        <strong>Interaction:</strong> Click a year bar to filter the patent distribution below
        {selectedYear && <span> | <a href="#" onClick={(e) => { e.preventDefault(); onYearSelect?.(null); }} style={{ color: '#4a90d9' }}>Clear filter</a></span>}
      </div>
    </div>
  );
};

export default Timeline;
