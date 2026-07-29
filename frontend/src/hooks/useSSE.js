import { useState, useRef, useCallback } from 'react';

export function useSSE() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('idle');
  const abortRef = useRef(null);

  const start = useCallback((ticker, date, code) => {
    setEvents([]);
    setStatus('running');
    const controller = new AbortController();
    abortRef.current = controller;

    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Axon-Code': code },
      body: JSON.stringify({ ticker, date }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop();
          for (const part of parts) {
            const lines = part.split('\n');
            let eventType = 'message';
            let data = '{}';
            for (const line of lines) {
              if (line.startsWith('event: ')) eventType = line.slice(7);
              if (line.startsWith('data: ')) data = line.slice(6);
            }
            try {
              const parsed = JSON.parse(data);
              setEvents((prev) => [...prev, { type: eventType, ...parsed }]);
              if (eventType === 'done') setStatus('done');
              if (eventType === 'error' && parsed.fatal) setStatus('error');
            } catch (_) {}
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setStatus('error');
      });
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
  }, []);

  return { events, status, start, stop };
}
