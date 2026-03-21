require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Supabase client (service role — backend only) ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// ════════════════════════════════════════════════════
// QUIZ ROUTES
// ════════════════════════════════════════════════════

// GET all quizzes
app.get('/api/quizzes', async (req, res) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET single quiz by id
app.get('/api/quizzes/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Quiz not found' });
  res.json(data);
});

// POST create quiz
app.post('/api/quizzes', async (req, res) => {
  const { title, description, time_mins, questions } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const { data, error } = await supabase
    .from('quizzes')
    .insert({ title, description: description || '', time_mins: time_mins || 0, questions: questions || [], reviews_open: false })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT update quiz
app.put('/api/quizzes/:id', async (req, res) => {
  const { title, description, time_mins, questions, reviews_open } = req.body;
  const update = { title, description, time_mins, questions };
  if (reviews_open !== undefined) update.reviews_open = reviews_open;
  const { data, error } = await supabase
    .from('quizzes')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH toggle reviews open/closed
app.patch('/api/quizzes/:id/reviews', async (req, res) => {
  const { reviews_open } = req.body;
  const { data, error } = await supabase
    .from('quizzes')
    .update({ reviews_open })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE quiz (also deletes submissions via cascade)
app.delete('/api/quizzes/:id', async (req, res) => {
  const { error } = await supabase
    .from('quizzes')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════
// SUBMISSION ROUTES
// ════════════════════════════════════════════════════

// GET all submissions for a quiz
app.get('/api/quizzes/:id/submissions', async (req, res) => {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('quiz_id', req.params.id)
    .order('submitted_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET single submission
app.get('/api/submissions/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Submission not found' });
  res.json(data);
});

// POST create submission
app.post('/api/submissions', async (req, res) => {
  const { quiz_id, name, responder_id, answers, earned, time_taken } = req.body;
  if (!quiz_id || !name || !responder_id) {
    return res.status(400).json({ error: 'quiz_id, name and responder_id are required' });
  }
  const { data, error } = await supabase
    .from('submissions')
    .insert({ quiz_id, name, responder_id, answers: answers || [], earned: earned || 0, time_taken: time_taken || null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE submission
app.delete('/api/submissions/:id', async (req, res) => {
  const { error } = await supabase
    .from('submissions')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════
// PROGRESS ROUTES
// ════════════════════════════════════════════════════

// GET progress for a responder on a quiz
app.get('/api/progress/:quiz_id/:responder_id', async (req, res) => {
  const { quiz_id, responder_id } = req.params;
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('quiz_id', quiz_id)
    .eq('responder_id', responder_id)
    .single();
  if (error) return res.status(404).json({ error: 'No progress found' });
  res.json(data);
});

// POST save / update progress (upsert)
app.post('/api/progress', async (req, res) => {
  const { quiz_id, responder_id, name, answers, checked, shuffled, current_q } = req.body;
  if (!quiz_id || !responder_id) return res.status(400).json({ error: 'quiz_id and responder_id are required' });
  const { data, error } = await supabase
    .from('progress')
    .upsert({ quiz_id, responder_id, name, answers, checked, shuffled, current_q },
      { onConflict: 'quiz_id,responder_id' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE progress after final submission (cleanup)
app.delete('/api/progress/:quiz_id/:responder_id', async (req, res) => {
  const { quiz_id, responder_id } = req.params;
  const { error } = await supabase
    .from('progress')
    .delete()
    .eq('quiz_id', quiz_id)
    .eq('responder_id', responder_id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// CHECK if responder has already submitted a quiz
app.get('/api/check/:quiz_id/:responder_id', async (req, res) => {
  const { quiz_id, responder_id } = req.params;
  const { data, error } = await supabase
    .from('submissions')
    .select('id, earned, submitted_at, answers, time_taken')
    .eq('quiz_id', quiz_id)
    .eq('responder_id', responder_id)
    .single();
  if (error) return res.json({ submitted: false });
  res.json({ submitted: true, submission: data });
});

// ════════════════════════════════════════════════════
// CATCH-ALL — serve frontend
// ════════════════════════════════════════════════════
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ QuizForge running on http://localhost:${PORT}`));
