
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TranslationSet, User, Facility, AuditLog, FacilityType, CookingMethod } from '../types';

interface SmtpConfig {
  host: string;
  port: string;
  encryption: string;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface BackupSyncPageProps {
  t: TranslationSet;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  currentUser: User;
  onLog: (action: AuditLog['action'], entity: string, details: string) => void;
  facilityTypes: FacilityType[];
  cookingMethods: CookingMethod[];
}

const API_BASE = '/api';

export const BackupSyncPage: React.FC<BackupSyncPageProps> = ({ 
  t, users, setUsers, facilities, setFacilities, currentUser, onLog, facilityTypes, cookingMethods 
}) => {
  const [isTestLoadingTelegram, setIsTestLoadingTelegram] = useState(false);
  const [testSuccessTelegram, setTestSuccessTelegram] = useState<boolean | null>(null);
  const [isTestLoadingEmail, setIsTestLoadingEmail] = useState(false);
  const [testSuccessEmail, setTestSuccessEmail] = useState<boolean | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [importStatus, setImportStatus] = useState<{msg: string, type: 'success' | 'error' | null}>({ msg: '', type: null });

  const [recipientSearch, setRecipientSearch] = useState('');

  // SMTP Config
  const [emailConfig, setEmailConfig] = useState<SmtpConfig>({ host: 'smtp.strato.de', port: '465', encryption: 'SSL/TLS', user: '', pass: '', from: '', secure: true });

  // Telegram Config
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({ botToken: '', chatId: '' });

  useEffect(() => {
    // Load SMTP from backend
    fetch(`${API_BASE}/settings/smtp`)
      .then(res => res.json())
      .then(data => {
        if (data.host) {
          setEmailConfig({
            host: data.host,
            port: data.port.toString(),
            encryption: data.secure ? 'SSL/TLS' : 'STARTTLS',
            user: data.user,
            pass: data.pass,
            from: data.from_email || '',
            secure: !!data.secure
          });
        }
      })
      .catch(console.error);

    // Load Telegram from backend
    fetch(`${API_BASE}/settings/telegram`)
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setTelegramConfig({ botToken: data.token, chatId: data.chatId });
        }
      })
      .catch(console.error);
  }, []);

  const saveSmtpToServer = async () => {
    setIsSavingEmail(true);
    try {
      const res = await fetch(`${API_BASE}/settings/smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...emailConfig,
          from: emailConfig.from || emailConfig.user
        })
      });
      if (res.ok) {
        setImportStatus({ msg: 'SMTP Einstellungen gespeichert!', type: 'success' });
        onLog('UPDATE', 'SYSTEM', 'SMTP-Konfiguration aktualisiert');
      } else {
        throw new Error();
      }
    } catch (e) {
      setImportStatus({ msg: 'Speichern fehlgeschlagen', type: 'error' });
    } finally {
      setIsSavingEmail(false);
      setTimeout(() => setImportStatus({msg: '', type: null}), 3000);
    }
  };

  const saveTelegramToServer = async () => {
    setIsSavingTelegram(true);
    try {
      const res = await fetch(`${API_BASE}/settings/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: telegramConfig.botToken, chatId: telegramConfig.chatId })
      });
      if (res.ok) {
        setImportStatus({ msg: 'Telegram Bot Einstellungen gespeichert!', type: 'success' });
        onLog('UPDATE', 'SYSTEM', 'Telegram-Konfiguration aktualisiert');
      } else {
        throw new Error();
      }
    } catch (e) {
      setImportStatus({ msg: 'Speichern fehlgeschlagen', type: 'error' });
    } finally {
      setIsSavingTelegram(false);
      setTimeout(() => setImportStatus({msg: '', type: null}), 3000);
    }
  };

  const toggleAlertChannel = async (userId: string, channel: 'emailAlerts' | 'telegramAlerts') => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const updatedUser = { ...user, [channel]: !user[channel] };
    setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
    try {
      await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });
    } catch (e) { console.error(e); }
  };

  const toggleAllFacilities = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const updatedUser = { ...user, allFacilitiesAlerts: !user.allFacilitiesAlerts };
    setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
    try {
      await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });
    } catch (e) { console.error(e); }
  };

  const testEmail = async () => {
    if (!emailConfig.user || !emailConfig.pass) {
        setImportStatus({ msg: 'Nutzer/Passwort fehlt', type: 'error' });
        setTimeout(() => setImportStatus({msg: '', type: null}), 3000);
        return;
    }
    setIsTestLoadingEmail(true);
    try {
        const res = await fetch(`${API_BASE}/test-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...emailConfig, testRecipient: users.find(u => u.role === 'SuperAdmin')?.email || emailConfig.user })
        });
        const data = await res.json();
        setTestSuccessEmail(data.success);
        setImportStatus({ msg: data.success ? 'Test Email gesendet' : (data.error || 'Test fehlgeschlagen'), type: data.success ? 'success' : 'error' });
    } catch (err) { setTestSuccessEmail(false); }
    finally { setIsTestLoadingEmail(false); setTimeout(() => setImportStatus({msg: '', type: null}), 3000); }
  };

  const testTelegram = async () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
        setImportStatus({ msg: 'Token/Chat-ID fehlt', type: 'error' });
        setTimeout(() => setImportStatus({msg: '', type: null}), 3000);
        return;
    }
    setIsTestLoadingTelegram(true);
    try {
        const res = await fetch(`${API_BASE}/test-telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: telegramConfig.botToken, chatId: telegramConfig.chatId })
        });
        const data = await res.json();
        setTestSuccessTelegram(data.success);
        setImportStatus({ msg: data.success ? 'Bot OK' : (data.error || 'Bot Error'), type: data.success ? 'success' : 'error' });
    } catch (err) { setTestSuccessTelegram(false); }
    finally { setIsTestLoadingTelegram(false); setTimeout(() => setImportStatus({msg: '', type: null}), 3000); }
  };

  const alertPrivilegedUsers = useMemo(() => {
    return users.filter(u => (u.role === 'Admin' || u.role === 'Manager' || u.role === 'SuperAdmin') && 
      (u.name.toLowerCase().includes(recipientSearch.toLowerCase()) || u.role.toLowerCase().includes(recipientSearch.toLowerCase()))
    );
  }, [users, recipientSearch]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left pb-20">
      {importStatus.type && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4">
              <div className={`px-8 py-4 rounded-2xl shadow-2xl text-white font-black uppercase text-xs ${importStatus.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                  {importStatus.msg}
              </div>
          </div>
      )}

      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Backup & Alarme</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Systemverwaltung & Benachrichtigungen</p>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-50 dark:border-slate-800 pb-8">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">🔔 Alarmempfänger</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Wer soll bei Grenzwert-Abweichungen benachrichtigt werden?</p>
          </div>
          <div className="relative w-full md:w-72">
             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
             <input type="text" placeholder="Empfänger suchen..." value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-xs outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
           {alertPrivilegedUsers.map(user => (
             <div key={user.id} className="group bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 flex flex-col lg:flex-row items-center justify-between gap-6 hover:bg-white hover:shadow-xl transition-all border-l-8 border-l-blue-100 group-hover:border-l-blue-500">
                <div className="flex items-center space-x-6 min-w-0 flex-1">
                   <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-2xl shadow-sm flex items-center justify-center text-2xl shrink-0">{user.role === 'Manager' ? '👨‍🍳' : '🛡️'}</div>
                   <div className="truncate">
                      <p className="font-black text-slate-900 dark:text-white text-lg tracking-tight leading-none mb-1">{user.name}</p>
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 rounded text-[9px] font-black uppercase tracking-widest">{user.role}</span>
                      {user.email && <p className="text-[10px] text-slate-400 font-bold mt-1 truncate">{user.email}</p>}
                   </div>
                </div>

                <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700 space-x-2">
                   <button onClick={() => toggleAlertChannel(user.id, 'emailAlerts')} className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all ${user.emailAlerts ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                     <span className="text-base">✉️</span>
                     <span className="text-[10px] font-black uppercase">E-Mail</span>
                   </button>
                   <button onClick={() => toggleAlertChannel(user.id, 'telegramAlerts')} className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all ${user.telegramAlerts ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                     <span className="text-base">✈️</span>
                     <span className="text-[10px] font-black uppercase">Telegram</span>
                   </button>
                </div>

                <div className="flex items-center gap-4">
                   <div className="flex items-center space-x-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Globales Monitoring</label>
                      <button onClick={() => toggleAllFacilities(user.id)} className={`w-12 h-6 rounded-full transition-all relative ${user.allFacilitiesAlerts ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                         <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${user.allFacilitiesAlerts ? 'left-6.5' : 'left-0.5'}`} />
                      </button>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SMTP Card */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col">
          <div className="mb-8">
             <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">E-Mail (SMTP Server)</h2>
             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Zentraler Postausgang für alle Alarme</p>
          </div>
          <div className="grid grid-cols-1 gap-4 flex-1">
             <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase px-2">SMTP Host</label>
               <input type="text" value={emailConfig.host} onChange={e => setEmailConfig({...emailConfig, host: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="Host (z.B. smtp.strato.de)" />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase px-2">Port</label>
                 <input type="text" value={emailConfig.port} onChange={e => setEmailConfig({...emailConfig, port: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="465" />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase px-2">Verschlüsselung</label>
                 <select value={emailConfig.encryption} onChange={e => {
                    const isSecure = e.target.value === 'SSL/TLS';
                    setEmailConfig({...emailConfig, encryption: e.target.value, secure: isSecure});
                 }} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs outline-none">
                   <option value="STARTTLS">STARTTLS (587)</option>
                   <option value="SSL/TLS">SSL/TLS (465)</option>
                 </select>
               </div>
             </div>
             <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase px-2">Nutzername / Login</label>
               <input type="email" value={emailConfig.user} onChange={e => setEmailConfig({...emailConfig, user: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="name@domain.de" />
             </div>
             <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase px-2">Passwort</label>
               <input type="password" value={emailConfig.pass} onChange={e => setEmailConfig({...emailConfig, pass: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="••••••••" />
             </div>
          </div>
          
          <div className="mt-8 flex flex-col gap-3">
             <button 
                onClick={saveSmtpToServer} 
                disabled={isSavingEmail}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-3 transition-all hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95"
             >
                {isSavingEmail ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>💾 SMTP Zugangsdaten Speichern</span>}
             </button>
             <button 
                onClick={testEmail} 
                disabled={isTestLoadingEmail} 
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-3 transition-all ${testSuccessEmail === true ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : testSuccessEmail === false ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
             >
                {isTestLoadingEmail ? <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" /> : <span>✉️ Konfiguration Testen</span>}
             </button>
          </div>
        </div>

        {/* Telegram Card */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col">
          <div className="mb-8">
             <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Telegram Bot Config</h2>
             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Echtzeit-Push für kritische Events</p>
          </div>
          <div className="space-y-4 flex-1">
             <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Bot API Token</label>
                <input type="text" value={telegramConfig.botToken} onChange={e => setTelegramConfig({...telegramConfig, botToken: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="123456789:ABCDefGhI..." />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Gruppen Chat-ID</label>
                <input type="text" value={telegramConfig.chatId} onChange={e => setTelegramConfig({...telegramConfig, chatId: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="-100..." />
             </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
             <button 
                onClick={saveTelegramToServer} 
                disabled={isSavingTelegram}
                className="w-full py-4 rounded-2xl bg-sky-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-3 transition-all hover:bg-sky-700 shadow-lg shadow-sky-500/20 active:scale-95"
             >
                {isSavingTelegram ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>💾 Telegram Bot Speichern</span>}
             </button>
             <button 
                onClick={testTelegram} 
                disabled={isTestLoadingTelegram} 
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-3 transition-all ${testSuccessTelegram === true ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : testSuccessTelegram === false ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
             >
                {isTestLoadingTelegram ? <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" /> : <span>✈️ Bot Testen</span>}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
