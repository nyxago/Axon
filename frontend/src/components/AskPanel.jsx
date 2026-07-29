import { useState } from 'react';

export default function AskPanel({ ticker, date, lang }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [thread, setThread] = useState([]);

  const ask = async () => {
    const q = question.trim();
    if (!q || loading || !ticker || !date) return;
    setLoading(true);
    setQuestion('');
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, date, question: q }),
      });
      const data = await res.json();
      setThread((prev) => [...prev, { q, ...data }]);
    } catch {
      setThread((prev) => [...prev, { q, answer: '请求失败，请重试', source: '', confidence: 'error' }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } };

  return (
    <div className="ask-panel">
      <div className="ask-title">{lang === 'zh' ? '对这份报告提问' : 'Ask about this report'}</div>

      {thread.map((item, i) => (
        <div key={i} className="ask-thread">
          <div className="ask-q">{item.q}</div>
          <div className="ask-a">
            <div className="ask-text">{item.answer}</div>
            {item.source && (
              <div className={`ask-source ${item.confidence || ''}`}>
                {lang === 'zh' ? '来源：' : 'Source: '}{item.source}
                {item.confidence === 'low' && (lang === 'zh' ? ' · 低相关度' : ' · Low relevance')}
              </div>
            )}
          </div>
        </div>
      ))}

      {loading && <div className="ask-loading">{lang === 'zh' ? '检索中…' : 'Searching…'}</div>}

      <div className="ask-input-row">
        <input
          className="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKey}
          placeholder={lang === 'zh' ? '问一个问题，如"为什么决定减持？"' : 'Ask e.g. "Why underweight?"'}
          disabled={loading}
        />
        <button className="ask-btn" onClick={ask} disabled={loading || !question.trim()}>
          {loading ? '···' : '→'}
        </button>
      </div>
    </div>
  );
}
