
import React from 'react';
import { TranslationSet, User, Facility, Refrigerator, Alert } from '../types';

interface DashboardPageProps {
  t: TranslationSet;
  currentUser: User;
  users: User[];
  facilities: Facility[];
  fridges: Refrigerator[];
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  impactStats: { pagesSaved: number; tonerSaved: number } | null;
  onSyncAlert: (alert: Alert) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ 
  t, currentUser, users, facilities, fridges, alerts, setAlerts, impactStats, onSyncAlert 
}) => {
  const activeAlerts = (alerts || []).filter(a => !a.resolved);
  const activeAlertCount = activeAlerts.length;

  const stats = [
    { label: 'Benutzer Gesamt', value: (users || []).length, icon: '👥', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Standorte', value: (facilities || []).length, icon: '🏢', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Kühlsysteme', value: (fridges || []).length, icon: '❄️', color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Aktive Alarme', value: activeAlertCount, icon: '🔔', color: 'text-rose-600', bg: 'bg-rose-50', critical: activeAlertCount > 0 },
  ];

  const handleResolve = (id: string) => {
    const alertItem = alerts.find(a => a.id === id);
    if (alertItem) {
      const updated = { ...alertItem, resolved: true };
      // State in App.tsx will be updated automatically via onSyncAlert callback
      onSyncAlert(updated);
    }
  };

  const handleClearAll = () => {
    if (confirm("Möchten Sie wirklich alle aktiven Alarme als erledigt markieren?")) {
      activeAlerts.forEach(a => {
        onSyncAlert({ ...a, resolved: true });
      });
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-left pb-24">
      {/* Welcome Header */}
      <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] shadow-sm flex flex-col md:flex-row items-center justify-between border border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-8">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center p-4">
            <img 
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.256 1.181-3.103.493.969.819 2.087.819 3.103z'/%3E%3C/svg%3E" 
              className="w-full h-full" 
              alt="Logo" 
            />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white italic tracking-tighter leading-none mb-2">gourmetta central</h1>
            <span className="text-xl font-bold text-slate-400">Willkommen zurück, {currentUser.name}</span>
          </div>
        </div>
        <div className="mt-6 md:mt-0 flex space-x-4">
           <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">System Status</span>
              <span className="text-sm font-bold text-emerald-700">Online & Aktiv</span>
           </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, idx) => (
          <div key={idx} className={`bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all ${s.critical ? 'animate-alert-flash' : ''}`}>
             <div className={`w-14 h-14 ${s.bg} dark:bg-slate-800 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-inner group-hover:scale-110 transition-transform`}>
                {s.icon}
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
             <h3 className={`text-4xl font-black tracking-tighter ${s.color}`}>{s.value}</h3>
             <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] font-black pointer-events-none">
                {s.icon}
             </div>
          </div>
        ))}
      </div>

      {/* Gourmetta Go Green Section */}
      <div className="bg-slate-900 rounded-[4rem] p-12 text-white relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
         <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-blue-500/10 blur-[100px] rounded-full -translate-x-1/3 translate-y-1/3" />
         
         <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="max-w-xl text-left">
               <div className="flex items-center space-x-4 mb-6">
                  <span className="text-4xl">🌱</span>
                  <h2 className="text-3xl font-black italic tracking-tighter">gourmetta go green</h2>
               </div>
               <p className="text-slate-400 text-lg font-medium leading-relaxed mb-8">
                  Durch die Digitalisierung Ihrer HACCP-Dokumentation reduzieren wir gemeinsam den ökologischen Fußabdruck. Weniger Papier, kein Toner – mehr Nachhaltigkeit für unsere Zukunft.
               </p>
               <div className="flex items-center space-x-3 bg-white/5 border border-white/10 w-fit px-5 py-2 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Impact Tracking</span>
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full lg:w-auto">
               <div className="bg-white/5 backdrop-blur-md border border-white/10 p-10 rounded-[3rem] text-center min-w-[240px] hover:bg-white/10 transition-colors">
                  <span className="text-4xl mb-4 block">📄</span>
                  <h4 className="text-4xl font-black text-emerald-400 mb-1">{(Number(impactStats?.pagesSaved) || 0).toLocaleString()}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Eingesparte Seiten</p>
               </div>
               <div className="bg-white/5 backdrop-blur-md border border-white/10 p-10 rounded-[3rem] text-center min-w-[240px] hover:bg-white/10 transition-colors">
                  <span className="text-4xl mb-4 block">🖨️</span>
                  <h4 className="text-4xl font-black text-blue-400 mb-1">{Math.floor(Number(impactStats?.tonerSaved) || 0)}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gesparte Druckerkartuschen</p>
               </div>
            </div>
         </div>
      </div>

      {/* RECENT ALERTS SECTION */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight italic">Dringende Alarme</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Kritische Grenzwert-Abweichungen</p>
          </div>
          {activeAlertCount > 0 && (
            <button 
              onClick={handleClearAll}
              className="px-6 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm"
            >
              Alle Alarme löschen
            </button>
          )}
        </div>

        {activeAlertCount > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 animate-alert-flash flex flex-col justify-between group">
                <div>
                  <div className="flex justify-between items-start mb-6">
                     <div>
                        <span className="text-[9px] font-black text-rose-600 uppercase tracking-[0.2em] block mb-1">Standort</span>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase leading-none">{alert.facilityName}</h4>
                     </div>
                     <span className="text-2xl">🚨</span>
                  </div>
                  
                  <div className="space-y-4 mb-8">
                     <div className="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-800">
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{alert.targetName}</span>
                           <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{alert.checkpointName}</span>
                        </div>
                        <div className="flex items-end gap-2">
                           <span className="text-3xl font-black text-rose-600 font-mono italic">{alert.value}°C</span>
                           <span className="text-[10px] font-bold text-slate-400 mb-1.5">(Limit: {alert.min}-{alert.max}°C)</span>
                        </div>
                     </div>
                     <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase">
                        <span>🕒</span>
                        <span>{new Date(alert.timestamp).toLocaleDateString('de-DE')} {new Date(alert.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                     </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleResolve(alert.id)}
                  className="w-full py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Erledigt
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 p-20 rounded-[4rem] border-4 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
             <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner animate-bounce">🛡️</div>
             <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">System Sicher</h3>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">Keine aktiven Alarme vorhanden.</p>
          </div>
        )}
      </div>
    </div>
  );
};
