/**
 * Vega-Lite 图表渲染组件
 */

import React, { useEffect, useRef } from 'react';
// @ts-ignore
import embed from 'vega-embed';

interface Props {
  spec: any;
  width?: number;
  height?: number;
}

const VegaChart: React.FC<Props> = ({ spec, width, height }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !spec) return;

    // 合并尺寸配置
    const finalSpec = {
      ...spec,
      width: width || spec.width || 500,
      height: height || spec.height || 300,
      autosize: { type: 'fit', contains: 'padding' }
    };

    embed(containerRef.current, finalSpec, {
      actions: {
        export: true,
        source: false,
        compiled: false,
        editor: false
      },
      theme: 'quartz'
    }).catch((err: Error) => {
      console.error('Vega embed error:', err);
    });

    // Cleanup
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [spec, width, height]);

  if (!spec) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="vega-chart"
      style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '10px',
        marginTop: '10px'
      }}
    />
  );
};

export default VegaChart;
