import { useState } from 'react';

const PRESETS = [
  { label: 'DeepSeek V4 Pro + Flash', deep: 'deepseek-v4-pro', quick: 'deepseek-v4-flash', base: 'https://api.deepseek.com/chat/completions' },
  { label: 'DeepSeek V3', deep: 'deepseek-chat', quick: 'deepseek-chat', base: 'https://api.deepseek.com/chat/completions' },
  { label: 'OpenAI GPT-4o + 4o-mini', deep: 'gpt-4o', quick: 'gpt-4o-mini', base: 'https://api.openai.com/v1/chat/completions' },
  { label: 'Custom', deep: '', quick: '', base: '' },
];

export default function SettingsModal({ code, config, onClose, onSaved, lang }) {
  const [dsKey, setDsKey] = useState(config.ds_key || '');
  const [deepModel, setDeepModel] = useState(config.deep_model || 'deepseek-v4-pro');
  const [quickModel, setQuickModel] = useState(config.quick_model || 'deepseek-v4-flash');
  const [apiBase, setApiBase] = useState(config.api_base || 'https://api.deepseek.com/chat/completions');
  const [saving, setSaving] = useState(false);

  const applyPreset = (p) => {
    if (p.deep) setDeepModel(p.deep);
    if (p.quick) setQuickModel(p.quick);
    if (p.base) setApiBase(p.base);
  };

  const save = async () => {
    setSaving(true);
    await fetch('/api/auth/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ds_key: dsKey, deep_model: deepModel, quick_model: quickModel, api_base: apiBase }),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{lang === 'zh' ? '设置' : 'Settings'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <label>{lang === 'zh' ? 'API Key' : 'API Key'}</label>
          <input type="password" value={dsKey} onChange={(e) => setDsKey(e.target.value)}
            placeholder="sk-..." className="modal-input" />

          <label style={{ marginTop: 14 }}>{lang === 'zh' ? '模型预设' : 'Preset'}</label>
          <div className="preset-list">
            {PRESETS.map((p) => (
              <button key={p.label} className="preset-chip" onClick={() => applyPreset(p)}>{p.label}</button>
            ))}
          </div>

          <label style={{ marginTop: 12 }}>{lang === 'zh' ? '深度思考模型' : 'Deep Think Model'}</label>
          <input value={deepModel} onChange={(e) => setDeepModel(e.target.value)} className="modal-input" placeholder="deepseek-v4-pro" />

          <label style={{ marginTop: 10 }}>{lang === 'zh' ? '快速模型' : 'Quick Model'}</label>
          <input value={quickModel} onChange={(e) => setQuickModel(e.target.value)} className="modal-input" placeholder="deepseek-v4-flash" />

          <label style={{ marginTop: 10 }}>API Base URL</label>
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} className="modal-input" placeholder="https://api.deepseek.com/chat/completions" />
        </div>

        <div className="modal-foot">
          <button className="btn-analyze" onClick={save} disabled={saving}>
            {saving ? '…' : lang === 'zh' ? '保存' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
