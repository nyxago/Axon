import { useState, useMemo } from 'react';

const STOCKS = [
  { code: '600519', name: '贵州茅台' }, { code: '000858', name: '五粮液' },
  { code: '000725', name: '京东方A' }, { code: '600667', name: '太极实业' },
  { code: '300750', name: '宁德时代' }, { code: '000001', name: '平安银行' },
  { code: '601318', name: '中国平安' }, { code: '600036', name: '招商银行' },
  { code: '601398', name: '工商银行' }, { code: '601288', name: '农业银行' },
  { code: '601857', name: '中国石油' }, { code: '600028', name: '中国石化' },
  { code: '601628', name: '中国人寿' }, { code: '601166', name: '兴业银行' },
  { code: '600030', name: '中信证券' }, { code: '000002', name: '万科A' },
  { code: '000651', name: '格力电器' }, { code: '000333', name: '美的集团' },
  { code: '002415', name: '海康威视' }, { code: '600276', name: '恒瑞医药' },
  { code: '300059', name: '东方财富' }, { code: '002594', name: '比亚迪' },
  { code: '601012', name: '隆基绿能' }, { code: '600809', name: '山西汾酒' },
  { code: '000568', name: '泸州老窖' }, { code: '002475', name: '立讯精密' },
  { code: '600900', name: '长江电力' }, { code: '601888', name: '中国中免' },
  { code: '300124', name: '汇川技术' }, { code: '002714', name: '牧原股份' },
  { code: '601899', name: '紫金矿业' }, { code: '600585', name: '海螺水泥' },
  { code: '000063', name: '中兴通讯' }, { code: '002230', name: '科大讯飞' },
  { code: '688981', name: '中芯国际' }, { code: '300274', name: '阳光电源' },
  { code: '601919', name: '中远海控' }, { code: '600104', name: '上汽集团' },
  { code: '002142', name: '宁波银行' },
];

const MINI_AGENTS = [
  { name: 'MKT', key: 'Market Analyst' }, { name: 'SENT', key: 'Sentiment Analyst' },
  { name: 'NEWS', key: 'News Analyst' }, { name: 'FUND', key: 'Fundamentals Analyst' },
  { name: 'BULL', key: 'Bull Researcher' }, { name: 'BEAR', key: 'Bear Researcher' },
  { name: 'TRD', key: 'Trader' }, { name: 'PM', key: 'Portfolio Manager' },
];

const T = {
  search: { zh: '搜索股票', en: 'Search' },
  date: { zh: '日期', en: 'Date' },
  analyze: { zh: '开始分析', en: 'Analyze' },
  running: { zh: '分析中…', en: 'Running…' },
  agents: { zh: 'Agents', en: 'Agents' },
  favorites: { zh: '我的自选', en: 'Favorites' },
  history: { zh: '历史', en: 'History' },
};

export default function Sidebar({ onAnalyze, onViewHistory, running, history, agents, lang, favorites, onUpdateFavorites, code, freeRemaining }) {
  const [query, setQuery] = useState('');
  const [ticker, setTicker] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showResults, setShowResults] = useState(false);

  const t = (key) => T[key]?.[lang] || T[key]?.en || key;

  const filtered = useMemo(() => {
    if (!query.trim()) return STOCKS.slice(0, 12);
    const q = query.trim().toLowerCase();
    return STOCKS.filter((s) => s.code.includes(q) || s.name.includes(q)).slice(0, 8);
  }, [query]);

  const selectStock = (code) => {
    setTicker(code);
    setQuery(`${code} ${STOCKS.find((s) => s.code === code)?.name || ''}`);
    setShowResults(false);
  };

  const toggleFavorite = (code) => {
    const next = favorites.includes(code)
      ? favorites.filter((c) => c !== code)
      : [...favorites, code];
    onUpdateFavorites(next);
    fetch('/api/auth/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, favorites: next }),
    }).catch(() => {});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const c = ticker.trim() || query.trim().slice(0, 6);
    if (c && date) { onAnalyze(c.toUpperCase(), date); setShowResults(false); }
  };

  const doneCount = Object.values(agents || {}).filter((a) => a.status === 'done').length;

  return (
    <aside className="sidebar">
      <form onSubmit={handleSubmit}>
        <div className="input-group" style={{ marginBottom: 8, position: 'relative' }}>
          <label>{t('search')}</label>
          <input
            type="text" value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); setTicker(''); }}
            onFocus={() => setShowResults(true)}
            placeholder="茅台 / 600519" autoComplete="off"
          />
          {showResults && query && (
            <div className="search-dropdown">
              {filtered.map((s) => (
                <div key={s.code} className="search-item">
                  <span className="search-body" onClick={() => selectStock(s.code)}>
                    <span className="search-code">{s.code}</span>
                    <span className="search-name">{s.name}</span>
                  </span>
                  <button
                    className={`fav-btn${favorites.includes(s.code) ? ' active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(s.code); }}
                    title={favorites.includes(s.code) ? '取消自选' : '加自选'}
                  >
                    {favorites.includes(s.code) ? '★' : '☆'}
                  </button>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="search-empty">{lang === 'zh' ? '未找到，直接输入6位代码' : 'Not found'}</div>
              )}
            </div>
          )}
        </div>
        <div className="input-group" style={{ marginBottom: 12 }}>
          <label>{t('date')}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button type="submit" className="btn-analyze" disabled={running || (!ticker && !query.trim())}>
          {running ? t('running') : t('analyze')}
        </button>
        {freeRemaining >= 0 && (
          <div className="free-badge">
            {lang === 'zh'
              ? `免费试用剩余 ${freeRemaining} 次`
              : `${freeRemaining} free trials left`}
          </div>
        )}
      </form>

      {favorites.length > 0 && (
        <div className="quick-section">
          <div className="quick-title">{t('favorites')}</div>
          <div className="quick-list">
            {favorites.map((code) => {
              const s = STOCKS.find((x) => x.code === code);
              return (
                <div key={code} className="quick-chip-wrap">
                  <button className="quick-chip" onClick={() => selectStock(code)} disabled={running}>
                    {code}<span className="quick-name">{s?.name || ''}</span>
                  </button>
                  <button className="quick-remove" onClick={() => toggleFavorite(code)} title="移除">×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(running || doneCount > 0) && (
        <div className="mini-status">
          <div className="mini-header">
            <span>{t('agents')}</span>
            <span className="mini-count">{doneCount}/{MINI_AGENTS.length}</span>
          </div>
          <div className="mini-list">
            {MINI_AGENTS.map((a) => {
              const s = agents?.[a.key]?.status || 'waiting';
              return (
                <div key={a.key} className={`mini-item ${s}`}>
                  <span className={`mini-dot ${s}`} />
                  <span className="mini-name">{a.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="history-section">
          <div className="history-title">{t('history')}</div>
          {history.map((h, i) => {
            const s = STOCKS.find((x) => x.code === h.ticker);
            return (
              <div key={i} className="history-item" onClick={() => onViewHistory(h)}>
                <span>{h.ticker}</span>
                {s && <span className="history-name">{s.name}</span>}
                <span className="history-date">{h.date}</span>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
