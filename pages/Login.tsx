
import React, { useState, useEffect } from 'react';
import { TranslationSet, User } from '../types';

interface LoginProps {
  t: TranslationSet;
  onLogin: (username: string, password?: string, stayLoggedIn?: boolean) => void;
  users: User[];
  legalTexts: { imprint: string; privacy: string };
  backendOffline?: boolean;
  loginError?: string | null;
}

const LOGO_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.256 1.181-3.103.493.969.819 2.087.819 3.103z'/%3E%3C/svg%3E";

export const Login: React.FC<LoginProps> = ({ t, onLogin, backendOffline, loginError, legalTexts }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showLegal, setShowLegal] = useState<'imprint' | 'privacy' | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Sync state if user changes permissions via browser settings
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    const interval = setInterval(() => {
      if (Notification.permission !== notifPermission) {
        setNotifPermission(Notification.permission);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [notifPermission]);

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert("Dieses Gerät oder dieser Browser unterstützt leider keine Push-Benachrichtigungen.");
      return;
    }

    if (Notification.permission === 'denied') {
      alert("Benachrichtigungen wurden blockiert. Bitte aktivieren Sie diese in Ihren Browser-Einstellungen.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      
      if (permission === 'granted') {
        try {
          new Notification("Gourmetta Central", {
            body: "Push-Benachrichtigungen sind nun aktiv.",
            icon: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/flame.svg"
          });
        } catch (e) {}
      }
    } catch (error) {
      console.error("Fehler beim Anfordern der Benachrichtigungsrechte:", error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username.trim(), password.trim(), true);
  };

  const getStatusColor = () => {
    if (notifPermission === 'granted') return 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-500/20 ring-4 ring-emerald-500/10';
    if (notifPermission === 'denied') return 'bg-slate-100 text-slate-400 border-slate-200'; // Neutral instead of Pink/Rose
    return 'bg-blue-50 text-blue-600 border-blue-100 shadow-blue-500/20 animate-pulse';
  };

  const accentColor = 'blue';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 relative overflow-hidden">
      <div className={`absolute -top-24 -left-24 w-96 h-96 bg-${accentColor}-100 rounded-full blur-3xl opacity-50 pointer-events-none transition-colors duration-1000`} />
      <div className={`absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-50 pointer-events-none transition-colors duration-1000`} />

      <div className="w-full max-w-[440px] bg-white rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-10 lg:p-12 border border-slate-100 relative z-10 text-left transition-all">
        {loginError && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-[90%] bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-xl animate-shake flex items-center space-x-3">
             <span className="text-xl">⚠️</span>
             <span className="font-black text-[10px] uppercase tracking-widest">{loginError}</span>
          </div>
        )}

        <div className="flex flex-col items-center mb-10 mt-4">
          <button 
            type="button"
            title="Push-Alarme aktivieren"
            onClick={requestNotificationPermission}
            className={`w-20 h-20 rounded-[2.25rem] flex items-center justify-center p-4 mb-6 border-2 transition-all group relative ${getStatusColor()} ${notifPermission === 'default' ? 'shadow-lg' : 'shadow-inner'}`}
          >
             <img src={LOGO_URL} className={`w-full h-full transition-all ${notifPermission === 'granted' ? 'scale-90' : 'scale-100'}`} alt="Logo" />
             {notifPermission === 'granted' && (
               <div className="absolute -bottom-2 -right-2 flex h-8 w-8 rounded-full bg-emerald-500 items-center justify-center text-white font-black border-4 border-white shadow-lg animate-in zoom-in">✓</div>
             )}
          </button>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter text-center">gourmetta</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 text-center">HCCP central</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t.username}</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                className={`w-full px-6 py-5 rounded-2xl bg-slate-50 border font-bold outline-none focus:ring-4 focus:ring-${accentColor}-500/10 focus:bg-white transition-all text-lg ${loginError ? 'border-rose-300' : 'border-slate-200'}`} 
                placeholder="Nutzername..." 
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t.password}</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className={`w-full px-6 py-5 rounded-2xl bg-slate-50 border font-bold outline-none focus:ring-4 focus:ring-${accentColor}-500/10 focus:bg-white transition-all text-lg ${loginError ? 'border-rose-300' : 'border-slate-200'}`} 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            className={`w-full py-6 bg-${accentColor}-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-2xl shadow-${accentColor}-500/30 hover:bg-${accentColor}-700 hover:translate-y-[-2px] active:translate-y-[0px] transition-all`}
          >
            ANMELDEN &rarr;
          </button>

          <div className="flex flex-col items-center space-y-4 pt-8 border-t border-slate-50">
             <div className="flex items-center space-x-4">
                <button type="button" onClick={() => setShowLegal('imprint')} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">Impressum</button>
                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                <button type="button" onClick={() => setShowLegal('privacy')} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">Datenschutz</button>
             </div>
          </div>
        </form>
      </div>

      {showLegal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border border-white/20 overflow-hidden text-left">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">
                {showLegal === 'imprint' ? 'Impressum' : 'Datenschutzerklärung'}
              </h2>
              <button onClick={() => setShowLegal(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 text-slate-500 hover:bg-rose-500 hover:text-white transition-all font-bold">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar whitespace-pre-wrap font-medium text-slate-600 leading-relaxed text-sm">
              {showLegal === 'imprint' ? legalTexts.imprint : legalTexts.privacy}
            </div>
            <div className="p-8 border-t border-slate-50 text-center">
               <button onClick={() => setShowLegal(null)} className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Verstanden</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
