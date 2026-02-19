
import React, { useState } from 'react';
import { TranslationSet } from '../types';

export const UserAcademy: React.FC<{ t: TranslationSet }> = ({ t }) => {
  const [activeLesson, setActiveLesson] = useState(0);

  const lessons = [
    {
      title: 'Temperaturen messen',
      icon: '🌡️',
      color: 'blue',
      description: 'So wird die tägliche Liste ausgefüllt:',
      steps: [
        { t: 'Wähle dein Gerät aus der Liste aus.', i: '👆' },
        { t: 'Tippe auf Plus oder Minus, um die Temperatur einzustellen.', i: '➕' },
        { t: 'Ist die Zahl ROT? Schreibe kurz auf, warum das so ist (z.B. "Tür offen").', i: '✍️' },
        { t: 'Tippe auf das SCHLOSS-Symbol zum Speichern. Fertig!', i: '🔒' }
      ]
    },
    {
      title: 'Checklisten ausfüllen',
      icon: '📝',
      color: 'emerald',
      description: 'Deine Aufgaben-Liste für heute:',
      steps: [
        { t: 'Öffne eine Checkliste mit dem "Starten" Knopf.', i: '🚀' },
        { t: 'Tippe einfach auf JA oder NEIN.', i: '🔘' },
        { t: 'Unterschreibe am Ende mit dem Finger im Feld.', i: '🖐️' },
        { t: 'Klicke auf ABSENDEN. Die Liste verschwindet, wenn sie fertig ist.', i: '✅' }
      ]
    },
    {
      title: 'Meine Berichte',
      icon: '📊',
      color: 'indigo',
      description: 'Deine Historie einsehen:',
      steps: [
        { t: 'Gehe auf den Tab "Meine Berichte" oben im Menü.', i: '📂' },
        { t: 'Wähle den Zeitraum aus (z.B. letzte Woche).', i: '📅' },
        { t: 'Alle deine Messungen erscheinen in einer Liste.', i: '📜' },
        { t: 'Rote Einträge ("Lost Day") zeigen dir, wo eine Liste vergessen wurde.', i: '🚨' }
      ]
    },
    {
      title: 'Dokumente hochladen',
      icon: '🗂️',
      color: 'rose',
      description: 'Gesundheitsausweis & Co. einreichen:',
      steps: [
        { t: 'Wähle deinen Namen in "Meine Dokumente" aus der Liste.', i: '👤' },
        { t: 'Klicke auf das Kamera-Symbol neben der Dokumenten-Art.', i: '📸' },
        { t: 'Mache ein scharfes Foto von deinem Ausweis oder Zertifikat.', i: '🤳' },
        { t: 'Tippe auf "Foto speichern". Die Verwaltung erhält es sofort.', i: '💾' }
      ]
    },
    {
      title: 'Handbücher lesen',
      icon: '📚',
      color: 'orange',
      description: 'Wissen, wie es geht:',
      steps: [
        { t: 'Suche dir ein Thema aus (z.B. Kochen oder Sicherheit).', i: '🔍' },
        { t: 'Tippe auf das Handbuch, das du lesen willst.', i: '📂' },
        { t: 'Das PDF öffnet sich sofort groß auf dem Bildschirm.', i: '📱' },
        { t: 'Schließe es mit dem X oben rechts, wenn du fertig bist.', i: '✕' }
      ]
    }
  ];

  const current = lessons[activeLesson];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left pb-20">
      <header className="bg-slate-900 text-white p-12 rounded-[4rem] relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
         <div className="relative z-10">
            <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-4">Anleitung</h1>
            <p className="text-slate-400 text-lg font-medium max-w-lg">
               Hier lernst du in wenigen Sekunden, wie du das System perfekt nutzt.
            </p>
         </div>
      </header>

      {/* ICON TABS */}
      <div className="flex flex-wrap justify-center bg-white dark:bg-slate-900 p-4 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 w-fit mx-auto gap-4">
         {lessons.map((lesson, idx) => (
            <button 
               key={idx}
               onClick={() => setActiveLesson(idx)}
               className={`w-16 h-16 lg:w-20 lg:h-20 rounded-[1.5rem] lg:rounded-[2rem] flex items-center justify-center text-3xl lg:text-4xl transition-all ${
                 activeLesson === idx 
                   ? `bg-${lesson.color}-600 text-white shadow-xl scale-110 rotate-3` 
                   : 'bg-slate-50 dark:bg-slate-800 text-slate-300 hover:text-slate-500'
               }`}
               title={lesson.title}
            >
               {lesson.icon}
            </button>
         ))}
      </div>

      <div className={`bg-white dark:bg-slate-900 rounded-[4rem] border-4 border-${current.color}-100 dark:border-${current.color}-900/30 overflow-hidden shadow-2xl transition-all duration-500 animate-in slide-in-from-bottom-8`}>
         <div className={`p-12 border-b border-${current.color}-50 dark:border-${current.color}-900/20 bg-${current.color}-50/30`}>
            <div className="flex items-center space-x-6">
               <span className="text-6xl">{current.icon}</span>
               <div>
                  <h2 className={`text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter`}>{current.title}</h2>
                  <p className="text-slate-500 text-xl font-medium mt-1">{current.description}</p>
               </div>
            </div>
         </div>
         <div className="p-12 space-y-10">
            {current.steps.map((step, idx) => (
               <div key={idx} className="flex items-center space-x-8 group">
                  <div className={`w-20 h-20 rounded-[2.5rem] bg-${current.color}-50 dark:bg-${current.color}-900/20 flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform shrink-0`}>
                     {step.i}
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Schritt {idx + 1}</p>
                     <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 leading-tight">{step.t}</p>
                  </div>
               </div>
            ))}
         </div>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800/50 p-10 rounded-[3rem] text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
         <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Tipp: Wenn alles erledigt ist, leuchtet der Pokal (🏆) im Menü.</p>
      </div>
    </div>
  );
};
