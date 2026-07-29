const AGENTS = [
  'Market Analyst',
  'Sentiment Analyst',
  'News Analyst',
  'Fundamentals Analyst',
  'Bull Researcher',
  'Bear Researcher',
  'Trader',
  'Portfolio Manager',
];

export default function ProgressTimeline({ doneAgents, activeAgent }) {
  return (
    <div style={{ padding: '16px 20px' }}>
      {AGENTS.map((name) => {
        const done = doneAgents.has(name);
        const active = activeAgent === name;
        return (
          <div key={name} className="progress-item">
            <span
              className={`progress-dot ${done ? 'done' : active ? 'active' : 'waiting'}`}
            />
            <span
              className={`progress-name ${!done && !active ? 'waiting' : ''}`}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
