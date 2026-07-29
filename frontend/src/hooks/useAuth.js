import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'axon_code';

export function useAuth() {
  const [code, setCode] = useState(() => sessionStorage.getItem(STORAGE_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [config, setConfig] = useState({ deep_model: '', quick_model: '', api_base: '' });

  // Verify code on mount or change
  useEffect(() => {
    if (!code) { setChecking(false); return; }
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setAuthed(true);
          if (data.config) setConfig(data.config);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [code]);

  const login = useCallback((c) => {
    sessionStorage.setItem(STORAGE_KEY, c);
    setCode(c);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setCode('');
    setAuthed(false);
  }, []);

  return { code, authed, checking, config, login, logout, setConfig };
}
