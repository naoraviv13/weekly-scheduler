import React, { useState, useEffect } from 'react';
import { Plus, X, Edit2, Copy, Trash2, Dumbbell, Home, Building2, Zap, Coffee, Sparkles, GripVertical, Check, Calendar, Flame, LayoutGrid, Library } from 'lucide-react';

const CATEGORY_STYLES = {
  workout: { icon: Dumbbell, label: 'Workout', color: '#FF4D2E', bg: 'rgba(255, 77, 46, 0.08)' },
  boxing: { icon: Zap, label: 'Boxing', color: '#E11D48', bg: 'rgba(225, 29, 72, 0.08)' },
  office: { icon: Building2, label: 'Office', color: '#0F172A', bg: 'rgba(15, 23, 42, 0.06)' },
  wfh: { icon: Home, label: 'WFH', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
  break: { icon: Coffee, label: 'Personal', color: '#A16207', bg: 'rgba(161, 98, 7, 0.08)' },
  custom: { icon: Sparkles, label: 'Custom', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.08)' },
};

// Sunday-first week
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_TEMPLATES = [
  {
    id: 't1', name: 'Office + Boxing', accent: '#E11D48',
    tasks: [
      { id: 'task1', title: 'Commute to office', time: '08:00', category: 'office' },
      { id: 'task2', title: 'Deep work block', time: '09:30', category: 'office' },
      { id: 'task3', title: 'Boxing session', time: '19:00', category: 'boxing' },
    ],
  },
  {
    id: 't2', name: 'WFH Power Day', accent: '#0891B2',
    tasks: [
      { id: 'task4', title: 'Morning workout', time: '07:00', category: 'workout' },
      { id: 'task5', title: 'Focus work', time: '09:00', category: 'wfh' },
      { id: 'task6', title: 'Team standup', time: '11:00', category: 'wfh' },
    ],
  },
  {
    id: 't3', name: 'Recovery Sunday', accent: '#A16207',
    tasks: [
      { id: 'task7', title: 'Slow morning', time: '09:00', category: 'break' },
      { id: 'task8', title: 'Mobility work', time: '11:00', category: 'workout' },
      { id: 'task9', title: 'Plan the week', time: '17:00', category: 'break' },
    ],
  },
  {
    id: 't4', name: 'Office Standard', accent: '#0F172A',
    tasks: [
      { id: 'task10', title: 'Commute', time: '08:00', category: 'office' },
      { id: 'task11', title: 'Meetings', time: '10:00', category: 'office' },
      { id: 'task12', title: 'Evening run', time: '18:30', category: 'workout' },
    ],
  },
];

// Sunday=0, Monday=1, ... in this Sunday-first ordering
const DEFAULT_ASSIGNMENTS = { 0: 't3', 1: 't1', 2: 't2', 3: 't1', 4: 't2', 5: 't1', 6: null };
const DEFAULT_ONE_TIME = {
  2: [{ id: 'oo1', title: 'Dentist appointment', time: '14:30', category: 'break' }],
  4: [{ id: 'oo2', title: 'Dinner with Maya', time: '20:00', category: 'break' }],
};
const DEFAULT_COMPLETED = ['1:task1', '1:task2'];

const STORAGE_KEY = 'routine:state:v1';

const completionKey = (dayIdx, taskId, isOneTime = false) =>
  isOneTime ? `${dayIdx}:oo:${taskId}` : `${dayIdx}:${taskId}`;

// Compute the current week's Sunday-anchored dates
function getWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push(d);
  }
  return { dates, todayIdx: dayOfWeek };
}

function formatDateRange(dates) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const first = dates[0], last = dates[6];
  const firstStr = `${months[first.getMonth()]} ${first.getDate()}`;
  const lastStr = first.getMonth() === last.getMonth()
    ? `${last.getDate()}`
    : `${months[last.getMonth()]} ${last.getDate()}`;
  return `${firstStr} — ${lastStr}`;
}

