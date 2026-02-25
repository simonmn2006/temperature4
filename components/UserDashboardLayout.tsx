
import React, { useState, useEffect, useMemo } from 'react';
import { User, Assignment, FormResponse, Reading, Holiday, Facility, FacilityType, FormTemplate } from '../types';
import { useBranding, T } from '../src/BrandingContext';

interface UserDashboardLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
  assignments: Assignment[];
  currentUser: User;
  forms: FormTemplate[];
  formResponses: FormResponse[];
  readings: Reading[];
  holidays: Holiday[];
  isOnline?: boolean;
  isSyncing?: boolean;
  offlineQueueCount?: number;
  facilities: Facility[];
  facilityTypes: FacilityType[];
}

export const UserDashboardLayout: React.FC<UserDashboardLayoutProps> = ({
  activeTab, onTabChange, onLogout, children, assignments, currentUser, forms, formResponses, readings, holidays,
  isOnline = true, isSyncing = false, offlineQueueCount = 0, facilities, facilityTypes
}) => {
  const { settings, t } = useBranding();
  const [now, setNow] = useState(new Date());
  const [showBriefing, setShowBriefing] = useState(true);
  const [briefingCountdown, setBriefingCountdown] = useState(3);

  const LOGO_URL = settings.logoUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.256 1.181-3.103.493.969.819 2.087.819 3.103z'/%3E%3C/svg%3E";

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showBriefing && briefingCountdown > 0) {
      const timer = setTimeout(() => setBriefingCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (briefingCountdown === 0) {
      setShowBriefing(false);
    }
  }, [showBriefing, briefingCountdown]);

  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [now]);

  const briefingStats = useMemo(() => {
    const myFac = facilities.find(f => f.id === currentUser.facilityId);
    
    const pendingFormsCount = (assignments || []).filter(a => {
      if (a.resourceType !== 'form') return false;
      const isTarget = (a.targetType === 'user' && a.targetId === currentUser.id) || 
                       (a.targetType === 'facility' && a.targetId === currentUser.facilityId) ||
                       (a.targetType === 'facilityType' && a.targetId === myFac?.typeId);
      const isActive = todayStr >= a.startDate && todayStr <= a.endDate;
      const alreadyDone = (formResponses || []).some(fr => 
        fr.formId === a.resourceId && 
        fr.timestamp.startsWith(todayStr) && 
        (a.targetType === 'user' ? fr.userId === currentUser.id : (fr.facilityId === currentUser.facilityId))
      );
      return isTarget && isActive && !alreadyDone;
    }).length;

    let remainingTemps = 0;
    const myFridges = (facilities || []).find(f => f.id === currentUser.facilityId)?.refrigeratorCount || 0;
    const myFacId = currentUser.facilityId;
    if (myFacId) {
      const fridgesDoneToday = new Set((readings || [])
        .filter(r => r.facilityId === myFacId && r.targetType === 'refrigerator' && r.timestamp.startsWith(todayStr))
        .map(r => r.targetId + r.checkpointName));
      remainingTemps += Math.max(0, myFridges - fridgesDoneToday.size);
    }

    const assignedMenuIds = (assignments || [])
      .filter(a => {
        if (a.resourceType !== 'menu') return false;
        const isTarget = (a.targetType === 'user' && a.targetId === currentUser.id) || 
                         (a.targetType === 'facility' && a.targetId === currentUser.facilityId) ||
                         (a.targetType === 'facilityType' && a.targetId === myFac?.typeId);
        return isTarget && todayStr >= a.startDate && todayStr <= a.endDate;
      })
      .map(a => a.resourceId);

    assignedMenuIds.forEach(mId => {
      const alreadyDone = (readings || []).some(r => 
        r.targetId === mId && r.targetType === 'menu' && r.timestamp.startsWith(todayStr)
      );
      if (!alreadyDone) remainingTemps++;
    });

    return {
      temps: remainingTemps,
      forms: pendingFormsCount
    };
  }, [assignments, currentUser, todayStr, formResponses, facilities, readings]);

  const navGroups = [
    {
      id: 'operations',
      items: [
        { id: 'user_workspace', icon: '🌡️', label: t('nav.readings') },
        { id: 'user_forms', icon: '📝', label: t('nav.checklists'), badge: briefingStats.forms },
      ]
    },
    {
      id: 'compliance',
      items: [
        { id: 'user_personnel', icon: '🗂️', label: t('nav.personnel') },
        { id: 'user_library', icon: '📚', label: t('nav.documents') },
        { id: 'user_reports', icon: '📊', label: t('nav.readings') },
      ]
    },
    {
      id: 'learning',
      items: [
        { id: 'user_academy', icon: '🎓', label: t('academy.title') },
      ]
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {showBriefing && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-500 border border-white/10">
             <div className="p-12 text-center">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-8 shadow-inner animate-bounce">📋</div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic mb-2">Tages-Briefing</h2>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-12">Aufgaben für heute</p>
                
                <div className="grid grid-cols-2 gap-6 mb-12">
                   <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                      <p className="text-4xl mb-3 text-blue-600">🌡️</p>
                      <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{briefingStats.temps}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Messungen</p>
                   </div>
                   <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                      <p className="text-4xl mb-3 text-emerald-600">📝</p>
                      <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{briefingStats.forms}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Checklisten</p>
                   </div>
                </div>

                <button 
                  onClick={() => setShowBriefing(false)}
                  className="w-full py-5 bg-slate-900 dark:bg-blue-600 text-white rounded-[1.75rem] font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 transition-transform active:scale-95"
                >
                  Start ({briefingCountdown}s)
                </button>
             </div>
          </div>
        </div>
      )}

      <header className="h-32 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 lg:px-12 sticky top-0 z-50 no-print shadow-md">
        <div className="flex items-center">
          <div className="flex items-center space-x-3 group">
            <img src={LOGO_URL} className="w-10 h-10 object-contain" alt="Logo" />
            <div className="hidden lg:flex flex-col pb-1 min-w-0">
               <span className="font-black text-slate-900 dark:text-white text-lg leading-none block italic tracking-tighter">{settings.appName}</span>
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">HACCP Live</span>
            </div>
          </div>
        </div>
        
        <nav className="flex items-center bg-slate-100 dark:bg-slate-800/50 p-2 rounded-[2.5rem] shadow-inner">
          {navGroups.map((group, gIdx) => (
            <React.Fragment key={group.id}>
              <div className="flex space-x-1">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`flex flex-col items-center justify-center min-w-[84px] lg:min-w-[100px] h-20 rounded-[1.75rem] transition-all relative group/nav ${
                        isActive 
                          ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-lg scale-105 z-10' 
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="relative">
                        <span className={`text-2xl transition-transform ${isActive ? 'scale-110 mb-0.5' : 'group-hover/nav:scale-110'}`}>{item.icon}</span>
                        {item.badge && item.badge > 0 && item.id === 'user_forms' && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-black text-white shadow-lg border border-white dark:border-slate-800 animate-pulse-green">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-tighter text-center px-1 leading-tight ${isActive ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {gIdx < navGroups.length - 1 && (
                <div className="w-px h-12 bg-slate-200 dark:bg-slate-700 mx-2 self-center opacity-50" />
              )}
            </React.Fragment>
          ))}
        </nav>

        <div className="flex items-center space-x-6">
          <div className="hidden sm:block text-right">
             <p className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight">{currentUser.name}</p>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all shadow-sm group"
            title="Abmelden"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">🚪</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar">
        <div className="max-w-5xl mx-auto pb-24">
          {children}
        </div>
      </main>
    </div>
  );
};
