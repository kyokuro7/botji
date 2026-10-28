'use client';

import { useEffect, useState } from 'react';

function initialScreen(bot) {
  const screens = (bot && bot.screens) || {};
  const ids = Object.keys(screens);
  if (ids.length === 0) return null;
  if (bot.start && screens[bot.start]) return bot.start;
  return ids[0];
}

export default function BotSimulator({ bot }) {
  const screens = (bot && bot.screens) || {};
  const [current, setCurrent] = useState(null);
  const [stack, setStack] = useState([]);
  const [log, setLog] = useState([]);

  useEffect(() => {
    const start = initialScreen(bot);
    setCurrent(start);
    setStack([]);
    if (!start) {
      setLog([]);
      return;
    }
    setLog([{ from: 'bot', text: screens[start] ? screens[start].message || 'Halo!' : 'Halo!' }]);
    // sengaja hanya bergantung pada bot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot]);

  if (!bot || !current) {
    return <div className="empty">bot.json belum ada atau tidak valid.</div>;
  }

  const screen = screens[current] || {};
  const buttons = Array.isArray(screen.buttons) ? screen.buttons : [];

  function handle(btn) {
    const label = btn.label || btn.text || 'Tombol';
    const next = btn.next || btn.screen;
    const nextLog = [...log, { from: 'user', text: label }];

    if (btn.action === 'back' || btn.back) {
      if (stack.length > 0) {
        const prevId = stack[stack.length - 1];
        setStack(stack.slice(0, -1));
        setCurrent(prevId);
        nextLog.push({ from: 'bot', text: (screens[prevId] && screens[prevId].message) || '(kosong)' });
      } else {
        nextLog.push({ from: 'bot', text: 'Sudah di menu utama.' });
      }
      setLog(nextLog);
      return;
    }

    if (next && screens[next]) {
      setStack([...stack, current]);
      setCurrent(next);
      nextLog.push({ from: 'bot', text: screens[next].message || '(kosong)' });
    } else if (btn.url) {
      nextLog.push({ from: 'bot', text: `Tombol URL: ${btn.url}` });
    } else {
      setLog(nextLog);
      setLog((prev) => [...prev, { from: 'bot', text: 'Menu tujuan tidak ditemukan di bot.json.' }]);
      return;
    }

    setLog(nextLog);
  }

  return (
    <div className="phone">
      <div className="phone-head">
        <div className="avatar">{(bot.name || 'B').slice(0, 1).toUpperCase()}</div>
        <div>
          <div style={{ fontWeight: 600 }}>{bot.name || 'Demo Bot'}</div>
          <div style={{ fontSize: 12, color: '#7d879c' }}>{bot.description || 'bot simulasi'}</div>
        </div>
      </div>

      {log.map((item, i) => (
        <div key={i} className={`bubble ${item.from === 'bot' ? 'bot' : 'user'}`}>
          {item.text}
        </div>
      ))}

      <div className="kbd">
        {buttons.map((btn, i) => (
          <button key={i} type="button" onClick={() => handle(btn)}>
            {btn.label || btn.text || `Tombol ${i + 1}`}
          </button>
        ))}
      </div>
    </div>
  );
}
