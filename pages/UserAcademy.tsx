
import React, { useState } from 'react';
import { T } from '../src/BrandingContext';

export const UserAcademy: React.FC = () => {
  const [activeLesson, setActiveLesson] = useState(0);

  const lessons = [
    {
      titleKey: 'academy.lesson1.title',
      icon: '🌡️',
      color: 'blue',
      descriptionKey: 'academy.lesson1.desc',
      steps: [
        { tKey: 'academy.lesson1.step1', i: '👆' },
        { tKey: 'academy.lesson1.step2', i: '➕' },
        { tKey: 'academy.lesson1.step3', i: '✍️' },
        { tKey: 'academy.lesson1.step4', i: '🔒' }
      ]
    },
    {
      titleKey: 'academy.lesson2.title',
      icon: '📝',
      color: 'emerald',
      descriptionKey: 'academy.lesson2.desc',
      steps: [
        { tKey: 'academy.lesson2.step1', i: '🚀' },
        { tKey: 'academy.lesson2.step2', i: '🔘' },
        { tKey: 'academy.lesson2.step3', i: '🖐️' },
        { tKey: 'academy.lesson2.step4', i: '✅' }
      ]
    },
    {
      titleKey: 'academy.lesson3.title',
      icon: '📊',
      color: 'indigo',
      descriptionKey: 'academy.lesson3.desc',
      steps: [
        { tKey: 'academy.lesson3.step1', i: '📂' },
        { tKey: 'academy.lesson3.step2', i: '📅' },
        { tKey: 'academy.lesson3.step3', i: '📜' },
        { tKey: 'academy.lesson3.step4', i: '🚨' }
      ]
    },
    {
      titleKey: 'academy.lesson4.title',
      icon: '🗂️',
      color: 'rose',
      descriptionKey: 'academy.lesson4.desc',
      steps: [
        { tKey: 'academy.lesson4.step1', i: '👤' },
        { tKey: 'academy.lesson4.step2', i: '📂' },
        { tKey: 'academy.lesson4.step3', i: '📸' },
        { tKey: 'academy.lesson4.step4', i: '💾' }
      ]
    },
    {
      titleKey: 'academy.lesson5.title',
      icon: '📚',
      color: 'orange',
      descriptionKey: 'academy.lesson5.desc',
      steps: [
        { tKey: 'academy.lesson5.step1', i: '🔍' },
        { tKey: 'academy.lesson5.step2', i: '📂' },
        { tKey: 'academy.lesson5.step3', i: '📱' },
        { tKey: 'academy.lesson5.step4', i: '✕' }
      ]
    },
    {
      titleKey: 'academy.lesson6.title',
      icon: '🔑',
      color: 'amber',
      descriptionKey: 'academy.lesson6.desc',
      steps: [
        { tKey: 'academy.lesson6.step1', i: '🆕' },
        { tKey: 'academy.lesson6.step2', i: '🧠' },
        { tKey: 'academy.lesson6.step3', i: '❓' },
        { tKey: 'academy.lesson6.step4', i: '📡' }
      ]
    }
  ];

  const current = lessons[activeLesson];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left pb-20">
      <header className="bg-slate-900 text-white p-12 rounded-[4rem] relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
         <div className="relative z-10">
            <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-4">
              <T tkey="academy.title" />
            </h1>
            <p className="text-slate-400 text-lg font-medium max-w-lg">
               <T tkey="academy.subtitle" />
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
                  <h2 className={`text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter`}>
                    <T tkey={current.titleKey} />
                  </h2>
                  <p className="text-slate-500 text-xl font-medium mt-1">
                    <T tkey={current.descriptionKey} />
                  </p>
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
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <T tkey="academy.step" /> {idx + 1}
                     </p>
                     <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 leading-tight">
                        <T tkey={step.tKey} />
                     </p>
                  </div>
               </div>
            ))}
         </div>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800/50 p-10 rounded-[3rem] text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
         <p className="text-slate-400 font-black uppercase text-xs tracking-widest">
            <T tkey="academy.tip" />
         </p>
      </div>
    </div>
  );
};