export default function ScheduleApp() {
  const [loaded, setLoaded] = useState(false);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [weekAssignments, setWeekAssignments] = useState(DEFAULT_ASSIGNMENTS);
  const [oneTimeTasks, setOneTimeTasks] = useState(DEFAULT_ONE_TIME);
  const [completed, setCompleted] = useState(new Set(DEFAULT_COMPLETED));
  const [view, setView] = useState('week');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showDayDetail, setShowDayDetail] = useState(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const { dates: weekDates, todayIdx } = getWeekDates();

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result && result.value) {
          const data = JSON.parse(result.value);
          if (data.templates) setTemplates(data.templates);
          if (data.weekAssignments) setWeekAssignments(data.weekAssignments);
          if (data.oneTimeTasks) setOneTimeTasks(data.oneTimeTasks);
          if (data.completed) setCompleted(new Set(data.completed));
        }
      } catch (e) {
        // No saved state yet — use defaults
      }
      setLoaded(true);
    })();
  }, []);

  // Save on every change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify({
          templates,
          weekAssignments,
          oneTimeTasks,
          completed: Array.from(completed),
        }));
      } catch (e) {
        console.error('Save failed:', e);
      }
    })();
  }, [templates, weekAssignments, oneTimeTasks, completed, loaded]);

  const getTemplate = (id) => templates.find(t => t.id === id);

  const toggleComplete = (key) => {
    const next = new Set(completed);
    if (next.has(key)) next.delete(key); else next.add(key);
    setCompleted(next);
  };

  const addOneTimeTask = (dayIdx, task) => {
    const existing = oneTimeTasks[dayIdx] || [];
    const newTask = { ...task, id: `oo${Date.now()}` };
    setOneTimeTasks({
      ...oneTimeTasks,
      [dayIdx]: [...existing, newTask].sort((a, b) => a.time.localeCompare(b.time)),
    });
  };

  const removeOneTimeTask = (dayIdx, taskId) => {
    const existing = oneTimeTasks[dayIdx] || [];
    setOneTimeTasks({ ...oneTimeTasks, [dayIdx]: existing.filter(t => t.id !== taskId) });
    const key = completionKey(dayIdx, taskId, true);
    if (completed.has(key)) {
      const next = new Set(completed);
      next.delete(key);
      setCompleted(next);
    }
  };

  const resetData = async () => {
    if (!confirm('Reset to default data? This will erase all your templates and tasks.')) return;
    setTemplates(DEFAULT_TEMPLATES);
    setWeekAssignments(DEFAULT_ASSIGNMENTS);
    setOneTimeTasks(DEFAULT_ONE_TIME);
    setCompleted(new Set(DEFAULT_COMPLETED));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7', fontFamily: "'Inter Tight', system-ui, sans-serif", color: '#0A0A0A', paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .display-font { font-family: 'Fraunces', serif; font-style: italic; letter-spacing: -0.02em; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        button { cursor: pointer; border: none; background: none; font-family: inherit; color: inherit; }
        .btn-primary { background: #0A0A0A; color: #FAFAF7; padding: 10px 18px; border-radius: 999px; font-weight: 500; font-size: 14px; transition: transform 0.15s ease, background 0.15s ease; display: inline-flex; align-items: center; gap: 6px; }
        .btn-primary:hover { background: #FF4D2E; transform: translateY(-1px); }
        .btn-ghost { padding: 8px 14px; border-radius: 999px; font-weight: 500; font-size: 13px; color: #525252; transition: background 0.15s ease; }
        .btn-ghost:hover { background: rgba(0,0,0,0.06); }
        .day-card { background: white; border-radius: 20px; padding: 18px; border: 1px solid rgba(0,0,0,0.06); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; cursor: pointer; position: relative; overflow: hidden; }
        .day-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px -10px rgba(0,0,0,0.12); border-color: rgba(0,0,0,0.12); }
        .day-card.empty { background: #F4F3EE; border-style: dashed; border-color: rgba(0,0,0,0.12); }
        .day-card.today::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: #FF4D2E; }
        .template-chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: white; border: 1.5px solid; }
        .task-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; transition: background 0.12s ease; }
        .task-row:hover { background: rgba(0,0,0,0.03); }
        .task-icon { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; }
        .checkbox { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid rgba(0,0,0,0.2); background: white; display: grid; place-items: center; flex-shrink: 0; transition: all 0.15s ease; cursor: pointer; }
        .checkbox:hover { border-color: #0A0A0A; }
        .checkbox.checked-accent { background: #FF4D2E; border-color: #FF4D2E; }
        .task-completed { opacity: 0.45; }
        .task-completed .task-title { text-decoration: line-through; text-decoration-thickness: 1.5px; }
        .one-time-badge { font-size: 8px; font-weight: 700; letter-spacing: 0.05em; padding: 2px 6px; border-radius: 3px; background: rgba(0,0,0,0.06); color: #525252; font-family: 'JetBrains Mono', monospace; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(10,10,10,0.4); backdrop-filter: blur(8px); display: grid; place-items: center; padding: 20px; z-index: 100; animation: fadeIn 0.2s ease; }
        .modal { background: #FAFAF7; border-radius: 24px; max-width: 560px; width: 100%; max-height: 88vh; overflow-y: auto; padding: 28px; animation: slideUp 0.25s ease; box-shadow: 0 30px 60px -20px rgba(0,0,0,0.3); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes checkPop { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
        .check-pop { animation: checkPop 0.3s ease; }
        .input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1.5px solid rgba(0,0,0,0.1); background: white; font-family: inherit; font-size: 14px; transition: border-color 0.15s ease; }
        .input:focus { outline: none; border-color: #0A0A0A; }
        .week-grid { display: grid; gap: 14px; grid-template-columns: repeat(7, 1fr); }
        @media (max-width: 1100px) { .week-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 700px) { .week-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
        @media (max-width: 480px) { .week-grid { grid-template-columns: 1fr; } }
        .templates-grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        .pill-tab { padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; transition: all 0.2s ease; }
        .pill-tab.active { background: #0A0A0A; color: #FAFAF7; }
        .pill-tab:not(.active):hover { background: rgba(0,0,0,0.06); }
        .stat-num { font-family: 'Fraunces', serif; font-weight: 600; font-size: 32px; line-height: 1; }
        .progress-bar { height: 4px; background: rgba(0,0,0,0.08); border-radius: 999px; overflow: hidden; }
        .progress-fill { height: 100%; background: #FF4D2E; border-radius: 999px; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .section-divider { display: flex; align-items: center; gap: 10px; margin: 12px 0 6px; }
        .section-divider::before, .section-divider::after { content: ''; flex: 1; height: 1px; background: rgba(0,0,0,0.06); }
        .section-divider-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #737373; letter-spacing: 0.15em; font-weight: 600; }

        /* Desktop nav */
        .desktop-nav { display: flex; }
        /* Mobile bottom tab bar */
        .mobile-nav {
          display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
          background: rgba(250,250,247,0.92); backdrop-filter: blur(16px);
          border-top: 1px solid rgba(0,0,0,0.06); padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
          justify-content: space-around; align-items: center; gap: 4px;
        }
        .mobile-nav-tab {
          flex: 1; max-width: 120px; padding: 8px; border-radius: 14px;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          color: #737373; transition: all 0.2s ease;
        }
        .mobile-nav-tab.active { color: #0A0A0A; background: rgba(0,0,0,0.04); }
        .mobile-nav-tab.fab {
          background: #0A0A0A; color: #FAFAF7; border-radius: 50%;
          width: 56px; height: 56px; padding: 0; flex: 0 0 auto;
          margin-top: -20px; box-shadow: 0 8px 20px -4px rgba(0,0,0,0.25);
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .mobile-nav-tab.fab:hover { background: #FF4D2E; transform: scale(1.05); }
        .mobile-nav-label { font-size: 10px; font-weight: 600; letter-spacing: 0.02em; }
        @media (max-width: 700px) {
          .desktop-nav { display: none; }
          .mobile-nav { display: flex; }
          .header-padding { padding: 16px 20px !important; }
          .main-padding { padding: 20px !important; }
          .hero-title { font-size: clamp(32px, 9vw, 44px) !important; }
          .stats-strip { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <header className="header-padding" style={{
        padding: '24px 32px', borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'rgba(250,250,247,0.85)',
        backdropFilter: 'blur(12px)', zIndex: 10, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: '#0A0A0A',
            display: 'grid', placeItems: 'center', color: '#FF4D2E',
            fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 20,
          }}>R</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Routine<span className="display-font" style={{ color: '#FF4D2E' }}>.</span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em' }}>
              TEMPLATE-BASED SCHEDULER
            </div>
          </div>
        </div>

        <nav className="desktop-nav" style={{ gap: 4, background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 999 }}>
          <button className={`pill-tab ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>This Week</button>
          <button className={`pill-tab ${view === 'templates' ? 'active' : ''}`} onClick={() => setView('templates')}>Templates</button>
        </nav>
      </header>

      {view === 'week' ? (
        <WeekView
          templates={templates} weekAssignments={weekAssignments} setWeekAssignments={setWeekAssignments}
          oneTimeTasks={oneTimeTasks} completed={completed} toggleComplete={toggleComplete}
          getTemplate={getTemplate} showDayDetail={showDayDetail} setShowDayDetail={setShowDayDetail}
          addOneTimeTask={addOneTimeTask} removeOneTimeTask={removeOneTimeTask}
          weekDates={weekDates} todayIdx={todayIdx}
        />
      ) : (
        <TemplatesView
          templates={templates} setTemplates={setTemplates}
          editingTemplate={editingTemplate} setEditingTemplate={setEditingTemplate}
          creatingTemplate={creatingTemplate} setCreatingTemplate={setCreatingTemplate}
          resetData={resetData}
        />
      )}

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-tab ${view === 'week' ? 'active' : ''}`}
          onClick={() => setView('week')}
        >
          <LayoutGrid size={20} />
          <span className="mobile-nav-label">Week</span>
        </button>
        <button
          className="mobile-nav-tab fab"
          onClick={() => {
            setView('week');
            setShowDayDetail(todayIdx);
          }}
          aria-label="Quick add to today"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
        <button
          className={`mobile-nav-tab ${view === 'templates' ? 'active' : ''}`}
          onClick={() => setView('templates')}
        >
          <Library size={20} />
          <span className="mobile-nav-label">Templates</span>
        </button>
      </nav>
    </div>
  );
}

function WeekView({
  templates, weekAssignments, setWeekAssignments, oneTimeTasks, completed, toggleComplete,
  getTemplate, showDayDetail, setShowDayDetail, addOneTimeTask, removeOneTimeTask,
  weekDates, todayIdx,
}) {
  const getDayTasks = (dayIdx) => {
    const tid = weekAssignments[dayIdx];
    const templateTasks = tid ? (getTemplate(tid)?.tasks || []).map(t => ({ ...t, isOneTime: false })) : [];
    const oneTimes = (oneTimeTasks[dayIdx] || []).map(t => ({ ...t, isOneTime: true }));
    return [...templateTasks, ...oneTimes].sort((a, b) => a.time.localeCompare(b.time));
  };

  const stats = { workouts: 0, boxing: 0, office: 0, wfh: 0 };
  let totalTasks = 0, completedTasks = 0;
  Object.keys(weekAssignments).forEach(dayIdx => {
    const tasks = getDayTasks(parseInt(dayIdx));
    tasks.forEach(task => {
      totalTasks++;
      const key = completionKey(dayIdx, task.id, task.isOneTime);
      if (completed.has(key)) completedTasks++;
      if (task.category === 'workout') stats.workouts++;
      if (task.category === 'boxing') stats.boxing++;
      if (task.category === 'office') stats.office++;
      if (task.category === 'wfh') stats.wfh++;
    });
  });
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const streak = (() => {
    let count = 0;
    for (let i = todayIdx; i >= 0; i--) {
      const tasks = getDayTasks(i);
      if (tasks.length === 0) continue;
      const allDone = tasks.every(t => completed.has(completionKey(i, t.id, t.isOneTime)));
      if (allDone) count++; else break;
    }
    return count;
  })();

  const weekNum = Math.ceil(((weekDates[0] - new Date(weekDates[0].getFullYear(), 0, 1)) / 86400000 + new Date(weekDates[0].getFullYear(), 0, 1).getDay() + 1) / 7);

  return (
    <main className="main-padding" style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div className="mono" style={{ fontSize: 11, color: '#737373', letterSpacing: '0.15em', marginBottom: 8 }}>
          WEEK {weekNum} · {formatDateRange(weekDates).toUpperCase()}
        </div>
        <h1 className="hero-title display-font" style={{ fontSize: 'clamp(40px, 6vw, 68px)', fontWeight: 600, lineHeight: 1, margin: 0 }}>
          Plan the week<span style={{ color: '#FF4D2E' }}>,</span><br/>
          <span style={{ fontStyle: 'normal', fontFamily: 'Inter Tight', fontWeight: 700, letterSpacing: '-0.04em' }}>
            ship the day.
          </span>
        </h1>
      </div>

      <div className="stats-strip" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 0,
        marginBottom: 28, background: 'white', borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden',
      }}>
        <div style={{ padding: 20, borderRight: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginBottom: 8 }}>
            WEEK PROGRESS
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span className="stat-num" style={{ color: '#0A0A0A' }}>{completionPct}%</span>
            <span className="mono" style={{ fontSize: 11, color: '#737373' }}>{completedTasks}/{totalTasks}</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${completionPct}%` }} /></div>
        </div>
        <div style={{ padding: 20, borderRight: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Flame size={24} color={streak > 0 ? '#FF4D2E' : '#A3A3A3'} />
          <div>
            <div className="stat-num" style={{ color: streak > 0 ? '#FF4D2E' : '#A3A3A3' }}>{streak}</div>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginTop: 4 }}>DAY STREAK</div>
          </div>
        </div>
        <StatBox num={stats.workouts} label="Workouts" color="#FF4D2E" border />
        <StatBox num={stats.boxing} label="Boxing" color="#E11D48" border />
        <StatBox num={stats.office + stats.wfh} label="Work days" color="#0F172A" />
      </div>

      <div className="week-grid">
        {DAYS.map((day, idx) => {
          const tid = weekAssignments[idx];
          const template = tid ? getTemplate(tid) : null;
          const tasks = getDayTasks(idx);
          const oneTimeCount = (oneTimeTasks[idx] || []).length;
          const isToday = idx === todayIdx;
          const dayCompleted = tasks.filter(t => completed.has(completionKey(idx, t.id, t.isOneTime))).length;
          const dayPct = tasks.length > 0 ? (dayCompleted / tasks.length) * 100 : 0;
          const dateNum = weekDates[idx].getDate();

          return (
            <div
              key={day}
              className={`day-card ${!template && !oneTimeCount ? 'empty' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setShowDayDetail(idx)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <div>
                  <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em' }}>{day}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>{dateNum}</div>
                </div>
                {isToday && (
                  <span className="mono" style={{ fontSize: 9, padding: '3px 7px', background: '#FF4D2E', color: 'white', borderRadius: 4, letterSpacing: '0.1em', fontWeight: 600 }}>TODAY</span>
                )}
              </div>

              {(template || oneTimeCount > 0) ? (
                <>
                  {template ? (
                    <div className="template-chip" style={{ borderColor: template.accent, color: template.accent, marginBottom: 10 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: template.accent }} />
                      {template.name}
                    </div>
                  ) : (
                    <div className="template-chip" style={{ borderColor: 'rgba(0,0,0,0.15)', color: '#737373', marginBottom: 10 }}>
                      No template
                    </div>
                  )}

                  {tasks.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div className="progress-bar" style={{ height: 3 }}>
                        <div className="progress-fill" style={{ width: `${dayPct}%` }} />
                      </div>
                      <div className="mono" style={{ fontSize: 9, color: '#737373', marginTop: 4, letterSpacing: '0.1em' }}>
                        {dayCompleted}/{tasks.length} DONE
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {tasks.slice(0, 4).map(task => {
                      const cat = CATEGORY_STYLES[task.category];
                      const Icon = cat.icon;
                      const key = completionKey(idx, task.id, task.isOneTime);
                      const isComplete = completed.has(key);
                      return (
                        <div key={key} className={`task-row ${isComplete ? 'task-completed' : ''}`}>
                          <div className="task-icon" style={{ background: cat.bg, width: 22, height: 22 }}>
                            <Icon size={11} color={cat.color} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="task-title" style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {task.title}
                              {task.isOneTime && <span className="one-time-badge">1×</span>}
                            </div>
                            <div className="mono" style={{ fontSize: 9, color: '#737373' }}>{task.time}</div>
                          </div>
                          {isComplete && <Check size={12} color="#0A0A0A" />}
                        </div>
                      );
                    })}
                    {tasks.length > 4 && (
                      <div className="mono" style={{ fontSize: 10, color: '#737373', padding: '4px 10px', letterSpacing: '0.05em' }}>
                        + {tasks.length - 4} more
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#737373' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px dashed rgba(0,0,0,0.2)', display: 'grid', placeItems: 'center' }}>
                    <Plus size={18} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>Tap to plan</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showDayDetail !== null && (
        <DayDetailModal
          dayIdx={showDayDetail} templates={templates} weekAssignments={weekAssignments}
          setWeekAssignments={setWeekAssignments} tasks={getDayTasks(showDayDetail)}
          completed={completed} toggleComplete={toggleComplete} getTemplate={getTemplate}
          addOneTimeTask={addOneTimeTask} removeOneTimeTask={removeOneTimeTask}
          onClose={() => setShowDayDetail(null)} isToday={showDayDetail === todayIdx}
          dateNum={weekDates[showDayDetail].getDate()}
        />
      )}
    </main>
  );
}

function StatBox({ num, label, color, border }) {
  return (
    <div style={{ padding: 20, borderRight: border ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
      <div className="stat-num" style={{ color }}>{num}</div>
      <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginTop: 4 }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}

function DayDetailModal({
  dayIdx, templates, weekAssignments, setWeekAssignments, tasks, completed, toggleComplete,
  getTemplate, addOneTimeTask, removeOneTimeTask, onClose, isToday, dateNum,
}) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAddOneTime, setShowAddOneTime] = useState(false);
  const tid = weekAssignments[dayIdx];
  const template = tid ? getTemplate(tid) : null;
  const templateTasks = tasks.filter(t => !t.isOneTime);
  const oneTimes = tasks.filter(t => t.isOneTime);
  const dayCompleted = tasks.filter(t => completed.has(completionKey(dayIdx, t.id, t.isOneTime))).length;
  const dayPct = tasks.length > 0 ? Math.round((dayCompleted / tasks.length) * 100) : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em' }}>
              {isToday ? 'TODAY' : 'PLANNING'}
            </div>
            <h2 className="display-font" style={{ fontSize: 32, fontWeight: 600, margin: '4px 0 0 0' }}>
              {DAY_FULL[dayIdx]} {dateNum}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8 }}><X size={18} /></button>
        </div>

        {tasks.length > 0 && (
          <div style={{ marginTop: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em' }}>
                {dayCompleted} OF {tasks.length} COMPLETE
              </span>
              <span className="mono" style={{ fontSize: 10, color: '#0A0A0A', fontWeight: 600 }}>{dayPct}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${dayPct}%` }} /></div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em', fontWeight: 600 }}>TEMPLATE</span>
            <button onClick={() => setShowTemplatePicker(!showTemplatePicker)} className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>
              {template ? 'Change' : 'Assign'}
            </button>
          </div>

          {showTemplatePicker && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setWeekAssignments({ ...weekAssignments, [dayIdx]: t.id });
                    setShowTemplatePicker(false);
                  }}
                  style={{
                    padding: 10, borderRadius: 10, background: 'white', textAlign: 'left',
                    border: `1.5px solid ${tid === t.id ? t.accent : 'rgba(0,0,0,0.08)'}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <div style={{ width: 4, alignSelf: 'stretch', background: t.accent, borderRadius: 4, minHeight: 28 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                    <div className="mono" style={{ fontSize: 10, color: '#737373', marginTop: 1 }}>{t.tasks.length} tasks</div>
                  </div>
                  {tid === t.id && <Check size={14} color={t.accent} />}
                </button>
              ))}
              {tid && (
                <button
                  onClick={() => {
                    setWeekAssignments({ ...weekAssignments, [dayIdx]: null });
                    setShowTemplatePicker(false);
                  }}
                  style={{ padding: 10, borderRadius: 10, color: '#737373', fontSize: 12, border: '1.5px dashed rgba(0,0,0,0.15)', fontWeight: 500 }}
                >
                  Clear template
                </button>
              )}
            </div>
          )}

          {template && !showTemplatePicker && (
            <div className="template-chip" style={{ borderColor: template.accent, color: template.accent }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: template.accent }} />
              {template.name}
            </div>
          )}
        </div>

        {templateTasks.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="section-divider">
              <Calendar size={11} color="#737373" />
              <span className="section-divider-label">FROM TEMPLATE</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {templateTasks.map(task => (
                <TaskCheckRow
                  key={task.id} task={task}
                  isComplete={completed.has(completionKey(dayIdx, task.id, false))}
                  onToggle={() => toggleComplete(completionKey(dayIdx, task.id, false))}
                />
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div className="section-divider">
            <Sparkles size={11} color="#737373" />
            <span className="section-divider-label">ONE-TIME TASKS</span>
          </div>

          {oneTimes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {oneTimes.map(task => (
                <TaskCheckRow
                  key={task.id} task={task}
                  isComplete={completed.has(completionKey(dayIdx, task.id, true))}
                  onToggle={() => toggleComplete(completionKey(dayIdx, task.id, true))}
                  onRemove={() => removeOneTimeTask(dayIdx, task.id)}
                />
              ))}
            </div>
          )}

          {showAddOneTime ? (
            <OneTimeComposer
              onSave={(task) => { addOneTimeTask(dayIdx, task); setShowAddOneTime(false); }}
              onCancel={() => setShowAddOneTime(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddOneTime(true)}
              style={{
                marginTop: 10, width: '100%', padding: 12, borderRadius: 12,
                border: '1.5px dashed rgba(0,0,0,0.15)', color: '#525252',
                fontSize: 13, fontWeight: 500, display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0A0A0A'; e.currentTarget.style.color = '#0A0A0A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; e.currentTarget.style.color = '#525252'; }}
            >
              <Plus size={14} /> Add one-time task
            </button>
          )}
        </div>

        {tasks.length === 0 && !showAddOneTime && !showTemplatePicker && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#737373' }}>
            <p style={{ fontSize: 13, margin: 0 }}>Nothing planned. Assign a template or add a one-time task above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCheckRow({ task, isComplete, onToggle, onRemove }) {
  const cat = CATEGORY_STYLES[task.category];
  const Icon = cat.icon;
  const [justChecked, setJustChecked] = useState(false);

  const handleToggle = () => {
    if (!isComplete) {
      setJustChecked(true);
      setTimeout(() => setJustChecked(false), 300);
    }
    onToggle();
  };

  return (
    <div className={`task-row ${isComplete ? 'task-completed' : ''}`} style={{ padding: '10px 12px' }}>
      <button
        className={`checkbox ${isComplete ? 'checked-accent' : ''} ${justChecked ? 'check-pop' : ''}`}
        onClick={handleToggle}
        aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
      >
        {isComplete && <Check size={13} color="white" strokeWidth={3} />}
      </button>
      <span className="mono" style={{ fontSize: 11, color: '#737373', width: 42 }}>{task.time}</span>
      <div className="task-icon" style={{ background: cat.bg, width: 26, height: 26 }}>
        <Icon size={12} color={cat.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="task-title" style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          {task.title}
          {task.isOneTime && <span className="one-time-badge">1×</span>}
        </div>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="btn-ghost" style={{ padding: 4, color: '#A3A3A3' }}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function OneTimeComposer({ onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [category, setCategory] = useState('break');

  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), time, category });
  };

  return (
    <div style={{ marginTop: 10, padding: 14, background: 'rgba(0,0,0,0.03)', borderRadius: 14, animation: 'slideUp 0.2s ease' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {Object.entries(CATEGORY_STYLES).map(([key, cat]) => {
          const Icon = cat.icon;
          return (
            <button
              key={key}
              onClick={() => setCategory(key)}
              style={{
                padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: category === key ? cat.color : cat.bg,
                color: category === key ? 'white' : cat.color,
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={11} />
              {cat.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          className="input" autoFocus value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }}
          placeholder="What needs doing?" style={{ flex: 1 }}
        />
        <input
          className="input" type="time" value={time}
          onChange={(e) => setTime(e.target.value)} style={{ width: 110 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} className="btn-ghost" style={{ fontSize: 12 }}>Cancel</button>
        <button onClick={save} className="btn-primary" style={{ fontSize: 12, padding: '8px 14px' }}>
          <Check size={14} /> Add task
        </button>
      </div>
    </div>
  );
}

function TemplatesView({ templates, setTemplates, editingTemplate, setEditingTemplate, creatingTemplate, setCreatingTemplate, resetData }) {
  const handleDelete = (id) => setTemplates(templates.filter(t => t.id !== id));
  const handleDuplicate = (t) => {
    const newT = {
      ...t, id: `t${Date.now()}`, name: `${t.name} (copy)`,
      tasks: t.tasks.map(task => ({ ...task, id: `task${Date.now()}-${Math.random()}` })),
    };
    setTemplates([...templates, newT]);
  };

  return (
    <main className="main-padding" style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: '#737373', letterSpacing: '0.15em', marginBottom: 8 }}>
            YOUR LIBRARY
          </div>
          <h1 className="hero-title display-font" style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 600, lineHeight: 1, margin: 0 }}>
            Day templates
          </h1>
          <p style={{ color: '#525252', fontSize: 15, margin: '8px 0 0 0', maxWidth: 500 }}>
            Build reusable patterns. Edit once, propagate everywhere.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={resetData} style={{ fontSize: 12 }}>Reset data</button>
          <button className="btn-primary" onClick={() => setCreatingTemplate(true)}>
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      <div className="templates-grid">
        {templates.map(t => (
          <div key={t.id} style={{
            background: 'white', borderRadius: 20, padding: 22,
            border: '1px solid rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: t.accent }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{t.name}</h3>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn-ghost" style={{ padding: 6 }} onClick={() => setEditingTemplate(t)}><Edit2 size={14} /></button>
                <button className="btn-ghost" style={{ padding: 6 }} onClick={() => handleDuplicate(t)}><Copy size={14} /></button>
                <button className="btn-ghost" style={{ padding: 6, color: '#DC2626' }} onClick={() => handleDelete(t.id)}><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em', marginBottom: 10 }}>
              {t.tasks.length} TASKS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {t.tasks.map(task => {
                const cat = CATEGORY_STYLES[task.category];
                const Icon = cat.icon;
                return (
                  <div key={task.id} className="task-row">
                    <div className="mono" style={{ fontSize: 10, color: '#737373', width: 40 }}>{task.time}</div>
                    <div className="task-icon" style={{ background: cat.bg, width: 24, height: 24 }}>
                      <Icon size={12} color={cat.color} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{task.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {(editingTemplate || creatingTemplate) && (
        <TemplateEditor
          template={editingTemplate}
          onSave={(updated) => {
            if (editingTemplate) {
              setTemplates(templates.map(t => t.id === updated.id ? updated : t));
            } else {
              setTemplates([...templates, { ...updated, id: `t${Date.now()}` }]);
            }
            setEditingTemplate(null);
            setCreatingTemplate(false);
          }}
          onClose={() => { setEditingTemplate(null); setCreatingTemplate(false); }}
        />
      )}
    </main>
  );
}

function TemplateEditor({ template, onSave, onClose }) {
  const [name, setName] = useState(template?.name || '');
  const [accent, setAccent] = useState(template?.accent || '#FF4D2E');
  const [tasks, setTasks] = useState(template?.tasks || []);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('09:00');
  const [newTaskCat, setNewTaskCat] = useState('workout');

  const ACCENT_OPTIONS = ['#FF4D2E', '#E11D48', '#0F172A', '#0891B2', '#A16207', '#7C3AED'];

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    setTasks([...tasks, { id: `task${Date.now()}`, title: newTaskTitle, time: newTaskTime, category: newTaskCat }]
      .sort((a, b) => a.time.localeCompare(b.time)));
    setNewTaskTitle('');
  };
  const removeTask = (id) => setTasks(tasks.filter(t => t.id !== id));
  const save = () => {
    if (!name.trim()) return;
    onSave({ id: template?.id, name: name.trim(), accent, tasks });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em' }}>
              {template ? 'EDITING' : 'NEW TEMPLATE'}
            </div>
            <h2 className="display-font" style={{ fontSize: 28, fontWeight: 600, margin: '4px 0 0 0' }}>
              Build a routine
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8 }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
            TEMPLATE NAME
          </label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Heavy Training Day" />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em', display: 'block', marginBottom: 8 }}>
            ACCENT COLOR
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {ACCENT_OPTIONS.map(c => (
              <button
                key={c}
                onClick={() => setAccent(c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', background: c,
                  border: accent === c ? '3px solid white' : '3px solid transparent',
                  outline: accent === c ? `2px solid ${c}` : 'none',
                  transition: 'transform 0.1s ease',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em', display: 'block', marginBottom: 8 }}>
            TASKS
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {tasks.map(task => {
              const cat = CATEGORY_STYLES[task.category];
              const Icon = cat.icon;
              return (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  background: 'white', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)',
                }}>
                  <GripVertical size={14} color="#A3A3A3" />
                  <span className="mono" style={{ fontSize: 11, color: '#737373', width: 36 }}>{task.time}</span>
                  <div className="task-icon" style={{ background: cat.bg, width: 24, height: 24 }}>
                    <Icon size={12} color={cat.color} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{task.title}</span>
                  <button onClick={() => removeTask(task.id)} className="btn-ghost" style={{ padding: 4 }}><X size={14} /></button>
                </div>
              );
            })}
          </div>

          <div style={{ padding: 12, background: 'rgba(0,0,0,0.03)', borderRadius: 12 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {Object.entries(CATEGORY_STYLES).map(([key, cat]) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setNewTaskCat(key)}
                    style={{
                      padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: newTaskCat === key ? cat.color : cat.bg,
                      color: newTaskCat === key ? 'white' : cat.color,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={11} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input" value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Task title..." style={{ flex: 1 }}
              />
              <input
                className="input" type="time" value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)} style={{ width: 110 }}
              />
              <button className="btn-primary" onClick={addTask} style={{ padding: '10px 14px' }}><Plus size={16} /></button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}><Check size={16} /> Save Template</button>
        </div>
      </div>
    </div>
  );
}
