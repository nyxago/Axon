import { useEffect, useRef } from 'react';

export default function StockChart({ ticker }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!ticker) return;
    const container = containerRef.current;
    if (!container) return;

    let chart = null;
    let cancelled = false;

    // Dynamic import to prevent build issues
    import('lightweight-charts')
      .then(({ createChart }) => {
        if (cancelled || !containerRef.current) return;
        container.innerHTML = '';

        chart = createChart(container, {
          height: 260,
          layout: { background: { color: '#FFFFFF' }, textColor: '#8B8E92' },
          grid: { vertLines: { color: '#F0F0F0' }, horzLines: { color: '#F0F0F0' } },
          crosshair: { mode: 0 },
          rightPriceScale: { borderColor: '#E2E4E6' },
          timeScale: { borderColor: '#E2E4E6', timeVisible: false },
        });

        const candleSeries = chart.addCandlestickSeries({
          upColor: '#DC3545', downColor: '#28A745',
          borderUpColor: '#DC3545', borderDownColor: '#28A745',
          wickUpColor: '#DC3545', wickDownColor: '#28A745',
        });

        const volumeSeries = chart.addHistogramSeries({
          color: '#E2E4E6', priceFormat: { type: 'volume' }, priceScaleId: '',
        });
        volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

        fetch(`/api/chart/${ticker}?days=120`)
          .then((r) => r.json())
          .then((data) => {
            if (!Array.isArray(data) || cancelled) return;
            candleSeries.setData(data.map((d) => ({
              time: d.date, open: d.open, high: d.high, low: d.low, close: d.close,
            })));
            volumeSeries.setData(data.map((d) => ({
              time: d.date, value: d.volume,
              color: d.close >= d.open ? '#DC354522' : '#28A74522',
            })));
          })
          .catch(() => {});

        const handleResize = () => {
          if (chart && containerRef.current) chart.applyOptions({ width: container.clientWidth });
        };
        window.addEventListener('resize', handleResize);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (chart) chart.remove();
    };
  }, [ticker]);

  if (!ticker) return null;
  return <div className="stock-chart" ref={containerRef} />;
}
