import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, X, Edit2, Copy, Trash2, Dumbbell, Home, Building2, Zap, Coffee, Sparkles,
  GripVertical, Check, Calendar, Flame, LayoutGrid, Library, LogOut, BarChart3,
  Minus, Settings, TrendingUp, Scale, Target, Hand, Goal,
} from 'lucide-react';
import { supabase } from './supabaseClient';
import * as db from './supabaseData';
import { dateKey, getWeekStart, addDays } from './supabaseData';

const CATEGORY_STYLES = {
  workout:  { icon: Dumbbell, label: 'Gym',        color: '#FF4D2E', bg: 'rgba(255, 77, 46, 0.08)' },
  boxing:   { icon: Zap,      label: 'Boxing',     color: '#E11D48', bg: 'rgba(225, 29, 72, 0.08)' },
  jiujitsu: { icon: Hand,     label: 'Jiu-Jitsu',  color: '#1E40AF', bg: 'rgba(30, 64, 175, 0.08)' },
  football: { icon: Goal,     label: 'Football',   color: '#16A34A', bg: 'rgba(22, 163, 74, 0.08)' },
  office:   { icon: Building2,label: 'Office',     color: '#0F172A', bg: 'rgba(15, 23, 42, 0.06)' },
  wfh:      { icon: Home,     label: 'WFH',        color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
  break:    { icon: Coffee,   label: 'Personal',   color: '#A16207', bg: 'rgba(161, 98, 7, 0.08)' },
  custom:   { icon: Sparkles, label: 'Custom',     color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.08)' },
};

// Categories that aggregate into the "Workouts" counter
const WORKOUT_CATEGORIES = ['workout', 'boxing', 'jiujitsu', 'football'];

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const completionKey = (dKey, taskId, isOneTime = false) =>
  isOneTime ? `${dKey}:oo:${taskId}` : `${dKey}:${taskId}`;

const formatTime = (time, endTime) => endTime ? `${time}–${endTime}` : time;

function parseHHMM(s) {
  if (!s || typeof s !== 'string') return null;
  const [h, m] = s.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function taskDurationMinutes(task) {
  const start = parseHHMM(task.time);
  const end = parseHHMM(task.endTime);
  if (start === null || end === null) return 0;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60; // handle overnight (e.g. 23:00 → 01:00)
  return diff;
}

function formatHM(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getWeekDates() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIdx = today.getDay();
  const sunday = getWeekStart(today);
  const dates = [];
  for (let i = 0; i < 7; i++) dates.push(addDays(sunday, i));
  return { dates, todayIdx, today };
}

function formatDateRange(dates) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const f = dates[0], l = dates[6];
  const fs = `${months[f.getMonth()]} ${f.getDate()}`;
  const ls = f.getMonth() === l.getMonth() ? `${l.getDate()}` : `${months[l.getMonth()]} ${l.getDate()}`;
  return `${fs} — ${ls}`;
}

function heroPhrase(pct, anyTasks) {
  if (!anyTasks) return { lead: 'Plan today', tail: '.' };
  if (pct >= 100) return { lead: 'Crushed it', tail: '.' };
  if (pct >= 50)  return { lead: 'Halfway there', tail: '.' };
  if (pct > 0)   return { lead: "Let's go", tail: '.' };
  return { lead: 'Plan today', tail: '.' };
}

export default function ScheduleApp({ session }) {
  const userId = session.user.id;
  const [loaded, setLoaded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [weekAssignments, setWeekAssignments] = useState({});
  const [oneTimeTasks, setOneTimeTasks] = useState({});  // { [dateKey]: Task[] }
  const [completed, setCompleted] = useState(new Set()); // Set<completionKey>
  const [goals, setGoalsState] = useState({ workouts: 4, boxing: 2, office: 3, wfh: 2 });
  const [customGoals, setCustomGoals] = useState([]);
  const [weightEntries, setWeightEntries] = useState([]); // [{date, weight}]
  const [view, setView] = useState('week');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showDayDetail, setShowDayDetail] = useState(null); // dateKey | null
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);

  const { dates: weekDates, todayIdx, today } = getWeekDates();
  const todayKey = dateKey(today);

  useEffect(() => {
    async function loadAll() {
      try {
        const isFirst = await db.isFirstTimeUser(userId);
        if (isFirst) {
          setSeeding(true);
          await db.seedMockHistory(userId);
          setSeeding(false);
        }
        const [t, wa, ot, c, g, cg, we] = await Promise.all([
          db.fetchTemplates(),
          db.fetchWeekAssignments(),
          db.fetchOneTimeTasks(),
          db.fetchCompletions(),
          db.fetchGoals(userId),
          db.fetchCustomGoals(userId),
          db.fetchWeightEntries(userId, 365),
        ]);
        setTemplates(t); setWeekAssignments(wa); setOneTimeTasks(ot);
        setCompleted(c); setGoalsState(g);
        setCustomGoals(cg); setWeightEntries(we);
      } catch (e) { console.error('Load failed:', e); }
      setLoaded(true);
    }
    loadAll();
  }, [userId]);

  const getTemplate = (id) => templates.find(t => t.id === id);

  const toggleComplete = async (dKey, taskId, isOneTime) => {
    const key = completionKey(dKey, taskId, isOneTime);
    const next = new Set(completed);
    const isComplete = next.has(key);
    if (isComplete) next.delete(key); else next.add(key);
    setCompleted(next);
    try {
      await db.toggleCompletion(dKey, taskId, isOneTime, isComplete, userId);
    } catch (e) { console.error('Toggle failed:', e); }
  };

  const addOneTimeTask = async (dKey, task) => {
    try {
      const saved = await db.addOneTimeTask(dKey, task, userId);
      const existing = oneTimeTasks[dKey] || [];
      setOneTimeTasks({
        ...oneTimeTasks,
        [dKey]: [...existing, saved].sort((a, b) => a.time.localeCompare(b.time)),
      });
    } catch (e) { console.error('Add one-time failed:', e); }
  };

  const removeOneTimeTask = async (dKey, taskId) => {
    const existing = oneTimeTasks[dKey] || [];
    setOneTimeTasks({ ...oneTimeTasks, [dKey]: existing.filter(t => t.id !== taskId) });
    const ck = completionKey(dKey, taskId, true);
    if (completed.has(ck)) {
      const next = new Set(completed); next.delete(ck); setCompleted(next);
    }
    try { await db.removeOneTimeTask(taskId); } catch (e) { console.error('Remove failed:', e); }
  };

  const updateOneTimeTask = async (dKey, taskId, patch) => {
    const existing = oneTimeTasks[dKey] || [];
    const optimistic = existing
      .map(t => t.id === taskId ? { ...t, ...patch } : t)
      .sort((a, b) => a.time.localeCompare(b.time));
    setOneTimeTasks({ ...oneTimeTasks, [dKey]: optimistic });
    try { await db.updateOneTimeTask(taskId, patch); }
    catch (e) { console.error('Update one-time failed:', e); }
  };

  const updateTemplateTask = async (templateId, taskId, patch) => {
    const tpl = getTemplate(templateId);
    if (!tpl) return;
    const updatedTasks = tpl.tasks
      .map(t => t.id === taskId ? { ...t, ...patch } : t)
      .sort((a, b) => a.time.localeCompare(b.time));
    // Optimistic
    setTemplates(templates.map(t => t.id === templateId ? { ...t, tasks: updatedTasks } : t));
    try {
      await db.upsertTemplate({ id: templateId, name: tpl.name, accent: tpl.accent, tasks: updatedTasks }, userId);
    } catch (e) { console.error('Update template task failed:', e); }
  };

  const handleSetWeekAssignments = async (newAssignments) => {
    for (let i = 0; i < 7; i++) {
      if (newAssignments[i] !== weekAssignments[i]) {
        try { await db.setWeekAssignment(i, newAssignments[i], userId); }
        catch (e) { console.error('Assign failed:', e); }
      }
    }
    setWeekAssignments(newAssignments);
  };

  const handleSaveGoals = async (newGoals) => {
    setGoalsState(newGoals);
    try { await db.saveGoals(newGoals, userId); }
    catch (e) { console.error('Save goals failed:', e); }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  // ---- Custom goals handlers ----
  const handleAddCustomGoal = async (goal) => {
    try {
      const saved = await db.addCustomGoal(userId, { ...goal, sortOrder: customGoals.length });
      setCustomGoals([...customGoals, saved]);
    } catch (e) { console.error('Add custom goal failed:', e); }
  };
  const handleUpdateCustomGoal = async (id, patch) => {
    setCustomGoals(customGoals.map(g => g.id === id ? { ...g, ...patch } : g));
    try { await db.updateCustomGoal(id, patch); }
    catch (e) { console.error('Update custom goal failed:', e); }
  };
  const handleDeleteCustomGoal = async (id) => {
    setCustomGoals(customGoals.filter(g => g.id !== id));
    try { await db.deleteCustomGoal(id); }
    catch (e) { console.error('Delete custom goal failed:', e); }
  };

  // ---- Weight handlers ----
  const handleSaveWeight = async (entryDate, weightKg) => {
    // Optimistic update first so UI never lands in an inconsistent state
    setWeightEntries(prev => {
      const filtered = prev.filter(w => w.date !== entryDate);
      return [...filtered, { date: entryDate, weight: weightKg }]
        .sort((a, b) => a.date.localeCompare(b.date));
    });
    try {
      await db.upsertWeightEntry(userId, entryDate, weightKg);
    } catch (e) {
      console.error('Save weight failed:', e);
      alert('Could not save weight. Please try again.');
    }
  };
  const handleDeleteWeight = async (entryDate) => {
    setWeightEntries(prev => prev.filter(w => w.date !== entryDate));
    try { await db.deleteWeightEntry(userId, entryDate); }
    catch (e) { console.error('Delete weight failed:', e); }
  };

  const resetData = async () => {
    if (!confirm('Reset all data? This deletes everything and reseeds with demo data.')) return;
    try {
      await db.clearAllUserData(userId);
      setSeeding(true);
      await db.seedMockHistory(userId);
      setSeeding(false);
      const [t, wa, ot, c] = await Promise.all([
        db.fetchTemplates(), db.fetchWeekAssignments(),
        db.fetchOneTimeTasks(), db.fetchCompletions(),
      ]);
      setTemplates(t); setWeekAssignments(wa); setOneTimeTasks(ot); setCompleted(c);
    } catch (e) { console.error('Reset failed:', e); }
  };

  // Get tasks for a specific date
  const getTasksForDate = (dKey, dow) => {
    const tid = weekAssignments[dow];
    const tplTasks = tid ? (getTemplate(tid)?.tasks || []).map(t => ({ ...t, isOneTime: false })) : [];
    const oneTimes = (oneTimeTasks[dKey] || []).map(t => ({ ...t, isOneTime: true }));
    return [...tplTasks, ...oneTimes].sort((a, b) => a.time.localeCompare(b.time));
  };

  // Today's progress for hero phrase
  const todayTasks = getTasksForDate(todayKey, todayIdx);
  const todayDone = todayTasks.filter(t => completed.has(completionKey(todayKey, t.id, t.isOneTime))).length;
  const todayPct = todayTasks.length > 0 ? Math.round((todayDone / todayTasks.length) * 100) : 0;
  const hero = heroPhrase(todayPct, todayTasks.length > 0);

  if (!loaded || seeding) {
    return (
      <div style={{
        minHeight: '100vh', background: '#FAFAF7',
        display: 'grid', placeItems: 'center',
        fontFamily: "'Inter Tight', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 11, color: '#737373', letterSpacing: '0.2em' }}>
            {seeding ? 'SETTING UP YOUR ROUTINE…' : 'LOADING…'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#FAFAF7',
      fontFamily: "'Inter Tight', system-ui, sans-serif", color: '#0A0A0A',
      paddingBottom: 90,
    }}>
      <GlobalStyles />

      <header className="header-padding" style={{
        padding: '20px 32px', borderBottom: '1px solid rgba(0,0,0,0.06)',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <nav className="desktop-nav" style={{ gap: 4, background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 999 }}>
            <button className={`pill-tab ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Week</button>
            <button className={`pill-tab ${view === 'stats' ? 'active' : ''}`} onClick={() => setView('stats')}>Stats</button>
            <button className={`pill-tab ${view === 'templates' ? 'active' : ''}`} onClick={() => setView('templates')}>Templates</button>
          </nav>
          <button onClick={handleSignOut} className="btn-ghost" style={{ padding: 8, color: '#737373' }} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {view === 'week' && (
        <WeekView
          templates={templates} weekAssignments={weekAssignments}
          setWeekAssignments={handleSetWeekAssignments}
          oneTimeTasks={oneTimeTasks} completed={completed}
          toggleComplete={toggleComplete} getTemplate={getTemplate}
          showDayDetail={showDayDetail} setShowDayDetail={setShowDayDetail}
          addOneTimeTask={addOneTimeTask} removeOneTimeTask={removeOneTimeTask}
          updateOneTimeTask={updateOneTimeTask} updateTemplateTask={updateTemplateTask}
          weekDates={weekDates} todayIdx={todayIdx} todayKey={todayKey}
          hero={hero}
        />
      )}
      {view === 'stats' && (
        <StatsView
          templates={templates} weekAssignments={weekAssignments}
          oneTimeTasks={oneTimeTasks} completed={completed}
          getTemplate={getTemplate} goals={goals}
          onSaveGoals={handleSaveGoals}
          customGoals={customGoals}
          onAddCustomGoal={handleAddCustomGoal}
          onUpdateCustomGoal={handleUpdateCustomGoal}
          onDeleteCustomGoal={handleDeleteCustomGoal}
          weightEntries={weightEntries}
          onSaveWeight={handleSaveWeight}
          onDeleteWeight={handleDeleteWeight}
          todayKey={todayKey}
          onEditGoals={() => setEditingGoals(true)}
        />
      )}
      {view === 'templates' && (
        <TemplatesView
          templates={templates} setTemplates={setTemplates}
          editingTemplate={editingTemplate} setEditingTemplate={setEditingTemplate}
          creatingTemplate={creatingTemplate} setCreatingTemplate={setCreatingTemplate}
          resetData={resetData} userId={userId}
        />
      )}

      {/* Mobile bottom nav: Week / Stats / + / Templates */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-tab ${view === 'week' ? 'active' : ''}`}
          onClick={() => setView('week')}
          aria-label="Week"
        >
          <LayoutGrid size={20} />
          <span className="mobile-nav-label">Week</span>
        </button>
        <button
          className={`mobile-nav-tab ${view === 'stats' ? 'active' : ''}`}
          onClick={() => setView('stats')}
          aria-label="Stats"
        >
          <BarChart3 size={20} />
          <span className="mobile-nav-label">Stats</span>
        </button>
        <button
          className="mobile-nav-tab fab"
          onClick={() => { setView('week'); setShowDayDetail(todayKey); }}
          aria-label="Quick add to today"
        >
          <Plus size={26} strokeWidth={2.6} />
        </button>
        <button
          className={`mobile-nav-tab ${view === 'templates' ? 'active' : ''}`}
          onClick={() => setView('templates')}
          aria-label="Templates"
        >
          <Library size={20} />
          <span className="mobile-nav-label">Templates</span>
        </button>
      </nav>

      {editingGoals && (
        <GoalsEditor goals={goals} onSave={(g) => { handleSaveGoals(g); setEditingGoals(false); }}
                     onClose={() => setEditingGoals(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week View
// ---------------------------------------------------------------------------

function WeekView({
  templates, weekAssignments, setWeekAssignments, oneTimeTasks, completed,
  toggleComplete, getTemplate, showDayDetail, setShowDayDetail,
  addOneTimeTask, removeOneTimeTask, updateOneTimeTask, updateTemplateTask,
  weekDates, todayIdx, todayKey, hero,
}) {
  const carouselRef = useRef(null);
  const dayRefs = useRef([]);

  // Scroll today into view on mobile load
  useEffect(() => {
    if (window.innerWidth < 700 && dayRefs.current[todayIdx]) {
      dayRefs.current[todayIdx].scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'start' });
    }
  }, [todayIdx]);

  const getDayTasks = (dKey, dow) => {
    const tid = weekAssignments[dow];
    const tpl = tid ? (getTemplate(tid)?.tasks || []).map(t => ({ ...t, isOneTime: false })) : [];
    const oo = (oneTimeTasks[dKey] || []).map(t => ({ ...t, isOneTime: true }));
    return [...tpl, ...oo].sort((a, b) => a.time.localeCompare(b.time));
  };

  // Week-level stats — count per category, then derive aggregates
  const catCounts = { workout: 0, boxing: 0, jiujitsu: 0, football: 0, office: 0, wfh: 0, break: 0, custom: 0 };
  let totalTasks = 0, completedTasks = 0;
  weekDates.forEach((d, idx) => {
    const dKey = dateKey(d);
    const tasks = getDayTasks(dKey, idx);
    tasks.forEach(task => {
      totalTasks++;
      const k = completionKey(dKey, task.id, task.isOneTime);
      if (completed.has(k)) completedTasks++;
      if (catCounts[task.category] !== undefined) catCounts[task.category]++;
    });
  });
  const workoutsAgg = WORKOUT_CATEGORIES.reduce((s, c) => s + (catCounts[c] || 0), 0);
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Streak: consecutive days from today backward where day.done === day.total (skip empty days)
  const streak = (() => {
    let count = 0;
    for (let i = todayIdx; i >= 0; i--) {
      const dKey = dateKey(weekDates[i]);
      const tasks = getDayTasks(dKey, i);
      if (tasks.length === 0) continue;
      const allDone = tasks.every(t => completed.has(completionKey(dKey, t.id, t.isOneTime)));
      if (allDone) count++; else break;
    }
    return count;
  })();

  const weekNum = Math.ceil(((weekDates[0] - new Date(weekDates[0].getFullYear(), 0, 1)) / 86400000
                  + new Date(weekDates[0].getFullYear(), 0, 1).getDay() + 1) / 7);

  // Configurable week-progress tiles
  const TILE_DEFS = {
    workouts:  { label: 'Workouts',   color: '#FF4D2E', value: workoutsAgg },
    gym:       { label: 'Gym',        color: '#FF4D2E', value: catCounts.workout },
    boxing:    { label: 'Boxing',     color: '#E11D48', value: catCounts.boxing },
    jiujitsu:  { label: 'Jiu-Jitsu',  color: '#1E40AF', value: catCounts.jiujitsu },
    football:  { label: 'Football',   color: '#16A34A', value: catCounts.football },
    work_days: { label: 'Work days',  color: '#0F172A', value: catCounts.office + catCounts.wfh },
    office:    { label: 'Office',     color: '#0F172A', value: catCounts.office },
    wfh:       { label: 'WFH',        color: '#0891B2', value: catCounts.wfh },
    personal:  { label: 'Personal',   color: '#A16207', value: catCounts.break },
  };
  const DEFAULT_TILES = ['workouts', 'boxing', 'work_days'];
  const [tileKeys, setTileKeys] = useState(() => {
    try {
      const raw = localStorage.getItem('routine:weekTiles:v1');
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TILES;
    } catch { return DEFAULT_TILES; }
  });
  const [showTilePicker, setShowTilePicker] = useState(false);
  const updateTiles = (next) => {
    setTileKeys(next);
    try { localStorage.setItem('routine:weekTiles:v1', JSON.stringify(next)); } catch {}
  };
  const toggleTile = (key) => {
    const next = tileKeys.includes(key) ? tileKeys.filter(k => k !== key) : [...tileKeys, key];
    updateTiles(next);
  };

  return (
    <main className="main-padding" style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{ fontSize: 11, color: '#737373', letterSpacing: '0.15em', marginBottom: 8 }}>
          WEEK {weekNum} · {formatDateRange(weekDates).toUpperCase()}
        </div>
        <h1 className="hero-title display-font" style={{
          fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 600, lineHeight: 1, margin: 0,
        }}>
          {hero.lead}<span style={{ color: '#FF4D2E' }}>{hero.tail}</span>
        </h1>
      </div>

      <div className="stats-strip" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 0,
        marginBottom: 24, background: 'white', borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden', position: 'relative',
      }}>
        <div style={{ padding: 18, borderRight: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginBottom: 8 }}>
            WEEK PROGRESS
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span className="stat-num">{completionPct}%</span>
            <span className="mono" style={{ fontSize: 11, color: '#737373' }}>{completedTasks}/{totalTasks}</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${completionPct}%` }} /></div>
        </div>
        <div style={{ padding: 18, borderRight: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Flame size={22} color={streak > 0 ? '#FF4D2E' : '#A3A3A3'} />
          <div>
            <div className="stat-num" style={{ color: streak > 0 ? '#FF4D2E' : '#A3A3A3' }}>{streak}</div>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginTop: 4 }}>DAY STREAK</div>
          </div>
        </div>
        {tileKeys.map((k, i) => {
          const t = TILE_DEFS[k];
          if (!t) return null;
          const isLast = i === tileKeys.length - 1;
          return <StatBox key={k} num={t.value} label={t.label} color={t.color} border={!isLast} />;
        })}
        <button
          className="btn-ghost" onClick={() => setShowTilePicker(v => !v)}
          aria-label="Customize week progress tiles"
          style={{
            position: 'absolute', top: 8, right: 8, padding: 6,
            color: '#A3A3A3', borderRadius: 999,
          }}
        >
          <Settings size={14} />
        </button>
        {showTilePicker && (
          <div className="tile-picker">
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em', marginBottom: 10, fontWeight: 600 }}>
              SHOW IN WEEK PROGRESS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(TILE_DEFS).map(([key, def]) => {
                const checked = tileKeys.includes(key);
                return (
                  <label key={key} className="tile-picker-row">
                    <input type="checkbox" checked={checked} onChange={() => toggleTile(key)} />
                    <span className="tile-picker-dot" style={{ background: def.color }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{def.label}</span>
                    <span className="mono" style={{ fontSize: 10, color: '#737373' }}>{def.value}</span>
                  </label>
                );
              })}
            </div>
            <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 10px', marginTop: 10 }}
                    onClick={() => updateTiles(DEFAULT_TILES)}>Reset to default</button>
          </div>
        )}
      </div>

      <div className="week-grid" ref={carouselRef}>
        {DAYS.map((day, idx) => {
          const date = weekDates[idx];
          const dKey = dateKey(date);
          const tid = weekAssignments[idx];
          const template = tid ? getTemplate(tid) : null;
          const tasks = getDayTasks(dKey, idx);
          const oneTimeCount = (oneTimeTasks[dKey] || []).length;
          const isToday = idx === todayIdx;
          const dayDone = tasks.filter(t => completed.has(completionKey(dKey, t.id, t.isOneTime))).length;
          const dayPct = tasks.length > 0 ? (dayDone / tasks.length) * 100 : 0;

          return (
            <div
              key={day}
              ref={(el) => { dayRefs.current[idx] = el; }}
              className={`day-card ${!template && !oneTimeCount ? 'empty' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setShowDayDetail(dKey)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <div>
                  <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em' }}>{day}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>{date.getDate()}</div>
                </div>
                {isToday && (
                  <span className="mono" style={{
                    fontSize: 9, padding: '3px 7px', background: '#FF4D2E',
                    color: 'white', borderRadius: 4, letterSpacing: '0.1em', fontWeight: 600,
                  }}>TODAY</span>
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
                        {dayDone}/{tasks.length} DONE
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {tasks.slice(0, 3).map(task => {
                      const cat = CATEGORY_STYLES[task.category];
                      const Icon = cat.icon;
                      const k = completionKey(dKey, task.id, task.isOneTime);
                      const isComplete = completed.has(k);
                      return (
                        <div
                          key={k}
                          className={`task-row mini-task ${isComplete ? 'task-completed' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleComplete(dKey, task.id, task.isOneTime); }}
                          role="button"
                          aria-label={`${isComplete ? 'Uncheck' : 'Check'} ${task.title}`}
                        >
                          <span className={`mini-check ${isComplete ? 'mini-check-on' : ''}`}>
                            {isComplete && <Check size={10} color="white" strokeWidth={3} />}
                          </span>
                          <div className="task-icon" style={{ background: cat.bg, width: 22, height: 22 }}>
                            <Icon size={11} color={cat.color} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="task-title" style={{
                              fontSize: 12, fontWeight: 500, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                              {task.title}
                              {task.isOneTime && <span className="one-time-badge">1×</span>}
                            </div>
                            <div className="mono" style={{ fontSize: 9, color: '#737373' }}>{formatTime(task.time, task.endTime)}</div>
                          </div>
                        </div>
                      );
                    })}
                    {tasks.length > 3 && (
                      <div className="mono" style={{ fontSize: 10, color: '#737373', padding: '4px 10px', letterSpacing: '0.05em' }}>
                        + {tasks.length - 3} more
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#737373' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', border: '1.5px dashed rgba(0,0,0,0.2)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <Plus size={18} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>Tap to plan</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showDayDetail !== null && (() => {
        const dKey = showDayDetail;
        const dow = new Date(dKey + 'T00:00:00').getDay();
        const dateNum = new Date(dKey + 'T00:00:00').getDate();
        return (
          <DayDetailSheet
            dateKey={dKey} dow={dow} dateNum={dateNum} isToday={dKey === todayKey}
            templates={templates} weekAssignments={weekAssignments}
            setWeekAssignments={setWeekAssignments}
            tasks={getDayTasks(dKey, dow)}
            completed={completed} toggleComplete={toggleComplete} getTemplate={getTemplate}
            addOneTimeTask={addOneTimeTask} removeOneTimeTask={removeOneTimeTask}
            updateOneTimeTask={updateOneTimeTask} updateTemplateTask={updateTemplateTask}
            onClose={() => setShowDayDetail(null)}
          />
        );
      })()}
    </main>
  );
}

function StatBox({ num, label, color, border }) {
  return (
    <div style={{ padding: 18, borderRight: border ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
      <div className="stat-num" style={{ color }}>{num}</div>
      <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginTop: 4 }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Detail (modal on desktop, bottom sheet on mobile)
// ---------------------------------------------------------------------------

function DayDetailSheet({
  dateKey: dKey, dow, dateNum, isToday, templates, weekAssignments, setWeekAssignments,
  tasks, completed, toggleComplete, getTemplate, addOneTimeTask, removeOneTimeTask,
  updateOneTimeTask, updateTemplateTask, onClose,
}) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAddOneTime, setShowAddOneTime] = useState(false);
  const tid = weekAssignments[dow];
  const template = tid ? getTemplate(tid) : null;
  const templateTasks = tasks.filter(t => !t.isOneTime);
  const oneTimes = tasks.filter(t => t.isOneTime);
  const dayDone = tasks.filter(t => completed.has(completionKey(dKey, t.id, t.isOneTime))).length;
  const dayPct = tasks.length > 0 ? Math.round((dayDone / tasks.length) * 100) : 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em' }}>
              {isToday ? 'TODAY' : 'PLANNING'}
            </div>
            <h2 className="display-font" style={{ fontSize: 30, fontWeight: 600, margin: '4px 0 0 0' }}>
              {DAY_FULL[dow]} {dateNum}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8 }}><X size={18} /></button>
        </div>

        {tasks.length > 0 && (
          <div style={{ marginTop: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em' }}>
                {dayDone} OF {tasks.length} COMPLETE
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
                    setWeekAssignments({ ...weekAssignments, [dow]: t.id });
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
                    setWeekAssignments({ ...weekAssignments, [dow]: null });
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
                <TaskCheckRow key={task.id} task={task}
                  isComplete={completed.has(completionKey(dKey, task.id, false))}
                  onToggle={() => toggleComplete(dKey, task.id, false)}
                  onSaveEdit={(patch) => updateTemplateTask(tid, task.id, patch)}
                  editHint={template ? `Edits the "${template.name}" template (applies to every day using it)` : null}
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
                <TaskCheckRow key={task.id} task={task}
                  isComplete={completed.has(completionKey(dKey, task.id, true))}
                  onToggle={() => toggleComplete(dKey, task.id, true)}
                  onRemove={() => removeOneTimeTask(dKey, task.id)}
                  onSaveEdit={(patch) => updateOneTimeTask(dKey, task.id, patch)}
                />
              ))}
            </div>
          )}

          {showAddOneTime ? (
            <OneTimeComposer
              onSave={(task) => { addOneTimeTask(dKey, task); setShowAddOneTime(false); }}
              onCancel={() => setShowAddOneTime(false)} />
          ) : (
            <button
              onClick={() => setShowAddOneTime(true)}
              style={{
                marginTop: 10, width: '100%', padding: 14, borderRadius: 12,
                border: '1.5px dashed rgba(0,0,0,0.15)', color: '#525252',
                fontSize: 14, fontWeight: 500, display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
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

function TaskCheckRow({ task, isComplete, onToggle, onRemove, onSaveEdit, editHint }) {
  const cat = CATEGORY_STYLES[task.category];
  const Icon = cat.icon;
  const [justChecked, setJustChecked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: task.title, time: task.time, endTime: task.endTime || '', category: task.category });

  const handleToggle = () => {
    if (!isComplete) {
      setJustChecked(true);
      setTimeout(() => setJustChecked(false), 300);
    }
    onToggle();
  };

  const beginEdit = () => {
    setDraft({ title: task.title, time: task.time, endTime: task.endTime || '', category: task.category });
    setEditing(true);
  };

  const saveEdit = () => {
    if (!draft.title.trim()) return;
    onSaveEdit({
      title: draft.title.trim(), time: draft.time,
      endTime: draft.endTime || null, category: draft.category,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ padding: 12, background: 'rgba(0,0,0,0.03)', borderRadius: 14 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {Object.entries(CATEGORY_STYLES).map(([key, c]) => {
            const I = c.icon;
            return (
              <button key={key} onClick={() => setDraft({ ...draft, category: key })} style={{
                padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: draft.category === key ? c.color : c.bg,
                color: draft.category === key ? 'white' : c.color,
              }}>
                <I size={11} /> {c.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <input className="input" autoFocus value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="Title" style={{ flex: 1, minWidth: 140 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input className="input" type="time" value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })} style={{ width: 110 }} />
            <span style={{ fontSize: 12, color: '#737373' }}>–</span>
            <input className="input" type="time" value={draft.endTime}
              onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} style={{ width: 110 }} />
          </div>
        </div>
        {editHint && (
          <div className="mono" style={{ fontSize: 10, color: '#A16207', marginBottom: 8, lineHeight: 1.4 }}>
            ⚠ {editHint}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={() => setEditing(false)} className="btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
          <button onClick={saveEdit} className="btn-primary" style={{ fontSize: 13, padding: '10px 16px' }}>
            <Check size={14} /> Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`task-row ${isComplete ? 'task-completed' : ''}`} style={{ padding: '10px 12px' }}>
      <button
        className={`checkbox ${isComplete ? 'checked-accent' : ''} ${justChecked ? 'check-pop' : ''}`}
        onClick={handleToggle}
        aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
      >
        {isComplete && <Check size={16} color="white" strokeWidth={3} />}
      </button>
      <span className="mono" style={{ fontSize: 11, color: '#737373', minWidth: 42 }}>{formatTime(task.time, task.endTime)}</span>
      <div className="task-icon" style={{ background: cat.bg, width: 26, height: 26 }}>
        <Icon size={12} color={cat.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="task-title" style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          {task.title}
          {task.isOneTime && <span className="one-time-badge">1×</span>}
        </div>
      </div>
      {onSaveEdit && (
        <button onClick={beginEdit} className="btn-ghost" style={{ padding: 6, color: '#737373' }} aria-label="Edit task">
          <Edit2 size={14} />
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} className="btn-ghost" style={{ padding: 6, color: '#A3A3A3' }}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function OneTimeComposer({ onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('');
  const [category, setCategory] = useState('break');

  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), time, endTime: endTime || null, category });
  };

  return (
    <div style={{ marginTop: 10, padding: 14, background: 'rgba(0,0,0,0.03)', borderRadius: 14, animation: 'slideUp 0.2s ease' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {Object.entries(CATEGORY_STYLES).map(([key, cat]) => {
          const Icon = cat.icon;
          return (
            <button key={key} onClick={() => setCategory(key)} style={{
              padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: category === key ? cat.color : cat.bg,
              color: category === key ? 'white' : cat.color,
              transition: 'all 0.15s ease',
            }}>
              <Icon size={11} />
              {cat.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <input className="input" autoFocus value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }}
          placeholder="What needs doing?" style={{ flex: 1, minWidth: 140 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input className="input" type="time" value={time}
            onChange={(e) => setTime(e.target.value)} style={{ width: 110 }} />
          <span style={{ fontSize: 12, color: '#737373' }}>–</span>
          <input className="input" type="time" value={endTime}
            onChange={(e) => setEndTime(e.target.value)} style={{ width: 110 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} className="btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
        <button onClick={save} className="btn-primary" style={{ fontSize: 13, padding: '10px 16px' }}>
          <Check size={14} /> Add task
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats View
// ---------------------------------------------------------------------------

function StatsView({
  templates, weekAssignments, oneTimeTasks, completed, getTemplate, goals, onSaveGoals,
  customGoals, onAddCustomGoal, onUpdateCustomGoal, onDeleteCustomGoal,
  weightEntries, onSaveWeight, onDeleteWeight, todayKey, onEditGoals,
}) {
  const [windowMode, setWindowMode] = useState('rolling'); // 'rolling' | 'month' | 'quarter' | 'year'
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [weightWindow, setWeightWindow] = useState('month'); // 'month' | 'quarter' | 'year'

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const { startDate, endDate, label, totalDays } = (() => {
    if (windowMode === 'rolling') {
      return { startDate: addDays(today, -27), endDate: today, label: 'LAST 4 WEEKS', totalDays: 28 };
    } else if (windowMode === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const days = Math.round((today - start) / 86400000) + 1;
      return { startDate: start, endDate: today, label: 'THIS MONTH', totalDays: days };
    } else if (windowMode === 'quarter') {
      return { startDate: addDays(today, -89), endDate: today, label: 'LAST 3 MONTHS', totalDays: 90 };
    } else {
      return { startDate: addDays(today, -364), endDate: today, label: 'LAST 12 MONTHS', totalDays: 365 };
    }
  })();

  // Walk every day in window
  let totalTasks = 0, completedTasks = 0;
  let activeDays = 0;
  let totalMinutes = 0;
  const totals = { workout: 0, boxing: 0, jiujitsu: 0, football: 0, office: 0, wfh: 0, break: 0, custom: 0 };
  const completedByCat = { workout: 0, boxing: 0, jiujitsu: 0, football: 0, office: 0, wfh: 0, break: 0, custom: 0 };
  const minutesByCat = { workout: 0, boxing: 0, jiujitsu: 0, football: 0, office: 0, wfh: 0, break: 0, custom: 0 };

  for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
    const dKey = dateKey(d);
    const dow = d.getDay();
    const tid = weekAssignments[dow];
    const tplTasks = tid ? (getTemplate(tid)?.tasks || []) : [];
    const oneTimes = oneTimeTasks[dKey] || [];
    const allTasks = [
      ...tplTasks.map(t => ({ ...t, isOneTime: false })),
      ...oneTimes.map(t => ({ ...t, isOneTime: true })),
    ];
    let dayDone = 0;
    allTasks.forEach(task => {
      totalTasks++;
      totals[task.category] = (totals[task.category] || 0) + 1;
      if (completed.has(completionKey(dKey, task.id, task.isOneTime))) {
        completedTasks++;
        completedByCat[task.category] = (completedByCat[task.category] || 0) + 1;
        const mins = taskDurationMinutes(task);
        if (mins > 0) {
          if (task.category !== 'office' && task.category !== 'wfh') {
            totalMinutes += mins;
          }
          minutesByCat[task.category] = (minutesByCat[task.category] || 0) + mins;
        }
        dayDone++;
      }
    });
    if (dayDone > 0) activeDays++;
  }

  // Streak from today backward (skip days with 0 tasks)
  const streak = (() => {
    let count = 0;
    for (let d = new Date(today); ; d = addDays(d, -1)) {
      const dKey = dateKey(d);
      const dow = d.getDay();
      const tid = weekAssignments[dow];
      const tplTasks = tid ? (getTemplate(tid)?.tasks || []) : [];
      const oneTimes = oneTimeTasks[dKey] || [];
      const all = [
        ...tplTasks.map(t => ({ ...t, isOneTime: false })),
        ...oneTimes.map(t => ({ ...t, isOneTime: true })),
      ];
      if (all.length === 0) {
        if (count > 60) break;
        if ((today - d) > 60 * 86400000) break;
        continue;
      }
      const allDone = all.every(t => completed.has(completionKey(dKey, t.id, t.isOneTime)));
      if (allDone) count++; else break;
    }
    return count;
  })();

  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const weeks = totalDays / 7;

  const builtInGoalCards = [
    { key: 'workouts', cat: 'workout', cats: WORKOUT_CATEGORIES, label: 'Workouts',   weeklyGoal: goals.workouts },
    { key: 'boxing',   cat: 'boxing',  label: 'Boxing',     weeklyGoal: goals.boxing   },
    { key: 'office',   cat: 'office',  label: 'Office days',weeklyGoal: goals.office   },
    { key: 'wfh',      cat: 'wfh',     label: 'WFH days',   weeklyGoal: goals.wfh      },
  ]
    .filter(g => g.weeklyGoal > 0)
    .map(g => goalCardFromTotals(g, completedByCat, totals, weeks, minutesByCat));

  const customGoalCards = customGoals.map(g =>
    goalCardFromTotals(
      { key: g.id, cat: g.category, label: g.name, weeklyGoal: g.weeklyTarget, custom: true, id: g.id },
      completedByCat, totals, weeks, minutesByCat
    )
  );

  return (
    <main className="main-padding" style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: '#737373', letterSpacing: '0.15em', marginBottom: 8 }}>
            PROGRESS
          </div>
          <h1 className="hero-title display-font" style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 600, lineHeight: 1, margin: 0 }}>
            How's the run<span style={{ color: '#FF4D2E' }}>?</span>
          </h1>
        </div>
        <div className="period-toggle" style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 999, flexWrap: 'wrap' }}>
          <button className={`pill-tab ${windowMode === 'rolling' ? 'active' : ''}`} onClick={() => setWindowMode('rolling')}>4 weeks</button>
          <button className={`pill-tab ${windowMode === 'month' ? 'active' : ''}`} onClick={() => setWindowMode('month')}>This month</button>
          <button className={`pill-tab ${windowMode === 'quarter' ? 'active' : ''}`} onClick={() => setWindowMode('quarter')}>3 months</button>
          <button className={`pill-tab ${windowMode === 'year' ? 'active' : ''}`} onClick={() => setWindowMode('year')}>1 year</button>
        </div>
      </div>

      {/* Hero card */}
      <div style={{
        background: 'linear-gradient(135deg, #0A0A0A 0%, #1F1F1F 100%)',
        color: '#FAFAF7', borderRadius: 24, padding: 28, marginBottom: 20,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 180, height: 180,
          borderRadius: '50%', background: 'rgba(255, 77, 46, 0.18)', filter: 'blur(40px)',
        }} />
        <div style={{ position: 'relative' }}>
          <div className="mono" style={{ fontSize: 10, color: 'rgba(250,250,247,0.5)', letterSpacing: '0.15em', marginBottom: 10 }}>
            {label}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
            <span className="display-font" style={{ fontSize: 72, fontWeight: 600, fontStyle: 'italic', lineHeight: 1 }}>
              {completionPct}<span style={{ color: '#FF4D2E' }}>%</span>
            </span>
            <span className="mono" style={{ fontSize: 12, color: 'rgba(250,250,247,0.6)' }}>
              {completedTasks} / {totalTasks} tasks
            </span>
          </div>
          <div className="progress-bar" style={{ background: 'rgba(255,255,255,0.1)', marginBottom: 20 }}>
            <div className="progress-fill" style={{ width: `${completionPct}%` }} />
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flame size={16} color="#FF4D2E" />
                <span style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 24 }}>{streak}</span>
              </div>
              <div className="mono" style={{ fontSize: 9, color: 'rgba(250,250,247,0.5)', letterSpacing: '0.15em', marginTop: 4 }}>
                DAY STREAK
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 24 }}>
                {activeDays}<span style={{ color: 'rgba(250,250,247,0.4)', fontSize: 18 }}>/{totalDays}</span>
              </div>
              <div className="mono" style={{ fontSize: 9, color: 'rgba(250,250,247,0.5)', letterSpacing: '0.15em', marginTop: 4 }}>
                ACTIVE DAYS
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 24, color: '#FF4D2E' }}>
                {formatHM(totalMinutes)}
              </div>
              <div className="mono" style={{ fontSize: 9, color: 'rgba(250,250,247,0.5)', letterSpacing: '0.15em', marginTop: 4 }}>
                TIME INVESTED
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weight tracker */}
      <WeightTracker
        weightEntries={weightEntries} todayKey={todayKey}
        onSave={onSaveWeight} onDelete={onDeleteWeight}
        windowMode={weightWindow} setWindowMode={setWeightWindow}
      />

      {/* Goals header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <span className="mono" style={{ fontSize: 11, color: '#737373', letterSpacing: '0.15em', fontWeight: 600 }}>
          WEEKLY GOALS
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowCreateGoal(true)} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={13} /> New goal
          </button>
          <button onClick={onEditGoals} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Settings size={13} /> Defaults
          </button>
        </div>
      </div>

      <div className="goals-grid" style={{ display: 'grid', gap: 12 }}>
        {builtInGoalCards.map(g => (
          <GoalCard key={g.key} g={g}
            onDelete={() => {
              if (confirm(`Remove the "${g.label}" goal? You can bring it back from Defaults.`)) {
                onSaveGoals({ ...goals, [g.key]: 0 });
              }
            }} />
        ))}
        {customGoalCards.map(g => (
          <GoalCard key={g.key} g={g}
            onUpdate={(patch) => onUpdateCustomGoal(g.id, patch)}
            onDelete={() => {
              if (confirm(`Delete goal "${g.label}"?`)) onDeleteCustomGoal(g.id);
            }} />
        ))}
      </div>

      {showCreateGoal && (
        <CustomGoalEditor
          onSave={(g) => { onAddCustomGoal(g); setShowCreateGoal(false); }}
          onClose={() => setShowCreateGoal(false)} />
      )}
    </main>
  );
}

function goalCardFromTotals(g, completedByCat, totals, weeks, minutesByCat) {
  const cats = g.cats || [g.cat];
  const target = Math.max(1, Math.round(g.weeklyGoal * weeks));
  const actual = cats.reduce((s, c) => s + (completedByCat[c] || 0), 0);
  const planned = cats.reduce((s, c) => s + (totals[c] || 0), 0);
  const pct = Math.min(100, Math.round((actual / target) * 100));
  const minutes = (minutesByCat ? cats.reduce((s, c) => s + (minutesByCat[c] || 0), 0) : 0);
  return { ...g, target, actual, planned, pct, minutes };
}

function GoalCard({ g, onUpdate, onDelete }) {
  const cat = CATEGORY_STYLES[g.cat];
  const Icon = cat.icon;
  const onTrack = g.pct >= 90;
  const behind = g.pct < 50;
  const [editing, setEditing] = useState(false);
  const [draftTarget, setDraftTarget] = useState(g.weeklyGoal);

  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: 18,
      border: '1px solid rgba(0,0,0,0.06)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <div className="task-icon" style={{ background: cat.bg, width: 36, height: 36, borderRadius: 10 }}>
            <Icon size={18} color={cat.color} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {g.label}
              {g.custom && <span className="one-time-badge" style={{ marginLeft: 8 }}>CUSTOM</span>}
            </div>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginTop: 2 }}>
              {g.weeklyGoal}/WEEK GOAL
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onTrack && (
            <span className="mono" style={{ fontSize: 9, padding: '3px 7px', background: 'rgba(34,197,94,0.12)', color: '#16A34A', borderRadius: 4, letterSpacing: '0.1em', fontWeight: 600 }}>ON TRACK</span>
          )}
          {behind && (
            <span className="mono" style={{ fontSize: 9, padding: '3px 7px', background: 'rgba(220,38,38,0.10)', color: '#DC2626', borderRadius: 4, letterSpacing: '0.1em', fontWeight: 600 }}>BEHIND</span>
          )}
          {g.custom && (
            <button className="btn-ghost" style={{ padding: 6 }} onClick={() => { setDraftTarget(g.weeklyGoal); setEditing(true); }}><Edit2 size={13} /></button>
          )}
          {onDelete && (
            <button className="btn-ghost" style={{ padding: 6, color: '#DC2626' }} onClick={onDelete} aria-label="Delete goal"><Trash2 size={13} /></button>
          )}
        </div>
      </div>

      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: '#737373' }}>WEEKLY TARGET</span>
          <button onClick={() => setDraftTarget(Math.max(0, draftTarget - 1))} className="stepper-btn"><Minus size={14} /></button>
          <span style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 22, minWidth: 24, textAlign: 'center' }}>{draftTarget}</span>
          <button onClick={() => setDraftTarget(Math.min(21, draftTarget + 1))} className="stepper-btn"><Plus size={14} /></button>
          <button className="btn-primary" style={{ marginLeft: 'auto', padding: '8px 12px', fontSize: 12 }} onClick={() => { onUpdate({ weeklyTarget: draftTarget }); setEditing(false); }}>
            <Check size={13} /> Save
          </button>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 8px' }} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span className="display-font" style={{ fontSize: 36, fontWeight: 600, fontStyle: 'italic', color: cat.color, lineHeight: 1 }}>
              {g.actual}
            </span>
            <span className="mono" style={{ fontSize: 12, color: '#737373' }}>/ {g.target}</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600 }}>{g.pct}%</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 8 }}>
            <div className="progress-fill" style={{ width: `${g.pct}%`, background: cat.color }} />
          </div>
          <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.05em', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {g.minutes > 0 && (
              <span style={{ color: cat.color, fontWeight: 600 }}>⏱ {formatHM(g.minutes)} INVESTED</span>
            )}
            {g.planned > g.actual && (
              <span>{g.actual} done · {g.planned - g.actual} planned but not completed</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom goal editor
// ---------------------------------------------------------------------------

function CustomGoalEditor({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('custom');
  const [target, setTarget] = useState(3);

  const save = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), category, weeklyTarget: target });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em' }}>
              CUSTOM GOAL
            </div>
            <h2 className="display-font" style={{ fontSize: 28, fontWeight: 600, margin: '4px 0 0 0' }}>
              New target
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8 }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
            GOAL NAME
          </label>
          <input className="input" autoFocus value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            placeholder="e.g., Read, Meditate, Run..." />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em', display: 'block', marginBottom: 8 }}>
            COUNTS TASKS IN CATEGORY
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(CATEGORY_STYLES).map(([key, cat]) => {
              const Icon = cat.icon;
              return (
                <button key={key} onClick={() => setCategory(key)} style={{
                  padding: '8px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: category === key ? cat.color : cat.bg,
                  color: category === key ? 'white' : cat.color,
                }}>
                  <Icon size={12} />
                  {cat.label}
                </button>
              );
            })}
          </div>
          <div className="mono" style={{ fontSize: 10, color: '#737373', marginTop: 8, lineHeight: 1.5 }}>
            Completed tasks of this category count toward this goal.
          </div>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em', display: 'block', marginBottom: 10 }}>
            WEEKLY TARGET
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={() => setTarget(Math.max(0, target - 1))} className="stepper-btn"><Minus size={16} /></button>
            <span style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 28, minWidth: 36, textAlign: 'center' }}>{target}</span>
            <button onClick={() => setTarget(Math.min(21, target + 1))} className="stepper-btn"><Plus size={16} /></button>
            <span className="mono" style={{ fontSize: 11, color: '#737373', marginLeft: 'auto' }}>per week</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>
            <Target size={15} /> Create goal
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weight tracker + chart
// ---------------------------------------------------------------------------

function WeightTracker({ weightEntries, todayKey, onSave, onDelete, windowMode, setWindowMode }) {
  const todayEntry = weightEntries.find(w => w.date === todayKey);
  const [draft, setDraft] = useState(todayEntry ? String(todayEntry.weight) : '');
  const [editing, setEditing] = useState(!todayEntry);

  useEffect(() => {
    setDraft(todayEntry ? String(todayEntry.weight) : '');
    setEditing(!todayEntry);
  }, [todayEntry?.weight, todayKey]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = windowMode === 'month' ? 30 : windowMode === 'quarter' ? 90 : 365;
  const startDate = addDays(today, -(days - 1));
  const startKey = dateKey(startDate);
  const windowEntries = weightEntries
    .filter(w => w.date >= startKey)
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1] : null;
  const first = windowEntries.length > 0 ? windowEntries[0] : null;
  const delta = (latest && first && latest.date !== first.date) ? +(latest.weight - first.weight).toFixed(1) : null;

  const save = () => {
    const num = parseFloat(draft.replace(',', '.'));
    if (!isNaN(num) && num > 0 && num < 500) {
      onSave(todayKey, +num.toFixed(2));
      setEditing(false);
    }
  };

  return (
    <div style={{
      background: 'white', borderRadius: 20, padding: 22,
      border: '1px solid rgba(0,0,0,0.06)', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="task-icon" style={{ background: 'rgba(124, 58, 237, 0.10)', width: 36, height: 36, borderRadius: 10 }}>
            <Scale size={18} color="#7C3AED" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Daily weight</div>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginTop: 2 }}>
              {windowEntries.length} ENTRIES · KG
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 999 }}>
          <button className={`pill-tab ${windowMode === 'month' ? 'active' : ''}`} onClick={() => setWindowMode('month')} style={{ padding: '6px 12px', fontSize: 12 }}>1M</button>
          <button className={`pill-tab ${windowMode === 'quarter' ? 'active' : ''}`} onClick={() => setWindowMode('quarter')} style={{ padding: '6px 12px', fontSize: 12 }}>3M</button>
          <button className={`pill-tab ${windowMode === 'year' ? 'active' : ''}`} onClick={() => setWindowMode('year')} style={{ padding: '6px 12px', fontSize: 12 }}>1Y</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginBottom: 4 }}>
            {todayEntry ? "TODAY'S WEIGHT" : 'NO ENTRY TODAY'}
          </div>
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="input"
                type="number" step="0.1" inputMode="decimal" autoFocus
                value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setDraft(todayEntry ? String(todayEntry.weight) : ''); } }}
                placeholder="kg" style={{ width: 120, fontSize: 18, fontWeight: 600 }}
              />
              <button className="btn-primary" onClick={save} style={{ padding: '10px 14px' }}>
                <Check size={15} /> Save
              </button>
              {todayEntry && (
                <button className="btn-ghost" onClick={() => { setEditing(false); setDraft(String(todayEntry.weight)); }}>Cancel</button>
              )}
            </div>
          ) : todayEntry ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span className="display-font" style={{ fontSize: 40, fontWeight: 600, fontStyle: 'italic', color: '#7C3AED', lineHeight: 1 }}>
                {todayEntry.weight.toFixed(1)}
              </span>
              <span className="mono" style={{ fontSize: 12, color: '#737373' }}>kg</span>
              <button className="btn-ghost" onClick={() => setEditing(true)} style={{ padding: 6, marginLeft: 4 }}>
                <Edit2 size={14} />
              </button>
              <button className="btn-ghost" onClick={() => { if (confirm("Delete today's weight entry?")) onDelete(todayKey); }} style={{ padding: 6, color: '#DC2626' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={() => setEditing(true)} style={{ padding: '10px 14px' }}>
              <Plus size={15} /> Log weight
            </button>
          )}
        </div>
        {delta !== null && (
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginBottom: 4 }}>
              CHANGE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <TrendingUp size={14} color={delta > 0 ? '#DC2626' : delta < 0 ? '#16A34A' : '#737373'}
                style={{ transform: delta > 0 ? 'none' : 'rotate(180deg)' }} />
              <span style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 20,
                color: delta > 0 ? '#DC2626' : delta < 0 ? '#16A34A' : '#737373' }}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
              </span>
              <span className="mono" style={{ fontSize: 10, color: '#737373' }}>kg</span>
            </div>
          </div>
        )}
      </div>

      <WeightChart entries={windowEntries} startDate={startDate} endDate={today} days={days} />
    </div>
  );
}

function WeightChart({ entries, startDate, endDate, days }) {
  if (entries.length === 0) {
    return (
      <div style={{
        height: 160, display: 'grid', placeItems: 'center',
        border: '1.5px dashed rgba(0,0,0,0.1)', borderRadius: 12, color: '#737373',
        fontSize: 13, padding: 16, textAlign: 'center',
      }}>
        Log your weight today to start tracking trends.
      </div>
    );
  }

  const W = 600, H = 180, PAD_L = 36, PAD_R = 8, PAD_T = 12, PAD_B = 22;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const weights = entries.map(e => e.weight);
  let yMin = Math.min(...weights);
  let yMax = Math.max(...weights);
  const yRange = Math.max(1, yMax - yMin);
  const pad = yRange * 0.15;
  yMin = Math.floor((yMin - pad) * 2) / 2;
  yMax = Math.ceil((yMax + pad) * 2) / 2;

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const xScale = (dateStr) => {
    const ms = new Date(dateStr + 'T00:00:00').getTime();
    return PAD_L + ((ms - startMs) / Math.max(1, endMs - startMs)) * innerW;
  };
  const yScale = (w) => PAD_T + (1 - (w - yMin) / (yMax - yMin)) * innerH;

  const points = entries.map(e => ({ x: xScale(e.date), y: yScale(e.weight), ...e }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_T + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD_T + innerH).toFixed(1)} Z`
    : '';

  // Y-axis ticks (3)
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  // X-axis ticks: depend on window
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const xLabels = (() => {
    if (days <= 31) {
      return [0, Math.floor(days / 2), days - 1].map(off => {
        const d = addDays(startDate, off);
        return { x: xScale(dateKey(d)), label: `${d.getDate()} ${months[d.getMonth()]}` };
      });
    }
    if (days <= 90) {
      return [0, 30, 60, 89].map(off => {
        const d = addDays(startDate, off);
        return { x: xScale(dateKey(d)), label: months[d.getMonth()] };
      });
    }
    return [0, 91, 182, 273, 364].map(off => {
      const d = addDays(startDate, off);
      return { x: xScale(dateKey(d)), label: months[d.getMonth()] };
    });
  })();

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 180, display: 'block' }}>
        <defs>
          <linearGradient id="wgrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Y gridlines */}
        {yTicks.map((t, i) => {
          const y = yScale(t);
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#A3A3A3" fontFamily="JetBrains Mono, monospace">
                {t.toFixed(1)}
              </text>
            </g>
          );
        })}
        {/* Area + line */}
        {areaD && <path d={areaD} fill="url(#wgrad)" />}
        <path d={pathD} fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Points (only if not too many) */}
        {points.length <= 60 && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#7C3AED">
            <title>{p.date}: {p.weight.toFixed(1)} kg</title>
          </circle>
        ))}
        {/* X labels */}
        {xLabels.map((t, i) => (
          <text key={i} x={t.x} y={H - 6} textAnchor="middle" fontSize="10" fill="#A3A3A3" fontFamily="JetBrains Mono, monospace">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goals Editor
// ---------------------------------------------------------------------------

function GoalsEditor({ goals, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...goals });
  const fields = [
    { key: 'workouts', label: 'Workouts', cat: 'workout' },
    { key: 'boxing',   label: 'Boxing',   cat: 'boxing'  },
    { key: 'office',   label: 'Office',   cat: 'office'  },
    { key: 'wfh',      label: 'WFH',      cat: 'wfh'     },
  ];
  const adjust = (key, delta) =>
    setDraft(d => ({ ...d, [key]: Math.max(0, Math.min(7, d[key] + delta)) }));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.15em' }}>
              WEEKLY TARGETS
            </div>
            <h2 className="display-font" style={{ fontSize: 28, fontWeight: 600, margin: '4px 0 0 0' }}>
              Set the bar
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8 }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fields.map(f => {
            const cat = CATEGORY_STYLES[f.cat];
            const Icon = cat.icon;
            return (
              <div key={f.key} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                background: 'white', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)',
              }}>
                <div className="task-icon" style={{ background: cat.bg, width: 36, height: 36, borderRadius: 10 }}>
                  <Icon size={18} color={cat.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{f.label}</div>
                  <div className="mono" style={{ fontSize: 10, color: '#737373', letterSpacing: '0.1em', marginTop: 2 }}>
                    PER WEEK
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => adjust(f.key, -1)} className="stepper-btn" aria-label="Decrease">
                    <Minus size={16} />
                  </button>
                  <span style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 26, minWidth: 28, textAlign: 'center' }}>
                    {draft[f.key]}
                  </span>
                  <button onClick={() => adjust(f.key, +1)} className="stepper-btn" aria-label="Increase">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(draft)}>
            <Check size={16} /> Save goals
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Templates View + Editor
// ---------------------------------------------------------------------------

function TemplatesView({ templates, setTemplates, editingTemplate, setEditingTemplate, creatingTemplate, setCreatingTemplate, resetData, userId }) {
  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    setTemplates(templates.filter(t => t.id !== id));
    try { await db.deleteTemplate(id); } catch (e) { console.error('Delete failed:', e); }
  };
  const handleDuplicate = async (t) => {
    try {
      const saved = await db.upsertTemplate({ name: `${t.name} (copy)`, accent: t.accent, tasks: t.tasks }, userId);
      setTemplates([...templates, saved]);
    } catch (e) { console.error('Duplicate failed:', e); }
  };

  return (
    <main className="main-padding" style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
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
        <button className="btn-primary" onClick={() => setCreatingTemplate(true)}>
          <Plus size={16} /> New Template
        </button>
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
                    <div className="mono" style={{ fontSize: 10, color: '#737373', minWidth: 56 }}>{formatTime(task.time, task.endTime)}</div>
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

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <button onClick={resetData} style={{
          fontSize: 12, color: '#A3A3A3', background: 'none', border: 'none',
          textDecoration: 'underline', cursor: 'pointer',
        }}>
          Reset all data
        </button>
      </div>

      {(editingTemplate || creatingTemplate) && (
        <TemplateEditor
          template={editingTemplate}
          onSave={(updated) => {
            const wasEditing = !!editingTemplate;
            // Close immediately for snappy UX
            setEditingTemplate(null); setCreatingTemplate(false);
            // Optimistic local update
            const tempId = updated.id || `t${Date.now()}`;
            const optimistic = { ...updated, id: tempId };
            if (wasEditing) {
              setTemplates(prev => prev.map(t => t.id === updated.id ? optimistic : t));
            } else {
              setTemplates(prev => [...prev, optimistic]);
            }
            // Persist in background, then reconcile with server response
            db.upsertTemplate(updated, userId).then(saved => {
              setTemplates(prev => {
                const idx = prev.findIndex(t => t.id === (wasEditing ? updated.id : tempId));
                if (idx === -1) return [...prev, saved];
                const copy = prev.slice();
                copy[idx] = saved;
                return copy;
              });
            }).catch(e => console.error('Save template failed:', e));
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
  const [newTaskEndTime, setNewTaskEndTime] = useState('');
  const [newTaskCat, setNewTaskCat] = useState('workout');

  const ACCENT_OPTIONS = ['#FF4D2E', '#E11D48', '#0F172A', '#0891B2', '#A16207', '#7C3AED'];

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    setTasks([...tasks, {
      id: `task${Date.now()}`, title: newTaskTitle, time: newTaskTime,
      endTime: newTaskEndTime || null, category: newTaskCat,
    }].sort((a, b) => a.time.localeCompare(b.time)));
    setNewTaskTitle(''); setNewTaskEndTime('');
  };
  const removeTask = (id) => setTasks(tasks.filter(t => t.id !== id));
  const save = () => {
    if (!name.trim()) return;
    onSave({ id: template?.id, name: name.trim(), accent, tasks });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="sheet-handle" />
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
              <button key={c} onClick={() => setAccent(c)} style={{
                width: 32, height: 32, borderRadius: '50%', background: c,
                border: accent === c ? '3px solid white' : '3px solid transparent',
                outline: accent === c ? `2px solid ${c}` : 'none',
              }} />
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
                  <span className="mono" style={{ fontSize: 11, color: '#737373', minWidth: 56 }}>{formatTime(task.time, task.endTime)}</span>
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
                  <button key={key} onClick={() => setNewTaskCat(key)} style={{
                    padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: newTaskCat === key ? cat.color : cat.bg,
                    color: newTaskCat === key ? 'white' : cat.color,
                  }}>
                    <Icon size={11} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input className="input" value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Task title..." style={{ flex: 1, minWidth: 140 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input className="input" type="time" value={newTaskTime}
                  onChange={(e) => setNewTaskTime(e.target.value)} style={{ width: 110 }} />
                <span style={{ fontSize: 12, color: '#737373' }}>–</span>
                <input className="input" type="time" value={newTaskEndTime}
                  onChange={(e) => setNewTaskEndTime(e.target.value)} style={{ width: 110 }} />
              </div>
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

// ---------------------------------------------------------------------------
// Global styles (single style block for the app)
// ---------------------------------------------------------------------------

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      * { box-sizing: border-box; }
      .display-font { font-family: 'Fraunces', serif; font-style: italic; letter-spacing: -0.02em; }
      .mono { font-family: 'JetBrains Mono', monospace; }
      button { cursor: pointer; border: none; background: none; font-family: inherit; color: inherit; touch-action: manipulation; }
      button:active { transform: scale(0.97); }
      .btn-primary { background: #0A0A0A; color: #FAFAF7; padding: 12px 18px; border-radius: 999px; font-weight: 500; font-size: 14px; transition: transform 0.15s ease, background 0.15s ease; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; }
      .btn-primary:hover { background: #FF4D2E; transform: translateY(-1px); }
      .btn-ghost { padding: 10px 14px; border-radius: 999px; font-weight: 500; font-size: 13px; color: #525252; transition: background 0.15s ease; min-height: 36px; }
      .btn-ghost:hover { background: rgba(0,0,0,0.06); }
      .pill-tab { padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 600; transition: all 0.2s ease; min-height: 36px; }
      .pill-tab.active { background: #0A0A0A; color: #FAFAF7; }
      .pill-tab:not(.active):hover { background: rgba(0,0,0,0.06); }

      .day-card { background: white; border-radius: 20px; padding: 18px; border: 1px solid rgba(0,0,0,0.06); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; cursor: pointer; position: relative; overflow: hidden; }
      .day-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px -10px rgba(0,0,0,0.12); border-color: rgba(0,0,0,0.12); }
      .day-card.empty { background: #F4F3EE; border-style: dashed; border-color: rgba(0,0,0,0.12); }
      .day-card.today::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: #FF4D2E; }

      .template-chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: white; border: 1.5px solid; }
      .task-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; transition: background 0.12s ease; }
      .task-row:hover { background: rgba(0,0,0,0.03); }
      .task-icon { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; }

      .checkbox { width: 28px; height: 28px; min-width: 28px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.2); background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease; cursor: pointer; }
      .checkbox:hover { border-color: #0A0A0A; }
      .checkbox.checked-accent { background: #FF4D2E; border-color: #FF4D2E; }
      .task-completed { opacity: 0.45; }
      .task-completed .task-title { text-decoration: line-through; text-decoration-thickness: 1.5px; }
      .one-time-badge { font-size: 8px; font-weight: 700; letter-spacing: 0.05em; padding: 2px 6px; border-radius: 3px; background: rgba(0,0,0,0.06); color: #525252; font-family: 'JetBrains Mono', monospace; }

      .mini-task { cursor: pointer; padding: 6px 8px; }
      .mini-task:hover { background: rgba(255, 77, 46, 0.06); }
      .mini-check { width: 16px; height: 16px; min-width: 16px; border-radius: 5px; border: 1.5px solid rgba(0,0,0,0.2); background: white; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease; }
      .mini-task:hover .mini-check { border-color: #FF4D2E; }
      .mini-check-on { background: #FF4D2E; border-color: #FF4D2E; }

      .sheet-backdrop { position: fixed; inset: 0; background: rgba(10,10,10,0.4); backdrop-filter: blur(8px); display: grid; place-items: center; padding: 0; z-index: 100; animation: fadeIn 0.2s ease; }
      .sheet { background: #FAFAF7; border-radius: 24px; max-width: 560px; width: 100%; max-height: 88vh; overflow-y: auto; padding: 28px; animation: slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1); box-shadow: 0 30px 60px -20px rgba(0,0,0,0.3); position: relative; }
      .sheet-handle { display: none; width: 36px; height: 4px; border-radius: 999px; background: rgba(0,0,0,0.18); margin: -12px auto 14px; }

      @media (max-width: 700px) {
        .sheet-backdrop { padding: 0; align-items: end; }
        .sheet { max-width: 100%; max-height: 92vh; border-radius: 24px 24px 0 0; padding: 22px 18px calc(22px + env(safe-area-inset-bottom)); }
        .sheet-handle { display: block; }
      }

      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes checkPop { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
      .check-pop { animation: checkPop 0.3s ease; }

      .input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1.5px solid rgba(0,0,0,0.1); background: white; font-family: inherit; font-size: 16px; transition: border-color 0.15s ease; min-height: 44px; }
      .input:focus { outline: none; border-color: #0A0A0A; }

      .week-grid { display: grid; gap: 14px; grid-template-columns: repeat(7, 1fr); }
      @media (max-width: 1100px) { .week-grid { grid-template-columns: repeat(3, 1fr); } }
      @media (max-width: 700px) {
        .week-grid {
          display: flex; gap: 12px; overflow-x: auto;
          scroll-snap-type: x mandatory; padding: 4px 16px 4px 4px;
          margin: 0 -16px;  scrollbar-width: none;
        }
        .week-grid::-webkit-scrollbar { display: none; }
        .day-card {
          flex: 0 0 78%; scroll-snap-align: start;
        }
      }

      .templates-grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
      .goals-grid { grid-template-columns: 1fr; }
      @media (min-width: 700px) { .goals-grid { grid-template-columns: repeat(2, 1fr); } }

      .stat-num { font-family: 'Fraunces', serif; font-weight: 600; font-size: 28px; line-height: 1; font-style: italic; }
      .progress-bar { height: 5px; background: rgba(0,0,0,0.08); border-radius: 999px; overflow: hidden; }
      .progress-fill { height: 100%; background: #FF4D2E; border-radius: 999px; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
      .section-divider { display: flex; align-items: center; gap: 10px; margin: 12px 0 6px; }
      .section-divider::before, .section-divider::after { content: ''; flex: 1; height: 1px; background: rgba(0,0,0,0.06); }
      .section-divider-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #737373; letter-spacing: 0.15em; font-weight: 600; }

      .stepper-btn {
        width: 36px; height: 36px; border-radius: 50%;
        background: rgba(0,0,0,0.05); display: grid; place-items: center;
        transition: background 0.15s ease;
      }
      .stepper-btn:hover { background: rgba(0,0,0,0.1); }

      .tile-picker {
        position: absolute; top: 40px; right: 8px; z-index: 20;
        background: white; border: 1px solid rgba(0,0,0,0.08);
        border-radius: 14px; padding: 12px; min-width: 220px;
        box-shadow: 0 12px 30px -10px rgba(0,0,0,0.18);
      }
      .tile-picker-row {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 8px; border-radius: 8px; cursor: pointer;
      }
      .tile-picker-row:hover { background: rgba(0,0,0,0.04); }
      .tile-picker-row input[type="checkbox"] { accent-color: #FF4D2E; cursor: pointer; }
      .tile-picker-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

      .desktop-nav { display: flex; }
      .mobile-nav {
        display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
        background: rgba(250,250,247,0.92); backdrop-filter: blur(16px);
        border-top: 1px solid rgba(0,0,0,0.06);
        padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
        justify-content: space-around; align-items: center; gap: 4px;
      }
      .mobile-nav-tab {
        flex: 1; max-width: 90px; min-height: 56px; padding: 8px; border-radius: 14px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
        color: #737373; transition: all 0.2s ease;
      }
      .mobile-nav-tab.active { color: #FF4D2E; background: rgba(255, 77, 46, 0.08); }
      .mobile-nav-tab.fab {
        background: linear-gradient(135deg, #FF4D2E 0%, #E11D48 100%);
        color: white; border-radius: 50%;
        width: 60px; height: 60px; padding: 0; flex: 0 0 60px;
        margin-top: -22px; box-shadow: 0 10px 22px -4px rgba(225,29,72,0.45);
        transition: transform 0.15s ease;
        flex-direction: row; align-items: center; justify-content: center;
      }
      .mobile-nav-tab.fab:hover { transform: scale(1.05); }
      .mobile-nav-tab.fab.active { background: linear-gradient(135deg, #FF4D2E 0%, #E11D48 100%); color: white; }
      .mobile-nav-label { font-size: 10px; font-weight: 600; letter-spacing: 0.02em; }

      @media (max-width: 700px) {
        .desktop-nav { display: none; }
        .mobile-nav { display: flex; }
        .header-padding { padding: 16px 20px !important; }
        .main-padding { padding: 20px 16px !important; }
        .hero-title { font-size: clamp(32px, 9vw, 44px) !important; }
        .stats-strip { grid-template-columns: repeat(2, 1fr) !important; }
      }
    `}</style>
  );
}
