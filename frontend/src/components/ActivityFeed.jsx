import { useEffect, useRef } from 'react';

const COLORS = {
  'Market Analyst': '#1A73E8',
  'Sentiment Analyst': '#E871A3',
  'News Analyst': '#7C5CE7',
  'Fundamentals Analyst': '#28A745',
  'Bull Researcher': '#E8A317',
  'Bear Researcher': '#DC3545',
  'Trader': '#17A2B8',
  'Portfolio Manager': '#6C757D',
};

export default function ActivityFeed({ lines }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  if (lines.length === 0) return null;

  // Show only last 8 lines
  const visible = lines.slice(-8);

  return (
    <div className="activity-feed">
      <div className="activity-label">活动日志</div>
      {visible.map((line, i) => {
        const color = line.agent ? COLORS[line.agent] || '#666' : '#666';
        return (
          <div key={i} className={`activity-line${line.isError ? ' err' : ''}`}>
            {line.agent && <span className="activity-agent" style={{ color }}>{line.agent}</span>}
            <span className="activity-text">{line.text.replace(/^\[.*?\]\s*/, '')}</span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
