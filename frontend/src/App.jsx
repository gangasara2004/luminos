// ── App.jsx ───────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import LoginScreen  from './components/LoginScreen.jsx';
import AdminDash    from './components/AdminDash.jsx';
import AudienceView from './components/AudienceView.jsx';
import BeatView     from './components/BeatView.jsx';
import { BACKEND_URL } from './utils/constants.js';

const TOKEN_KEY = 'luminos_admin_token';

export default function App() {
  // 'audience' | 'beat' | 'login' | 'admin'
  const [view,  setView]  = useState('audience');
  const [token, setToken] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
  }, []);

  const handleLogin = async (password) => {
    const res = await fetch(`${BACKEND_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    sessionStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setView('admin');
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setView('audience');
  };

  if (view === 'beat')    return <BeatView    onBack={() => setView('audience')} />;
  if (view === 'login')   return <LoginScreen onLogin={handleLogin} onBack={() => setView('audience')} />;
  if (view === 'admin' && token) return <AdminDash token={token} onLogout={handleLogout} onGoAudience={() => setView('audience')} />;

  return (
    <AudienceView
      onAdminTap={() => token ? setView('admin') : setView('login')}
      onBeatTap={() => setView('beat')}
    />
  );
}
