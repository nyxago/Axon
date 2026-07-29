import { useState } from 'react';

export default function AuthScreen({ onLogin, lang }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const c = code.trim();
    if (c.length < 3) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      });
      const data = await res.json();
      if (data.ok) {
        onLogin(c);
      } else {
        setError(data.error || '验证失败');
      }
    } catch {
      setError('网络错误');
    }
    setLoading(false);
  };

  return (
    <div className="auth-screen">
      <form onSubmit={submit} className="auth-form">
        <h1 className="auth-brand">Axon</h1>
        <p className="auth-desc">
          {lang === 'zh' ? 'A 股多 Agent 复盘终端' : 'Multi-Agent A-Share Analysis'}
        </p>
        <input
          className="auth-input"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={lang === 'zh' ? '输入授权码' : 'Enter auth code'}
          autoFocus
          maxLength={32}
        />
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-btn" type="submit" disabled={loading || code.trim().length < 3}>
          {loading ? '…' : lang === 'zh' ? '进入' : 'Enter'}
        </button>
        <p className="auth-hint">
          {lang === 'zh'
            ? '请向管理员索取授权码'
            : 'Please ask the admin for an auth code'}
        </p>
      </form>
    </div>
  );
}
