
import React, { useState, useMemo } from 'react';
import { TranslationSet, Reading, User, Facility, Refrigerator, Menu, FacilityException, FormResponse, FormTemplate, Assignment } from '../types';
import { GermanCalendarPicker } from '../components/GermanCalendarPicker';

interface ReportsPageProps {
  t: TranslationSet;
  currentUser: User;
  readings: Reading[];
  formResponses: FormResponse[];
  users: User[];
  facilities: Facility[];
  fridges: Refrigerator[];
  menus: Menu[];
  forms: FormTemplate[];
  excludedFacilities: FacilityException[];
  assignments: Assignment[];
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ t, currentUser, readings, formResponses, users, facilities, fridges, menus, forms }) => {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ start: getTodayStr(), end: getTodayStr() });
  const [filterType, setFilterType] = useState<'all' | 'refrigerator' | 'menu' | 'forms' | 'supervisor_audit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const getFacilityName = (id?: string) => facilities?.find(f => f.id === id)?.name || `ID: ${id || '?'}`;
  const getUserName = (id?: string) => users?.find(u => u.id === id)?.name || `ID: ${id || '?'}`;

  const reportEntries = useMemo(() => {
    const entries: any[] = [];
    const query = (searchQuery || '').toLowerCase();

    const parseAnswers = (ans: any) => {
      if (!ans) return {};
      if (typeof ans === 'object' && !Array.isArray(ans)) return ans;
      try { return typeof ans === 'string' ? JSON.parse(ans) : {}; } catch (e) { return {}; }
    };

    const readingGroups: Record<string, Reading[]> = {};

    try {
      if (filterType === 'all' || filterType === 'refrigerator' || filterType === 'menu') {
        (readings || []).forEach(r => {
          if (!r || !r.timestamp) return;
          const d = r.timestamp.includes('T') ? r.timestamp.split('T')[0] : r.timestamp.split(' ')[0];
          if (d < dateRange.start || d > dateRange.end) return;
          if (filterType !== 'all' && r.targetType !== filterType) return;
          
          const facName = getFacilityName(r.facilityId);
          const usrName = getUserName(r.userId);
          if (query && !facName.toLowerCase().includes(query) && !usrName.toLowerCase().includes(query)) return;

          const groupKey = `${r.targetType}_${r.targetId}_${r.facilityId}_${d}`;
          if (!readingGroups[groupKey]) readingGroups[groupKey] = [];
          readingGroups[groupKey].push(r);
        });

        Object.values(readingGroups).forEach(group => {
          const first = group[0];
          const facName = getFacilityName(first.facilityId);
          const usrName = getUserName(first.userId);
          let objName = '';
          let typeLabel = '';
          let icon = '';
          let color = '';

          if (first.targetType === 'refrigerator') {
            objName = fridges?.find(f => f.id === first.targetId)?.name || 'Kühlgerät';
            typeLabel = 'KÜHLUNG';
            icon = '❄️';
            color = 'text-blue-600';
          } else {
            objName = menus?.find(m => m.id === first.targetId)?.name || 'Menü';
            typeLabel = 'HACCP';
            icon = '🍽️';
            color = 'text-orange-600';
          }

          const groupedDetails = group.map(g => {
            const time = g.timestamp.includes('T') ? g.timestamp.split('T')[1].substring(0, 5) : g.timestamp.split(' ')[1]?.substring(0, 5);
            return `${g.checkpointName}: ${Number(g.value).toFixed(1)}°C (${time})`;
          }).join(' | ');

          const hasViolation = group.some(g => g.reason);

          entries.push({
            id: `GRP-${first.id}`, raw: group, type: 'READING_GROUP', timestamp: first.timestamp,
            facility: facName, user: usrName,
            typeLabel, icon,
            objectName: objName, details: groupedDetails,
            status: hasViolation ? '⚠️ KORREKTUR' : '✅ OK',
            color
          });
        });
      }

      if (filterType === 'all' || filterType === 'forms' || filterType === 'supervisor_audit') {
        (formResponses || []).forEach(fr => {
          if (!fr || !fr.timestamp) return;
          const d = fr.timestamp.includes('T') ? fr.timestamp.split('T')[0] : fr.timestamp.split(' ')[0];
          if (d < dateRange.start || d > dateRange.end) return;
          
          const formTemplate = forms?.find(f => f.id === fr.formId);
          const isAudit = formTemplate?.title.toLowerCase().includes('vor-ort') || formTemplate?.title.toLowerCase().includes('supervisor') || formTemplate?.title.toLowerCase().includes('audit');
          
          if (filterType === 'supervisor_audit' && !isAudit) return;
          if (filterType === 'forms' && isAudit) return;

          const facName = getFacilityName(fr.facilityId);
          const usrName = getUserName(fr.userId);
          if (query && !facName.toLowerCase().includes(query) && !usrName.toLowerCase().includes(query)) return;

          const answersObj = parseAnswers(fr.answers);
          const formTitle = formTemplate?.title || 'Checkliste';

          entries.push({
            id: fr.id, raw: fr, type: 'FORM', timestamp: fr.timestamp,
            facility: facName, user: usrName, 
            typeLabel: isAudit ? 'AUDIT' : 'CHECKLISTE',
            icon: isAudit ? '🛡️' : '📝',
            objectName: formTitle, details: `${Object.keys(answersObj).length} Punkte geprüft`,
            status: isAudit ? '🛡️ GEPRÜFT' : '📝 ERFASST',
            color: isAudit ? 'text-indigo-600' : 'text-emerald-600'
          });
        });
      }
    } catch (err) { console.error("Report processing error:", err); }

    return entries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }, [readings, formResponses, dateRange, filterType, searchQuery, users, facilities, fridges, menus, forms]);

  const auditSummary = useMemo(() => {
    if (filterType !== 'supervisor_audit') return null;

    const facilityStats: Record<string, { yes: number, no: number }> = {};
    const supervisorStats: Record<string, { showUps: number, linkedFacs: string[] }> = {};

    reportEntries.forEach(entry => {
        if (entry.type !== 'FORM') return;
        const fr = entry.raw;
        const answers = typeof fr.answers === 'string' ? JSON.parse(fr.answers) : fr.answers;
        
        const hasShowUp = Object.values(answers).some(val => val === 'YES' || val === 'Ja');
        
        if (!facilityStats[fr.facilityId]) facilityStats[fr.facilityId] = { yes: 0, no: 0 };
        if (hasShowUp) facilityStats[fr.facilityId].yes++;
        else facilityStats[fr.facilityId].no++;

        if (!supervisorStats[fr.userId]) {
            const user = users.find(u => u.id === fr.userId);
            supervisorStats[fr.userId] = { showUps: 0, linkedFacs: user?.managedFacilityIds || [] };
        }
        if (hasShowUp) supervisorStats[fr.userId].showUps++;
    });

    const ranking = Object.entries(supervisorStats).map(([uid, stats]) => ({
        id: uid,
        name: users.find(u => u.id === uid)?.name || 'System User',
        showUps: stats.showUps,
        linkedCount: stats.linkedFacs.length
    })).sort((a, b) => b.showUps - a.showUps);

    return { facilityStats, ranking };
  }, [reportEntries, filterType, users]);

  const exportToCSV = () => {
    const headers = ['Zeitpunkt', 'Standort', 'Nutzer', 'Typ', 'Gegenstand', 'Details', 'Status'];
    const rows = reportEntries.map(e => [
      e.timestamp?.replace('T', ' ').split('.')[0] || '',
      `"${e.facility}"`, `"${e.user}"`, e.typeLabel, `"${e.objectName}"`, `"${e.details}"`, e.status
    ]);
    const content = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gourmetta_Bericht_${getTodayStr()}.csv`;
    link.click();
  };

  const exportSingleToCSV = (entry: any) => {
    const headers = ['Feld', 'Wert'];
    const rows = [
      ['ID', entry.id],
      ['Zeitpunkt', entry.timestamp],
      ['Standort', entry.facility],
      ['Nutzer', entry.user],
      ['Typ', entry.typeLabel],
      ['Objekt', entry.objectName],
      ['Status', entry.status]
    ];
    const content = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gourmetta_Eintrag_${entry.id}.csv`;
    link.click();
  };

  return (
    <div className={`space-y-8 animate-in fade-in duration-500 text-left pb-20 ${selectedEntry ? 'is-viewing-detail' : ''}`}>
      <header className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-4 ${selectedEntry ? 'no-print' : ''}`}>
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Berichte & Archiv</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">HACCP Dokumentation</p>
        </div>
        <div className="flex space-x-3 no-print">
          <button onClick={exportToCSV} className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[10px] uppercase border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-all">Gesamt CSV Export</button>
          <button onClick={() => window.print()} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-blue-700 transition-all">Liste Drucken</button>
        </div>
      </header>

      <div className={`bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm no-print ${selectedEntry ? 'hidden' : ''}`}>
        <div className="flex flex-wrap lg:flex-nowrap items-end gap-6">
          <div className="w-full md:w-1/2 lg:w-1/4">
            <GermanCalendarPicker label="Zeitraum Von" value={dateRange.start} onChange={v => setDateRange({...dateRange, start: v})} />
          </div>
          <div className="w-full md:w-1/2 lg:w-1/4">
            <GermanCalendarPicker label="Zeitraum Bis" value={dateRange.end} onChange={v => setDateRange({...dateRange, end: v})} />
          </div>
          <div className="w-full md:w-1/2 lg:w-1/4 space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kategorie</label>
            <div className="relative">
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value as any)} 
                className="w-full pl-5 pr-10 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 transition-all h-[48px]"
              >
                <option value="all">📁 Alle Einträge</option>
                <option value="refrigerator">❄️ Nur Kühlung</option>
                <option value="menu">🍽️ Nur HACCP Menüs</option>
                <option value="forms">📝 Nur Checklisten</option>
                <option value="supervisor_audit">🛡️ Supervisor Audits</option>
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</span>
            </div>
          </div>
          <div className="w-full md:w-1/2 lg:w-1/4 space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Schnellsuche</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input 
                type="text" 
                placeholder="Name oder Nutzer..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all h-[48px]" 
              />
            </div>
          </div>
        </div>
      </div>

      {filterType === 'supervisor_audit' && auditSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-top-4 duration-500">
           {/* FACILITY STATS */}
           <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">Einhaltungs-Check pro Standort</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {Object.entries(auditSummary.facilityStats).map(([fid, stat]: [string, any]) => (
                    <div key={fid} className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                       <div className="min-w-0 pr-4">
                          <p className="font-black text-sm text-slate-900 dark:text-white uppercase truncate mb-1">{getFacilityName(fid)}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prüfungsquote</p>
                       </div>
                       <div className="flex gap-2 shrink-0">
                          <div className="text-center px-4 py-2 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
                             <p className="text-lg font-black leading-none">{stat.yes}</p>
                             <p className="text-[8px] font-black uppercase mt-1">JA</p>
                          </div>
                          <div className="text-center px-4 py-2 bg-white dark:bg-slate-700 text-slate-400 rounded-2xl border border-slate-100 dark:border-slate-600">
                             <p className="text-lg font-black leading-none">{stat.no}</p>
                             <p className="text-[8px] font-black uppercase mt-1">NEIN</p>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           {/* RANKING LEADERBOARD */}
           <div className="lg:col-span-5 flex flex-col gap-6">
              {/* CHAMPION HIGHLIGHT */}
              {auditSummary.ranking.length > 0 && (
                <div className="bg-blue-600 p-8 rounded-[3.5rem] shadow-2xl text-white relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 text-9xl opacity-20 pointer-events-none group-hover:scale-110 transition-transform">🏆</div>
                   <div className="relative z-10">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Audit Leaderboard</span>
                      <h3 className="text-3xl font-black italic tracking-tighter uppercase mt-2 mb-6">Show-Up Champion</h3>
                      <div className="flex items-center space-x-6">
                         <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center text-5xl shadow-xl">👑</div>
                         <div>
                            <p className="text-2xl font-black uppercase leading-tight">{auditSummary.ranking[0].name}</p>
                            <p className="text-base font-bold opacity-80 mt-1">{auditSummary.ranking[0].showUps} Standorte besucht</p>
                         </div>
                      </div>
                   </div>
                </div>
              )}

              <div className="bg-slate-900 p-8 rounded-[3.5rem] shadow-xl text-white flex-1 flex flex-col border border-white/5">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black uppercase tracking-[0.15em] flex items-center gap-3">
                       Top-Prüfungsleistung
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Geordnet nach Besuchen</span>
                 </div>
                 <div className="space-y-3 overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
                    {auditSummary.ranking.map((s, idx) => {
                       const isTop3 = idx < 3;
                       const rankColor = idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-slate-500';
                       return (
                         <div key={s.id} className={`flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all ${idx === 0 ? 'border-amber-400/30' : ''}`}>
                            <div className="flex items-center space-x-5">
                               <span className={`text-xl font-black ${rankColor} w-8`}>
                                 {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}
                               </span>
                               <div>
                                  <p className="font-black text-base uppercase tracking-tight">{s.name}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.linkedCount} zugewiesene Standorte</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className={`text-2xl font-black tracking-tighter ${rankColor}`}>{s.showUps}</p>
                               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Besuche</p>
                            </div>
                         </div>
                       );
                    })}
                    {auditSummary.ranking.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                         <span className="text-4xl mb-4">🔎</span>
                         <p className="text-xs font-black uppercase">Keine Audit-Daten erfasst</p>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className={`bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm ${selectedEntry ? 'no-print hidden' : ''}`}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Datum</th>
                <th className="px-8 py-5">Standort / Nutzer</th>
                <th className="px-8 py-5">Gegenstand</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {reportEntries.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-8 py-6">
                    <span className="text-[13px] font-black block font-mono text-slate-900 dark:text-white">
                      {row.timestamp?.split('T')[0].split('-').reverse().join('.')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {row.timestamp?.split('T')[1]?.split('.')[0].substring(0, 5) || row.timestamp?.split(' ')[1]?.substring(0, 5)} Uhr
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-black block text-slate-800 dark:text-slate-100">{row.facility}</span>
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{row.user}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-3">
                       <span className="text-2xl">{row.icon}</span>
                       <div className="max-w-md">
                          <span className="text-sm font-bold block text-slate-900 dark:text-white leading-tight">{row.objectName}</span>
                          <span className={`text-[9px] font-black uppercase tracking-tighter block mt-1 ${row.color}`}>{row.details}</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                     <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black border tracking-widest ${
                       row.status.includes('OK') || row.status.includes('GEPRÜFT') 
                       ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-100 dark:border-emerald-800' 
                       : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 border-rose-100 dark:border-rose-800'
                     }`}>
                        {row.status}
                     </span>
                  </td>
                  <td className="px-8 py-6 text-right no-print">
                     <button 
                       onClick={() => setSelectedEntry(row)} 
                       className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                     >
                       Ansehen
                     </button>
                  </td>
                </tr>
              ))}
              {reportEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-32 text-center">
                    <div className="flex flex-col items-center opacity-30">
                       <span className="text-6xl mb-4">🔍</span>
                       <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Keine Datensätze gefunden</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEntry && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 lg:p-12 print:block print:static print:z-auto">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm no-print" onClick={() => setSelectedEntry(null)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/10 animate-in zoom-in-95 duration-200 print:max-h-none print:shadow-none print:rounded-none print:border-none print:animate-none print:static">
            
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0 no-print">
               <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-2xl shadow-sm">{selectedEntry.icon}</div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">Details ansehen</h3>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{selectedEntry.id}</p>
                  </div>
               </div>
               <div className="flex items-center space-x-3">
                  <button onClick={() => exportSingleToCSV(selectedEntry)} className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 rounded-xl text-[10px] font-black uppercase border border-slate-200 shadow-sm hover:bg-slate-50">CSV Export</button>
                  <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-blue-700">DRUCKEN</button>
                  <button onClick={() => setSelectedEntry(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold hover:scale-110 transition-all">✕</button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 lg:p-16 custom-scrollbar print:overflow-visible print:p-0">
               <div className="max-w-3xl mx-auto space-y-12 print:max-w-full">
                  <div className="hidden print:flex mb-10 border-b-2 border-slate-900 pb-8 justify-between items-end">
                     <div>
                        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-blue-600">gourmetta</h1>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">HACCP Dokumentations-System</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest">Referenz-ID</p>
                        <p className="text-sm font-bold">{selectedEntry.id}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-10">
                     <div className="space-y-6">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Standort</label>
                           <p className="text-xl font-black text-slate-900 dark:text-white uppercase">{selectedEntry.facility}</p>
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Erfasst von</label>
                           <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{selectedEntry.user}</p>
                        </div>
                     </div>
                     <div className="space-y-6">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Zeitpunkt</label>
                           <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
                              {(() => {
                                 if (!selectedEntry.timestamp) return '--.--.---- --:--:--';
                                 // Format: DD.MM.YYYY HH:mm:ss
                                 const dtStr = selectedEntry.timestamp.replace('T', ' ').split('.')[0];
                                 const parts = dtStr.split(' ');
                                 const datePart = parts[0];
                                 const timePart = parts[1] || '00:00:00';
                                 const [y, m, d] = datePart.split('-');
                                 return `${d}.${m}.${y} ${timePart}`;
                              })()}
                           </p>
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                           <span className={`text-sm font-black px-4 py-1 rounded-full border inline-block ${selectedEntry.status.includes('OK') || selectedEntry.status.includes('GEPRÜFT') ? 'border-emerald-200 text-emerald-600' : 'border-rose-200 text-rose-600'}`}>
                              {selectedEntry.status}
                           </span>
                        </div>
                     </div>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800" />

                  <div>
                     <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 italic">Inhalt des Eintrags</h4>
                     
                     {selectedEntry.type === 'READING' ? (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between print:rounded-none print:bg-white print:border-slate-200">
                           <div className="flex-1">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{selectedEntry.raw.checkpointName}</p>
                              <h3 className="text-4xl font-black text-slate-900 dark:text-white mb-6">{selectedEntry.objectName}</h3>
                              
                              {selectedEntry.raw.reason && (
                                 <div className="mt-8 p-10 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-[2.5rem] border-4 border-rose-200 dark:border-rose-800 flex flex-col gap-5 shadow-lg animate-in zoom-in-95">
                                    <div className="flex items-center gap-4">
                                       <span className="text-4xl">⚠️</span>
                                       <span className="text-sm font-black uppercase tracking-[0.2em]">Kritische Abweichung - Begründung</span>
                                    </div>
                                    <p className="text-4xl font-black leading-tight italic tracking-tight underline decoration-rose-200">"{selectedEntry.raw.reason}"</p>
                                 </div>
                              )}
                           </div>
                           <div className="text-center ml-10">
                              <p className="text-7xl font-black text-blue-600 font-mono tracking-tighter">{Number(selectedEntry.raw.value).toFixed(1)}°C</p>
                           </div>
                        </div>
                     ) : selectedEntry.type === 'READING_GROUP' ? (
                        <div className="space-y-10">
                           <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{selectedEntry.objectName}</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              {selectedEntry.raw.map((r: any) => (
                                <div key={r.id} className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                                   <div className="mb-6">
                                      <div className="flex justify-between items-start">
                                         <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.checkpointName}</p>
                                            <p className="text-[9px] font-bold text-blue-600">Erfasst um {r.timestamp.split('T')[1]?.substring(0,5) || r.timestamp.split(' ')[1]?.substring(0, 5)} Uhr</p>
                                         </div>
                                         <p className="text-5xl font-black font-mono text-slate-900 dark:text-white tracking-tighter">{Number(r.value).toFixed(1)}°C</p>
                                      </div>
                                   </div>
                                   {r.reason && (
                                      <div className="p-8 bg-rose-50 dark:bg-rose-900/40 rounded-[2rem] border-4 border-rose-100 dark:border-rose-800 shadow-md">
                                         <span className="text-[10px] font-black text-rose-500 uppercase block mb-3 tracking-widest">⚠️ Abweichungsgrund:</span>
                                         <p className="text-2xl font-black text-rose-600 dark:text-rose-400 italic leading-tight">"{r.reason}"</p>
                                      </div>
                                   )}
                                </div>
                              ))}
                           </div>
                        </div>
                     ) : (
                        <div className="space-y-8">
                           <div className="flex items-center space-x-4 mb-8">
                              <span className="text-2xl print:hidden">📝</span>
                              <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{selectedEntry.objectName}</h3>
                           </div>
                           <div className="space-y-4">
                              {(() => {
                                 const template = forms.find(f => f.id === selectedEntry.raw.formId);
                                 const answers = typeof selectedEntry.raw.answers === 'string' ? JSON.parse(selectedEntry.raw.answers) : selectedEntry.raw.answers;
                                 return template?.questions.map((q, i) => (
                                    <div key={q.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center print:bg-white print:rounded-none print:border-slate-200">
                                       <div className="flex items-start space-x-4">
                                          <span className="text-xs font-black text-slate-400 mt-0.5">{i+1}.</span>
                                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{q.text}</p>
                                       </div>
                                       <div className="text-right ml-6 shrink-0">
                                          <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                             answers[q.id] === 'YES' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                             answers[q.id] === 'NO' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-white text-slate-600 border-slate-200'
                                          }`}>
                                             {answers[q.id] === 'YES' ? 'Ja' : answers[q.id] === 'NO' ? 'Nein' : (answers[q.id] || 'Nicht beantwortet')}
                                          </span>
                                       </div>
                                    </div>
                                 ));
                              })()}
                           </div>

                           {selectedEntry.raw.signature && (
                              <div className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800">
                                 <div className="flex flex-col items-center sm:items-end">
                                    <div className="w-full max-w-md">
                                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4 text-center sm:text-right">Rechtsgültige Digitale Unterschrift</label>
                                       <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 relative h-32 flex items-center justify-center shadow-inner print:bg-white print:border-slate-400">
                                          <img src={selectedEntry.raw.signature} alt="Signatur" className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                                       </div>
                                       <div className="mt-3 text-center sm:text-right">
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Signiert am {selectedEntry.timestamp?.split('T')[0].split('-').reverse().join('.')}</p>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>
                     )}
                  </div>
               </div>
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/50 no-print shrink-0">
               <button onClick={() => setSelectedEntry(null)} className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-transform shadow-xl">Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
