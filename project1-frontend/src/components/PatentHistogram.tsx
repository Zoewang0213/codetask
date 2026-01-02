/**
 * T2: 专利分布直方图
 * 显示论文的专利引用数量分布
 * 与时间线联动：选择年份时更新数据
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface PatentData {
  patent_count: number;
  paper_count: number;
}

interface Props {
  width?: number;
  height?: number;
  selectedYear?: number | null;
}

const PatentHistogram: React.FC<Props> = ({
  width = 800,
  height = 300,
  selectedYear
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<PatentData[] | null>(null);
  const [loading, setLoading] = useState(true);

  // 根据选中的年份获取数据
  useEffect(() => {
    const url = selectedYear
      ? `http://localhost:5000/api/patent-histogram?year=${selectedYear}`
      : 'http://localhost:5000/api/patent-histogram';

    setLoading(true);
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
  }, [selectedYear]);

  useEffect(() => {
    if (!data || !svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // 限制显示的专利数量范围（取前20个）
    const displayData = data.slice(0, 20);

    // X 轴（专利引用数）
    const xScale = d3.scaleBand<number>()
      .domain(displayData.map(d => d.patent_count))
      .range([0, innerWidth])
      .padding(0.1);

    // Y 轴（论文数量）
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(displayData, d => d.paper_count) || 0])
      .nice()
      .range([innerHeight, 0]);

    // 绘制坐标轴
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d => String(d)))
      .selectAll('text')
      .style('font-size', '11px');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '11px');

    // 坐标轴标签
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Number of Patent Citations');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Number of Papers');

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .style('position', 'absolute')
      .style('background', 'rgba(0,0,0,0.8)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    // 绘制柱状图
    g.selectAll('.bar')
      .data(displayData)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.patent_count) || 0)
      .attr('y', d => yScale(d.paper_count))
      .attr('width', xScale.bandwidth())
      .attr('height', d => innerHeight - yScale(d.paper_count))
      .attr('fill', '#27ae60')
      .attr('rx', 2)
      .on('mouseover', (event, d) => {
        tooltip
          .style('opacity', 1)
          .html(`
            <strong>Patent Citations:</strong> ${d.patent_count}<br/>
            <strong>Papers:</strong> ${d.paper_count}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');

        d3.select(event.target).attr('fill', '#2ecc71');
      })
      .on('mouseout', (event) => {
        tooltip.style('opacity', 0);
        d3.select(event.target).attr('fill', '#27ae60');
      });

    // 添加数值标签（只对较高的柱子显示）
    g.selectAll('.label')
      .data(displayData.filter(d => d.paper_count > (d3.max(displayData, d => d.paper_count) || 0) * 0.1))
      .enter().append('text')
      .attr('class', 'label')
      .attr('x', d => (xScale(d.patent_count) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.paper_count) - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#333')
      .text(d => d.paper_count);

    return () => {
      tooltip.remove();
    };
  }, [data, width, height]);

  if (loading) return <div>Loading patent distribution...</div>;

  const totalPapers = data ? data.reduce((sum, d) => sum + d.paper_count, 0) : 0;

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
      <h3 style={{ margin: '10px', color: '#333' }}>
        Patent Citation Distribution (Patent_Count)
        {selectedYear && <span style={{ color: '#ff6600', marginLeft: '10px' }}>
          | Year: {selectedYear}
        </span>}
      </h3>
      <svg ref={svgRef} width={width} height={height} style={{ background: '#fafafa' }} />
      <div style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
        <strong>Summary:</strong> {totalPapers.toLocaleString()} papers with patent citations
        {selectedYear ? ` in ${selectedYear}` : ' (all years)'} |
        X-axis shows patent citation count, Y-axis shows number of papers
      </div>
    </div>
  );
};

export default PatentHistogram;
