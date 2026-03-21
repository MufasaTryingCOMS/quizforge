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
    .insert({ title, description: description || '', time_mins: time_mins || 0, questions: questions || [] })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT update quiz
app.put('/api/quizzes/:id', async (req, res) => {
  const { title, description, time_mins, questions } = req.body;
  const { data, error } = await supabase
    .from('quizzes')
    .update({ title, description, time_mins, questions })
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
// CATCH-ALL — serve frontend
// ════════════════════════════════════════════════════
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ QuizForge running on http://localhost:${PORT}`));
