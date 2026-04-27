import { supabase } from './supabaseClient';

// ---- Date helpers ----
export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const HISTORY_DAYS = 370;

function getHistoryRange() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = addDays(today, 13);
  const start = addDays(today, -HISTORY_DAYS);
  return { start: dateKey(start), end: dateKey(end) };
}

// ---- Templates ----

export async function fetchTemplates() {
  const { data, error } = await supabase
    .from('templates')
    .select('*, template_tasks(*)')
    .order('sort_order', { ascending: true });
  if (error) throw error;

  return data.map(t => ({
    id: t.id, name: t.name, accent: t.accent,
    tasks: (t.template_tasks || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(task => ({
        id: task.id, title: task.title, time: task.time,
        endTime: task.end_time || null, category: task.category,
      })),
  }));
}

export async function upsertTemplate(template, userId) {
  const isNew = !template.id || String(template.id).startsWith('t');
  const { data: tData, error: tErr } = isNew
    ? await supabase.from('templates').insert({
        user_id: userId, name: template.name, accent: template.accent,
      }).select().single()
    : await supabase.from('templates').update({
        name: template.name, accent: template.accent,
      }).eq('id', template.id).select().single();
  if (tErr) throw tErr;

  const templateId = tData.id;
  await supabase.from('template_tasks').delete().eq('template_id', templateId);

  if (template.tasks.length > 0) {
    const rows = template.tasks.map((task, i) => ({
      template_id: templateId, title: task.title, time: task.time,
      end_time: task.endTime || null, category: task.category, sort_order: i,
    }));
    const { error: tasksErr } = await supabase.from('template_tasks').insert(rows);
    if (tasksErr) throw tasksErr;
  }

  return fetchTemplateById(templateId);
}

async function fetchTemplateById(id) {
  const { data, error } = await supabase
    .from('templates')
    .select('*, template_tasks(*)')
    .eq('id', id).single();
  if (error) throw error;
  return {
    id: data.id, name: data.name, accent: data.accent,
    tasks: (data.template_tasks || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(t => ({ id: t.id, title: t.title, time: t.time, endTime: t.end_time || null, category: t.category })),
  };
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw error;
}

// ---- Week Assignments ----

export async function fetchWeekAssignments() {
  const { data, error } = await supabase
    .from('week_assignments')
    .select('day_index, template_id');
  if (error) throw error;

  const assignments = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  data.forEach(row => { assignments[row.day_index] = row.template_id; });
  return assignments;
}

export async function setWeekAssignment(dayIndex, templateId, userId) {
  await supabase.from('week_assignments')
    .delete()
    .eq('user_id', userId)
    .eq('day_index', dayIndex);
  if (templateId !== null) {
    const { error } = await supabase.from('week_assignments').insert({
      user_id: userId,
      week_start: dateKey(getWeekStart()),
      day_index: dayIndex,
      template_id: templateId,
    });
    if (error) throw error;
  }
}

// ---- One-Time Tasks (date-keyed) ----

export async function fetchOneTimeTasks() {
  const { start, end } = getHistoryRange();
  const { data, error } = await supabase
    .from('one_time_tasks')
    .select('*')
    .gte('task_date', start)
    .lte('task_date', end)
    .order('time', { ascending: true });
  if (error) throw error;

  const result = {};
  data.forEach(row => {
    const key = row.task_date;
    if (!result[key]) result[key] = [];
    result[key].push({
      id: row.id, title: row.title, time: row.time,
      endTime: row.end_time || null, category: row.category,
    });
  });
  return result;
}

export async function addOneTimeTask(taskDate, task, userId) {
  const { data, error } = await supabase.from('one_time_tasks').insert({
    user_id: userId, task_date: taskDate,
    title: task.title, time: task.time,
    end_time: task.endTime || null, category: task.category,
  }).select().single();
  if (error) throw error;
  return {
    id: data.id, title: data.title, time: data.time,
    endTime: data.end_time || null, category: data.category,
  };
}

export async function removeOneTimeTask(taskId) {
  const { error } = await supabase.from('one_time_tasks').delete().eq('id', taskId);
  if (error) throw error;
}

// ---- Completions (date-keyed) ----

export async function fetchCompletions() {
  const { start, end } = getHistoryRange();
  const { data, error } = await supabase
    .from('completions')
    .select('*')
    .gte('task_date', start)
    .lte('task_date', end);
  if (error) throw error;

  const set = new Set();
  data.forEach(row => {
    const key = row.is_one_time
      ? `${row.task_date}:oo:${row.task_id}`
      : `${row.task_date}:${row.task_id}`;
    set.add(key);
  });
  return set;
}

export async function toggleCompletion(taskDate, taskId, isOneTime, isCurrentlyComplete, userId) {
  if (isCurrentlyComplete) {
    await supabase.from('completions')
      .delete()
      .eq('user_id', userId)
      .eq('task_date', taskDate)
      .eq('task_id', taskId);
  } else {
    const { error } = await supabase.from('completions').insert({
      user_id: userId, task_date: taskDate,
      task_id: taskId, is_one_time: isOneTime,
    });
    if (error) throw error;
  }
}

// ---- Goals ----

const DEFAULT_GOALS = { workouts: 4, boxing: 2, office: 3, wfh: 2 };

export async function fetchGoals(userId) {
  const { data, error } = await supabase
    .from('user_goals')
    .select('workouts, boxing, office, wfh')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    await supabase.from('user_goals').insert({ user_id: userId, ...DEFAULT_GOALS });
    return { ...DEFAULT_GOALS };
  }
  return data;
}

export async function saveGoals(goals, userId) {
  const { error } = await supabase
    .from('user_goals')
    .upsert({ user_id: userId, ...goals }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ---- Mock history seed ----

const MOCK_TEMPLATES = [
  {
    name: 'Office + Boxing', accent: '#E11D48',
    tasks: [
      { title: 'Commute to office', time: '08:00', endTime: '08:45', category: 'office' },
      { title: 'Deep work block', time: '09:30', endTime: '12:00', category: 'office' },
      { title: 'Boxing session', time: '19:00', endTime: '20:30', category: 'boxing' },
    ],
  },
  {
    name: 'WFH Power Day', accent: '#0891B2',
    tasks: [
      { title: 'Morning workout', time: '07:00', endTime: '07:45', category: 'workout' },
      { title: 'Focus work', time: '09:00', endTime: '12:00', category: 'wfh' },
      { title: 'Team standup', time: '11:00', endTime: '11:30', category: 'wfh' },
    ],
  },
  {
    name: 'Recovery Sunday', accent: '#A16207',
    tasks: [
      { title: 'Slow morning', time: '09:00', category: 'break' },
      { title: 'Mobility work', time: '11:00', endTime: '12:00', category: 'workout' },
      { title: 'Plan the week', time: '17:00', endTime: '17:30', category: 'break' },
    ],
  },
];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedMockHistory(userId) {
  const templateIds = [];
  for (const tpl of MOCK_TEMPLATES) {
    const { data: tData, error: tErr } = await supabase.from('templates').insert({
      user_id: userId, name: tpl.name, accent: tpl.accent,
    }).select().single();
    if (tErr) throw tErr;
    templateIds.push(tData.id);

    const taskRows = tpl.tasks.map((task, i) => ({
      template_id: tData.id, title: task.title, time: task.time,
      end_time: task.endTime || null, category: task.category, sort_order: i,
    }));
    const { error: tErr2 } = await supabase.from('template_tasks').insert(taskRows);
    if (tErr2) throw tErr2;
  }

  const assignments = {
    0: templateIds[2], 1: templateIds[0], 2: templateIds[1],
    3: templateIds[0], 4: templateIds[1], 5: templateIds[0], 6: null,
  };
  const weekStart = dateKey(getWeekStart());
  const assignmentRows = Object.entries(assignments)
    .filter(([, tid]) => tid !== null)
    .map(([dow, tid]) => ({
      user_id: userId, week_start: weekStart,
      day_index: parseInt(dow), template_id: tid,
    }));
  if (assignmentRows.length > 0) {
    await supabase.from('week_assignments').insert(assignmentRows);
  }

  const { data: allTaskRows } = await supabase
    .from('template_tasks')
    .select('id, template_id')
    .in('template_id', templateIds);

  const tasksByTemplate = {};
  allTaskRows.forEach(t => {
    if (!tasksByTemplate[t.template_id]) tasksByTemplate[t.template_id] = [];
    tasksByTemplate[t.template_id].push(t.id);
  });

  const rng = mulberry32(userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const completionRows = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 28; i >= 1; i--) {
    const day = addDays(today, -i);
    const dow = day.getDay();
    const tid = assignments[dow];
    if (!tid) continue;
    const taskIds = tasksByTemplate[tid] || [];
    const isWeekend = dow === 0 || dow === 6;
    const completionRate = isWeekend ? 0.65 : 0.85;
    taskIds.forEach(taskId => {
      if (rng() < completionRate) {
        completionRows.push({
          user_id: userId, task_date: dateKey(day),
          task_id: taskId, is_one_time: false,
        });
      }
    });
  }
  if (completionRows.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < completionRows.length; i += chunkSize) {
      await supabase.from('completions').insert(completionRows.slice(i, i + chunkSize));
    }
  }
}

export async function isFirstTimeUser(userId) {
  const { count, error } = await supabase
    .from('templates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count === 0;
}

export async function clearAllUserData(userId) {
  await supabase.from('completions').delete().eq('user_id', userId);
  await supabase.from('one_time_tasks').delete().eq('user_id', userId);
  await supabase.from('week_assignments').delete().eq('user_id', userId);
  await supabase.from('templates').delete().eq('user_id', userId);
  await supabase.from('weight_entries').delete().eq('user_id', userId);
  await supabase.from('custom_goals').delete().eq('user_id', userId);
}

// ---- Weight entries ----

export async function fetchWeightEntries(userId, daysBack = 365) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = addDays(today, -daysBack);
  const { data, error } = await supabase
    .from('weight_entries')
    .select('entry_date, weight_kg')
    .eq('user_id', userId)
    .gte('entry_date', dateKey(start))
    .order('entry_date', { ascending: true });
  if (error) throw error;
  return data.map(r => ({ date: r.entry_date, weight: Number(r.weight_kg) }));
}

export async function upsertWeightEntry(userId, entryDate, weightKg) {
  const { error } = await supabase.from('weight_entries').upsert(
    { user_id: userId, entry_date: entryDate, weight_kg: weightKg },
    { onConflict: 'user_id,entry_date' }
  );
  if (error) throw error;
}

export async function deleteWeightEntry(userId, entryDate) {
  const { error } = await supabase.from('weight_entries')
    .delete().eq('user_id', userId).eq('entry_date', entryDate);
  if (error) throw error;
}

// ---- Custom goals ----

export async function fetchCustomGoals(userId) {
  const { data, error } = await supabase
    .from('custom_goals')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data.map(g => ({
    id: g.id, name: g.name, category: g.category, weeklyTarget: g.weekly_target,
  }));
}

export async function addCustomGoal(userId, goal) {
  const { data, error } = await supabase.from('custom_goals').insert({
    user_id: userId, name: goal.name, category: goal.category,
    weekly_target: goal.weeklyTarget, sort_order: goal.sortOrder ?? 0,
  }).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, category: data.category, weeklyTarget: data.weekly_target };
}

export async function updateCustomGoal(goalId, patch) {
  const payload = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.weeklyTarget !== undefined) payload.weekly_target = patch.weeklyTarget;
  const { error } = await supabase.from('custom_goals').update(payload).eq('id', goalId);
  if (error) throw error;
}

export async function deleteCustomGoal(goalId) {
  const { error } = await supabase.from('custom_goals').delete().eq('id', goalId);
  if (error) throw error;
}
