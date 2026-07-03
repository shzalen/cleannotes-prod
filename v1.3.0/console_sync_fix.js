// 在清记应用内按 F12 打开 Console，粘贴以下全部内容并回车
// 功能：更新今日任务 startTime（9:30 起 +30min），同步写回 localStorage + 推送上 Supabase

(async () => {
  const uid = '7c9fd979-4f67-4931-ab1d-3a73ea63bbf3';
  const KEY = `cleannotes_${uid}_tasks`;
  const SUPABASE_URL = 'https://ghkyhbxltdxhkhpqltdr.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoa3loYnhsdGR4aGtocHFsdGRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDY1MTUsImV4cCI6MjA4NDA4MjUxNX0.vTtJRyPO_Q61QB6bTAv8X90ih-wMg9KlDuhXGKXy0FA';

  const raw = localStorage.getItem(KEY);
  if (!raw) { console.log('❌ 未找到本地任务数据'); return; }

  const tasks = JSON.parse(raw);
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks
    .filter(t => (t.createdAt || '').startsWith(today))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  if (todayTasks.length === 0) { console.log('❌ 今日无任务'); return; }

  // 更新 startTime
  let h = 9, m = 30;
  for (const t of todayTasks) {
    const hh = String(h).padStart(2, '0'), mm = String(m).padStart(2, '0');
    t.startTime = `${hh}:${mm}`;
    console.log(`✅ ${t.title} → ${hh}:${mm}`);
    m += 30;
    if (m >= 60) { m -= 60; h += 1; }
  }

  // 写回 localStorage
  localStorage.setItem(KEY, JSON.stringify(tasks));
  console.log(`✅ localStorage 已更新 (${todayTasks.length} 个任务)`);

  // 推送到 Supabase
  console.log('☁️ 正在推送到 Supabase...');
  const now = new Date().toISOString().replace('Z', '').slice(0, 19);
  let pushed = 0;
  for (const t of todayTasks) {
    try {
      const body = JSON.stringify({
        id: t.id,
        user_id: uid,
        title: t.title,
        priority: t.priority || 'medium',
        status: t.status || 'todo',
        due_date: t.dueDate || null,
        start_time: t.startTime || null,
        tags: t.tags || [],
        created_at: t.createdAt,
        updated_at: now,
        completed_at: t.completedAt || null,
      });
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/cleannote_tasks`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body,
      });
      if (resp.ok) pushed++;
      else console.warn(`  ⚠️ ${t.title}: ${resp.status} ${await resp.text()}`);
    } catch (e) {
      console.warn(`  ⚠️ ${t.title}: ${e.message}`);
    }
  }
  console.log(`☁️ Supabase 推送完成: ${pushed}/${todayTasks.length}`);

  console.log(`\n🎉 全部完成！刷新页面 (F5) 即可看到时间节点。`);
})();
