import AgentCard from './AgentCard';

const ALL_AGENTS = [
  'Market Analyst', 'Sentiment Analyst', 'News Analyst', 'Fundamentals Analyst',
  'Bull Researcher', 'Bear Researcher', 'Trader', 'Portfolio Manager',
];

export default function AgentGrid({ agents, lang }) {
  return (
    <div className="agent-grid">
      {ALL_AGENTS.map((name) => {
        const info = agents[name] || { status: 'waiting' };
        return (
          <AgentCard
            key={name}
            agent={name}
            status={info.status}
            action={info.action}
            elapsed={info.elapsed}
            lang={lang}
          />
        );
      })}
    </div>
  );
}

export { ALL_AGENTS };
