import { supabase } from './supabaseClient';

// ---- Helpers ----

function getWeekStart() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);
  return sunday.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

function dateForDayIndex(dayIndex) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek + dayIndex);
  return sunday.toISOString().split('T')[0];
}

// ---- Templates ----

export async function fetchTemplates() {
  const { data, error } = await supabase
    .from('templates')
    .select('*, template_tasks(*)')
    .order('sort_order', { ascending: true });
  if (error) throw error;

  // Transform to the app's expected shape
  return data.map(t => ({
    id: t.id,
    name: t.name,
    accent: t.accent,
    tasks: (t.template_tasks || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(task => ({
        id: task.id,
        title: task.title,
        time: task.time,
        category: task.category,
      })),
  }));
}

export async function upsertTemplate(template, userId) {
  // Upsert the template itself
  const isNew = !template.id || template.id.startsWith('t'); // local IDs start with 't'
  const { data: tData, error: tErr } = isNew
    ? await supabase.from('templates').insert({
        user_id: userId, name: template.name, accent: template.accent,
      }).select().single()
    : await supabase.from('templates').update({
        name: template.name, accent: template.accent,
      }).eq('id', template.id).select().single();
  if (tErr) throw tErr;

  const templateId = tData.id;

  // Delete old tasks and re-insert (simpler than diffing)
  await supabase.from('template_tasks').delete().eq('template_id', templateId);

  if (template.tasks.length > 0) {
    const rows = template.tasks.map((task, i) => ({
      template_id: templateId,
      title: task.title,
      time: task.time,
      category: task.category,
      sort_order: i,
    }));
    const { error: tasksErr } = await supabase.from('template_tasks').insert(rows);
    if (tasksErr) throw tasksErr;
  }

  // Return the full template in app shape
  return fetchTemplateById(templateId);
}

async function fetchTemplateById(id) {
  const { data, error } = await supabase
    .from('templates')
    .select('*, template_tasks(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    accent: data.accent,
    tasks: (data.template_tasks || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(t => ({ id: t.id, title: t.title, time: t.time, category: t.category })),
  };
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw error;
}

// ---- Week Assignments ----

export async function fetchWeekAssignments() {
  const weekStart = getWeekStart();
  const { data, error } = await supabase
    .from('week_assignments')
    .select('day_index, template_id')
    .eq('week_start', weekStart);
  if (error) throw error;

  const assignments = {};
  for (let i = 0; i < 7; i++) assignments[i] = null;
  data.forEach(row => { assignments[row.day_index] = row.template_id; });
  return assignments;
}

export async function setWeekAssignment(dayIndex, templateId, userId) {
  const weekStart = getWeekStart();
  if (templateId === null) {
    // Remove assignment
    await supabase.from('week_assignments')
      .delete()
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .eq('day_index', dayIndex);
  } else {
    // Upsert assignment
    const { error } = await supabase.from('week_assignments').upsert({
      user_id: userId, week_start: weekStart, day_index: dayIndex, template_id: templateId,
    }, { onConflict: 'user_id,week_start,day_index' });
    if (error) throw error;
  }
}

// ---- One-Time Tasks ----

export async function fetchOneTimeTasks() {
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const endStr = weekEnd.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('one_time_tasks')
    .select('*')
    .gte('task_date', weekStart)
    .lte('task_date', endStr)
    .order('time', { ascending: true });
  if (error) throw error;

  // Group by day index
  const result = {};
  data.forEach(row => {
    const taskDate = new Date(row.task_date + 'T00:00:00');
    const sundayDate = new Date(weekStart + 'T00:00:00');
    const dayIdx = Math.round((taskDate - sundayDate) / 86400000);
    if (!result[dayIdx]) result[dayIdx] = [];
    result[dayIdx].push({
      id: row.id, title: row.title, time: row.time, category: row.category,
    });
  });
  return result;
}

export async function addOneTimeTask(dayIndex, task, userId) {
  const taskDate = dateForDayIndex(dayIndex);
  const { data, error } = await supabase.from('one_time_tasks').insert({
    user_id: userId, task_date: taskDate,
    title: task.title, time: task.time, category: task.category,
  }).select().single();
  if (error) throw error;
  return { id: data.id, title: data.title, time: data.time, category: data.category };
}

export async function removeOneTimeTask(taskId) {
  const { error } = await supabase.from('one_time_tasks').delete().eq('id', taskId);
  if (error) throw error;
}

// ---- Completions ----

export async function fetchCompletions() {
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const endStr = weekEnd.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('completions')
    .select('*')
    .gte('task_date', weekStart)
    .lte('task_date', endStr);
  if (error) throw error;

  const set = new Set();
  data.forEach(row => {
    const taskDate = new Date(row.task_date + 'T00:00:00');
    const sundayDate = new Date(weekStart + 'T00:00:00');
    const dayIdx = Math.round((taskDate - sundayDate) / 86400000);
    const key = row.is_one_time ? `${dayIdx}:oo:${row.task_id}` : `${dayIdx}:${row.task_id}`;
    set.add(key);
  });
  return set;
}

export async function toggleCompletion(dayIndex, taskId, isOneTime, isCurrentlyComplete, userId) {
  const taskDate = dateForDayIndex(dayIndex);
  if (isCurrentlyComplete) {
    await supabase.from('completions')
      .delete()
      .eq('user_id', userId)
      .eq('task_date', taskDate)
      .eq('task_id', taskId);
  } else {
    const { error } = await supabase.from('completions').insert({
      user_id: userId, task_date: taskDate, task_id: taskId, is_one_time: isOneTime,
    });
    if (error) throw error;
  }
}
