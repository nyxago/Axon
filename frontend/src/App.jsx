import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import { useSSE } from './hooks/useSSE';
import { useAuth } from './hooks/useAuth';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import AgentGrid, { ALL_AGENTS } from './components/AgentGrid';
import ActivityFeed from './components/ActivityFeed';
import AskPanel from './components/AskPanel';
import ReportPanel from './components/ReportPanel';
import AuthScreen from './components/AuthScreen';
import SettingsModal from './components/SettingsModal';
import './App.css';

marked.setOptions({ breaks: true, gfm: true });

export default function App() {
  const { events, status, start } = useSSE();
  const { code, authed, checking, config, login, logout, setConfig } = useAuth();
  const [ticker, setTicker] = useState('');
  const [date, setDate] = useState('');
  const [history, setHistory] = useState([]);
  const [latestResult, setLatestResult] = useState(null);
  const [viewingResult, setViewingResult] = useState(null);
  const [lang, setLang] = useState('zh');
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [favorites, setFavorites] = useState(['600519', '000725', '600667', '300750']);
  const [freeRemaining, setFreeRemaining] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const startTimes = useRef({});

  // ---- Track per-agent state from SSE events ----
  // Timing is stable: recorded once on first agent_start/agent_done, never recomputed
  const agentTimings = useRef({});

  const agents = useMemo(() => {
    const map = {};
    ALL_AGENTS.forEach((a) => { map[a] = { status: 'waiting', action: '', elapsed: '' }; });

    for (const e of events) {
      if (e.event === 'agent_start' && e.agent) {
        // Record start time once, never overwrite
        if (!startTimes.current[e.agent]) startTimes.current[e.agent] = Date.now();
        map[e.agent] = { ...map[e.agent], status: 'working', action: map[e.agent].action || '分析中...' };
      }
      if (e.event === 'agent_done' && e.agent) {
        // Compute timing once, never recompute
        if (!agentTimings.current[e.agent]) {
          if (!startTimes.current[e.agent]) {
            const known = Object.values(startTimes.current);
            startTimes.current[e.agent] = known.length ? Math.max(...known) : Date.now();
          }
          const sec = Math.round((Date.now() - startTimes.current[e.agent]) / 1000);
          const min = Math.floor(sec / 60);
          const s = sec % 60;
          agentTimings.current[e.agent] = `${min}:${String(s).padStart(2, '0')}`;
        }
        map[e.agent] = { status: 'done', action: '', elapsed: agentTimings.current[e.agent] };
      }
      if (e.event === 'chunk' && e.agent) {
        const content = (e.content || '').replace(/\n/g, ' ').trim();
        if (content && map[e.agent]?.status === 'working') {
          map[e.agent] = { ...map[e.agent], action: content.slice(0, 60) };
        }
      }
    }

    if (!events.length && (latestResult || viewingResult)) {
      ALL_AGENTS.forEach((a) => { map[a] = { status: 'done', action: '', elapsed: '--' }; });
    }

    return map;
  }, [events, latestResult, viewingResult]);

  // Load history + latest + config on auth
  useEffect(() => {
    if (!authed || !code) return;
    const h = { 'X-Axon-Code': code };
    fetch('/api/results', { headers: h })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setHistory(data); })
      .catch(() => {});
    fetch('/api/latest', { headers: h })
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setLatestResult(data);
        // Also load favorites from verify
        return fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      })
      .then((r) => r?.json?.())
      .then((d) => {
        if (d?.config?.favorites) setFavorites(d.config.favorites);
        if (typeof d?.remaining === 'number') setFreeRemaining(d.remaining);
      })
      .catch(() => {});
  }, [authed, code]);

  const handleViewHistory = (h) => {
    setViewingResult(null);
    setMenuOpen(false);
    startTimes.current = {};
    fetch(`/api/results/${h.ticker}/${h.date}`, { headers: { 'X-Axon-Code': code } })
      .then((r) => r.json())
      .then((data) => { if (!data.error) setViewingResult(data); })
      .catch(() => {});
  };

  const activeResult = useMemo(() => {
    if (events.length > 0) return { source: 'live' };
    if (viewingResult) return { source: 'history', ...viewingResult };
    if (latestResult) return { source: 'latest', ...latestResult };
    return null;
  }, [events, viewingResult, latestResult]);

  const reports = useMemo(() => {
    const fromEvents = events
      .filter((e) => e.event === 'agent_done' && e.report)
      .map((e) => ({ agent: e.agent, content: e.report }));
    if (fromEvents.length > 0) return fromEvents;
    const src = activeResult;
    if (src) {
      return [
        { agent: 'Market Analyst', content: src.market_report },
        { agent: 'Sentiment Analyst', content: src.sentiment_report },
        { agent: 'News Analyst', content: src.news_report },
        { agent: 'Fundamentals Analyst', content: src.fundamentals_report },
      ].filter((r) => r.content);
    }
    return [];
  }, [events, activeResult]);

  const decision = useMemo(() => {
    const fromEvents = events.find((e) => e.event === 'decision');
    const result = fromEvents || (activeResult?.decision ? { event: 'decision', content: activeResult.decision } : null);
    if (!result) return null;
    const text = result.content || '';
    // Rating - scan from end of text for the final recommendation
    const tail = text.slice(-800); // recommendation usually at the end
    let rating = 'neutral';
    if (/(?:建议|推荐|评级|rating|decision|proposal).*(?:Sell|卖出|清仓|看空)/i.test(tail)) rating = 'sell';
    else if (/(?:建议|推荐|评级|rating|decision|proposal).*(?:Overweight|Buy|买入|增持|看多)/i.test(tail)) rating = 'buy';
    else if (/(?:建议|推荐|评级|rating|decision|proposal).*(?:Underweight|减持|减仓)/i.test(tail)) rating = 'underweight';
    else if (/(?:建议|推荐|评级|rating|decision|proposal).*(?:Hold|持有|观望)/i.test(tail)) rating = 'hold';
    else if (/Sell|卖出/i.test(tail)) rating = 'sell';
    else if (/Buy|买入|增持/i.test(tail)) rating = 'buy';
    else if (/Underweight|减持/i.test(tail)) rating = 'underweight';
    else if (/Hold|持有|观望/i.test(tail)) rating = 'hold';
    // Clean leaked JSON/code blocks
    let clean = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\{\s*"(?:overall_band|overall_score|confidence|narrative|recommendation|rationale|action|reasoning|rating|executive_summary|investment_thesis|entry_price|stop_loss|position_sizing|price_target|time_horizon|strategic_actions)"[\s\S]*?\}/g, '')
      .replace(/\{\s*'(?:overall_band|overall_score|confidence|narrative|recommendation|action|reasoning|rating)[\s\S]*?\}/g, '')
      .replace(/\n{3,}/g, '\n\n');
    return { ...result, content: clean, rating };
  }, [events, activeResult, lang]);

  const logLines = useMemo(() => {
    if (!events.length) return [];
    return events
      .filter((e) => e.event === 'chunk' || e.event === 'agent_done' || e.event === 'error')
      .map((e) => {
        const agent = e.agent || '';
        const raw = e.content || e.report || e.error || '';
        // Strip Markdown + JSON for log display
        const clean = raw
          .replace(/```[\s\S]*?```/g, '')
          .replace(/\{\s*"(?:overall_band|overall_score|confidence|narrative|recommendation|rationale|action|reasoning|rating|executive_summary|investment_thesis)[\s\S]*?\}/g, '')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/#{1,4}\s/g, '')
          .replace(/\|/g, ' ')
          .replace(/_{1,2}(.+?)_{1,2}/g, '$1')
          .replace(/`{1,3}[^`]*`{1,3}/g, '')
          .replace(/\n+/g, ' · ');
        return {
          text: (agent ? `[${agent}] ` : '') + clean,
          isError: e.event === 'error',
          agent,
        };
      });
  }, [events]);

  const handleAnalyze = useCallback((t, d) => {
    setTicker(t);
    setDate(d);
    setViewingResult(null);
    setMenuOpen(false);
    startTimes.current = {};
    agentTimings.current = {};
    start(t, d, code);
  }, [start, code]);

  // Running timer
  const analysisStart = useRef(0);
  useEffect(() => {
    if (status === 'running') {
      analysisStart.current = Date.now();
      setElapsed(0);
      const t = setInterval(() => setElapsed(Math.floor((Date.now() - analysisStart.current) / 1000)), 1000);
      return () => clearInterval(t);
    }
    if (status === 'done') setElapsed(0);
  }, [status]);

  const prevStatus = useRef(status);
  useEffect(() => {
    if (status === 'done' && prevStatus.current !== 'done' && code) {
      fetch('/api/results', { headers: { 'X-Axon-Code': code } })
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setHistory(data); })
        .catch(() => {});
    }
    prevStatus.current = status;
  }, [status, code]);

  if (checking) return <div className="auth-screen"><p style={{color:'#999'}}>…</p></div>;
  if (!authed) return <AuthScreen onLogin={login} lang={lang} />;

  return (
    <div className="app">
      {showSettings && (
        <SettingsModal
          code={code}
          config={config}
          onClose={() => setShowSettings(false)}
          onSaved={() => fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }).then(r => r.json()).then(d => { if (d.config) setConfig(d.config); }).catch(() => {})}
          lang={lang}
        />
      )}
      <TopBar
        ticker={ticker || activeResult?.ticker}
        date={date || activeResult?.date}
        lang={lang}
        onToggleLang={() => setLang((l) => (l === 'zh' ? 'en' : 'zh'))}
        onOpenSettings={() => setShowSettings(true)}
        running={status === 'running'}
        elapsed={elapsed}
      />
      <div className={`sidebar${status === 'running' ? ' running' : ''}`}>
        <Sidebar
          onAnalyze={handleAnalyze}
          onViewHistory={handleViewHistory}
          running={status === 'running'}
          history={history}
          agents={agents}
          lang={lang}
          favorites={favorites}
          onUpdateFavorites={setFavorites}
          code={code}
          freeRemaining={freeRemaining}
        />
      </div>
      <main className="main">
        <AgentGrid agents={agents} lang={lang} />
        <div className="content-row">
          <div className="content-main">
            {decision && (
              <section className="decision-section">
                <h2 className={`decision-headline decision-${decision.rating}`}>
                  {lang === 'zh' ? '分析观点：' : 'Analysis: '}
                  {decision.rating === 'buy' && (lang === 'zh' ? '看多（仅供参考）' : 'Bullish (for reference)')}
                  {decision.rating === 'sell' && (lang === 'zh' ? '看空（仅供参考）' : 'Bearish (for reference)')}
                  {decision.rating === 'underweight' && (lang === 'zh' ? '偏谨慎（仅供参考）' : 'Cautious (for reference)')}
                  {decision.rating === 'hold' && (lang === 'zh' ? '观望（仅供参考）' : 'Neutral (for reference)')}
                  {decision.rating === 'neutral' && (lang === 'zh' ? '中性（仅供参考）' : 'Neutral (for reference)')}
                </h2>
                <div className="decision-body markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(decision.content || '') }} />
                <div className="disclaimer">
                  {lang === 'zh'
                    ? '⚠️ 以上为 AI 多Agent 协作分析结果，不构成投资建议。投资有风险，决策需谨慎。'
                    : '⚠️ This is AI-generated analysis, NOT investment advice. Invest at your own risk.'}
                </div>
              </section>
            )}
            <ReportPanel reports={reports} />
            <ActivityFeed lines={logLines} />
          </div>
          <aside className="content-side">
            <AskPanel
              ticker={ticker || activeResult?.ticker}
              date={date || activeResult?.date}
              lang={lang}
              code={code}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
