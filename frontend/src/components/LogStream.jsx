import { useEffect, useRef } from 'react';

const AGENT_COLORS = {
  'Market Analyst': '#1A73E8',
  'Sentiment Analyst': '#E871A3',
  'News Analyst': '#7C5CE7',
  'Fundamentals Analyst': '#28A745',
  'Bull Researcher': '#E8A317',
  'Bear Researcher': '#DC3545',
  'Trader': '#17A2B8',
  'Portfolio Manager': '#6C757D',
};

export default function LogStream({ lines }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  if (lines.length === 0) {
    return (
      <div className="log-stream">
        <div className="log-empty">执行日志将在此实时显示</div>
      </div>
    );
  }

  return (
    <div className="log-stream">
      {lines.map((line, i) => {
        const color = line.agent ? AGENT_COLORS[line.agent] || '#555' : '#555';
        return (
          <div key={i} className={`log-line${line.isError ? ' error' : ''}`}>
            <span className="log-prefix" style={{ color }}>&gt;</span>
            {' '}
            {line.text.length > 200 ? line.text.slice(0, 200) + '...' : line.text}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
