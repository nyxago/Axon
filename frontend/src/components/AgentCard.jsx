const META = {
  'Market Analyst': {
    tag: 'MKT',
    zh: '技术面分析', en: 'Technical Analysis',
  },
  'Sentiment Analyst': {
    tag: 'SENT',
    zh: '情绪 & 资金流', en: 'Sentiment & Flow',
  },
  'News Analyst': {
    tag: 'NEWS',
    zh: '新闻 & 宏观', en: 'News & Macro',
  },
  'Fundamentals Analyst': {
    tag: 'FUND',
    zh: '基本面估值', en: 'Fundamentals',
  },
  'Bull Researcher': {
    tag: 'BULL',
    zh: '多方辩论', en: 'Bull Case',
  },
  'Bear Researcher': {
    tag: 'BEAR',
    zh: '空方辩论', en: 'Bear Case',
  },
  'Trader': {
    tag: 'TRD',
    zh: '交易策略', en: 'Trade Strategy',
  },
  'Portfolio Manager': {
    tag: 'PM',
    zh: '最终决策', en: 'Final Decision',
  },
};

export default function AgentCard({ agent, status, action, elapsed, lang }) {
  const m = META[agent] || { tag: agent.slice(0, 4).toUpperCase(), zh: '', en: '' };
  return (
    <div className={`acard acard-${status}`}>
      <div className="acard-top">
        <span className="acard-tag">{m.tag}</span>
        <span className="acard-status">
          {status === 'done' && <span className="astat done">✓</span>}
          {status === 'working' && <span className="astat working" />}
          {status === 'waiting' && <span className="astat waiting" />}
        </span>
      </div>
      <div className="acard-name">{agent}</div>
      <div className="acard-label">{m[lang] || m.en}</div>
      <div className="acard-foot">
        {status === 'done' && elapsed && <span className="acard-time">{elapsed}</span>}
        {status === 'working' && action && <span className="acard-action">{action.slice(0, 35)}</span>}
        {status === 'waiting' && <span className="acard-idle">{lang === 'zh' ? '等待中' : 'Standing by'}</span>}
      </div>
    </div>
  );
}
