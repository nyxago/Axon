const STOCK_NAMES = {
  '600519': '贵州茅台', '000725': '京东方A', '600667': '太极实业',
  '300750': '宁德时代', '000001': '平安银行', '000858': '五粮液',
  '601318': '中国平安', '600036': '招商银行',
};

export default function TopBar({ ticker, date, lang, onToggleLang, onOpenSettings, running, elapsed }) {
  const name = STOCK_NAMES[ticker] || '';
  const QUIPS = [
    '正在和八位分析师激烈辩论...',
    '多头和空头打起来了...',
    'AI 在翻财报，别催...',
    'K 线看得眼花缭乱...',
    '主力资金正在博弈中...',
    '等 DeepSeek 交卷...',
    '牛熊互怼，请勿打扰...',
    'PM 正在拍板中...',
    'Analyzing harder than your last trade...',
    'Bulls vs Bears · Round 2...',
  ];
  const quip = QUIPS[Math.floor(elapsed / 15) % QUIPS.length];
  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="topbar-brand">Axon</span>
        {running && (
          <>
            <span className="topbar-timer">{fmt(elapsed)}</span>
            <span className="topbar-quip">{quip}</span>
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {ticker && (
          <span className="topbar-meta">
            {ticker}{date ? ` · ${date}` : ''}
          </span>
        )}
        <button className="lang-toggle" onClick={onToggleLang}>
          <span className={lang === 'zh' ? 'active' : ''}>中</span>
          <span className="lang-div">/</span>
          <span className={lang === 'en' ? 'active' : ''}>EN</span>
        </button>
        <button className="lang-toggle" onClick={onOpenSettings}>⚙</button>
      </div>
    </header>
  );
}
