import React, { useEffect, useMemo, useRef, useState } from 'react'

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value))
const uid = () => Date.now() + Math.floor(Math.random() * 10000)
const initialQuestion = () => ({ id: uid(), type: 'mcq', text: '', options: ['', '', '', ''], answer: '0', points: 1 })

export default function App() {
  const [users, setUsers] = useState(() => read('qb_users', []))
  const [quizzes, setQuizzes] = useState(() => read('qb_quizzes', []))
  const [attempts, setAttempts] = useState(() => read('qb_attempts', []))
  const [user, setUser] = useState(() => read('qb_session', null))
  const [page, setPage] = useState(() => read('qb_session', null) ? (read('qb_session', null).role === 'admin' ? 'admin' : 'user') : 'home')
  const [authMode, setAuthMode] = useState('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [captcha, setCaptcha] = useState(() => { const a=Math.floor(Math.random()*9)+1,b=Math.floor(Math.random()*9)+1; return {a,b,answer:a+b} })
  const [captchaInput, setCaptchaInput] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' })
  const [editingId, setEditingId] = useState(null)
  const [quizForm, setQuizForm] = useState({ title: '', description: '', durationMinutes: 10, availableFrom: '', availableUntil: '', attemptLimit: 1, accessPassword: '', questions: [initialQuestion()] })
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const submittedRef = useRef(false)
  const [roomCode, setRoomCode] = useState('')
  const [roomName, setRoomName] = useState('')

  useEffect(() => write('qb_users', users), [users])
  useEffect(() => write('qb_quizzes', quizzes), [quizzes])
  useEffect(() => write('qb_attempts', attempts), [attempts])
  useEffect(() => write('qb_session', user), [user])

  // Each admin sees results only for quizzes created by that admin.
  // Resolve ownership through quizId so attempts from other admins never enter this board.
  const adminQuizIds = useMemo(() => new Set(
    quizzes.filter(quiz => quiz.createdBy === user?.email).map(quiz => String(quiz.id))
  ), [quizzes, user?.email])
  const adminQuizzes = useMemo(() => user?.role === 'admin'
    ? quizzes.filter(quiz => quiz.createdBy === user.email)
    : [], [quizzes, user?.email, user?.role])
  const adminAttempts = useMemo(() => user?.role === 'admin'
    ? attempts.filter(attempt => adminQuizIds.has(String(attempt.quizId)))
    : [], [attempts, adminQuizIds, user?.role])
  const adminStats = useMemo(() => ({
    quizzes: adminQuizzes.length,
    users: new Set(adminAttempts.map(a => a.userEmail).filter(Boolean)).size,
    attempts: adminAttempts.length,
    average: adminAttempts.length ? Math.round(adminAttempts.reduce((n, a) => n + Number(a.percent || 0), 0) / adminAttempts.length) : 0
  }), [adminQuizzes, adminAttempts])

  const leaderboard = useMemo(() => {
    const grouped = adminAttempts.reduce((map, attempt) => {
      const key = attempt.userEmail || attempt.userName
      if (!map[key]) map[key] = { name: attempt.userName || 'Student', email: key, attempts: 0, totalPercent: 0, points: 0, bestQuiz: null }
      map[key].attempts += 1
      map[key].totalPercent += Number(attempt.percent || 0)
      map[key].points += Number(attempt.score || 0)
      const best = map[key].bestQuiz
      // The best-scoring quiz is the quiz with the highest raw marks.
      // If marks are tied, prefer the higher percentage.
      if (!best || Number(attempt.score || 0) > Number(best.score || 0) ||
          (Number(attempt.score || 0) === Number(best.score || 0) && Number(attempt.percent || 0) > Number(best.percent || 0))) {
        map[key].bestQuiz = { title: attempt.quizTitle || 'Untitled quiz', score: Number(attempt.score || 0), total: Number(attempt.total || 0), percent: Number(attempt.percent || 0) }
      }
      return map
    }, {})
    return Object.values(grouped).map(row => ({ ...row, average: Math.round(row.totalPercent / row.attempts) }))
      .sort((a, b) => b.average - a.average || b.points - a.points || a.name.localeCompare(b.name))
  }, [adminAttempts])

  const stats = useMemo(() => ({
    quizzes: quizzes.length,
    users: users.filter(u => u.role === 'user').length,
    attempts: attempts.length,
    average: attempts.length ? Math.round(attempts.reduce((n, a) => n + a.percent, 0) / attempts.length) : 0
  }), [quizzes, users, attempts])

  function go(next) {
    // Admin-only pages are restricted to admins. Students cannot open admin reports or leaderboards.
    if (['admin', 'create', 'reports', 'leaderboard'].includes(next) && user?.role !== 'admin') next = user ? 'user' : 'home'
    if (next === 'take' && user?.role !== 'user') next = user ? 'admin' : 'home'
    setMessage(''); setPage(next); window.scrollTo(0, 0)
  }
  function logout() { setUser(null); localStorage.removeItem('qb_session'); setActiveQuiz(null); go('home') }

  function submitAuth(e) {
    e.preventDefault()
    const email = form.email.trim().toLowerCase()
    if (!email || !form.password || (authMode === 'signup' && !form.name.trim())) return setMessage('Please complete all required fields.')
    if (authMode === 'signup') {
      if (users.some(u => u.email === email)) return setMessage('An account with this email already exists.')
      const newUser = { id: uid(), name: form.name.trim(), email, password: form.password, role: form.role }
      setUsers([...users, newUser]); setUser(newUser); go(newUser.role === 'admin' ? 'admin' : 'user')
    } else {
      const found = users.find(u => u.email === email && u.password === form.password)
      if (!found) return setMessage('Invalid email or password. Please sign up first.')
      setUser(found); go(found.role === 'admin' ? 'admin' : 'user')
    }
  }

  function resetPasswordSubmit(e) {
    e.preventDefault()
    const email = resetEmail.trim().toLowerCase()
    if (!email || !resetPassword) return setMessage('Enter your registered email and a new password.')
    if (Number(captchaInput) !== captcha.answer) return setMessage('Captcha answer is incorrect.')
    const found = users.find(u => u.email === email)
    if (!found) return setMessage('No account exists with that email.')
    setUsers(old => old.map(u => u.email === email ? { ...u, password: resetPassword } : u))
    setForm({ name: '', email, password: '', role: 'user' })
    setResetEmail(''); setResetPassword(''); setCaptchaInput('')
    setCaptcha(() => { const a=Math.floor(Math.random()*9)+1,b=Math.floor(Math.random()*9)+1; return {a,b,answer:a+b} })
    setMessage('Password changed. You can now log in with your new password.')
    setAuthMode('login')
  }

  function updateQuestion(id, patch) {
    setQuizForm(f => ({ ...f, questions: f.questions.map(q => q.id === id ? { ...q, ...patch } : q) }))
  }
  function saveQuiz(e) {
    e.preventDefault()
    if (!quizForm.title.trim()) return setMessage('Enter a quiz title.')
    if (!Number.isFinite(Number(quizForm.durationMinutes)) || Number(quizForm.durationMinutes) < 1 || Number(quizForm.durationMinutes) > 600) return setMessage('Set a quiz duration between 1 and 600 minutes.')
    if (!Number.isInteger(Number(quizForm.attemptLimit)) || Number(quizForm.attemptLimit) < 1 || Number(quizForm.attemptLimit) > 100) return setMessage('Set an attempt limit between 1 and 100.')
    if (quizForm.availableFrom && quizForm.availableUntil && new Date(quizForm.availableUntil) <= new Date(quizForm.availableFrom)) return setMessage('Access end time must be later than access start time.')
    if (!quizForm.questions.length || quizForm.questions.some(q => !q.text.trim())) return setMessage('Enter text for every question.')
    for (const q of quizForm.questions) {
      if (q.type === 'mcq' && (q.options.some(o => !o.trim()) || Number(q.answer) < 0 || Number(q.answer) > 3)) return setMessage('Complete all MCQ options and choose the correct answer.')
      if (q.type === 'truefalse' && !['true', 'false'].includes(q.answer)) return setMessage('Choose the correct True/False answer.')
      if (q.type === 'open' && !q.answer.trim()) return setMessage('Add an expected answer for each open-ended question.')
    }
    if (user?.role !== 'admin') return setMessage('Only admins can create or edit quizzes.')
    const existingQuiz = editingId ? quizzes.find(q => String(q.id) === String(editingId)) : null
    if (editingId && (!existingQuiz || existingQuiz.createdBy !== user.email)) return setMessage('You can edit only quizzes created by your account.')
    const item = { ...quizForm, durationMinutes: Number(quizForm.durationMinutes || 10), attemptLimit: Number(quizForm.attemptLimit || 1), accessPassword: String(quizForm.accessPassword || '').trim(), id: editingId || uid(), createdBy: existingQuiz ? existingQuiz.createdBy : user.email, updatedAt: new Date().toISOString() }
    setQuizzes(old => editingId ? old.map(q => String(q.id) === String(editingId) && q.createdBy === user.email ? item : q) : [...old, item])
    setEditingId(null); setQuizForm({ title: '', description: '', durationMinutes: 10, availableFrom: '', availableUntil: '', attemptLimit: 1, accessPassword: '', questions: [initialQuestion()] }); setMessage('Quiz saved successfully.')
  }
  function editQuiz(q) {
    if (user?.role !== 'admin' || q.createdBy !== user.email) return setMessage('You can edit only quizzes created by your account.')
    setEditingId(q.id); setQuizForm({ title: q.title, description: q.description || '', durationMinutes: Number(q.durationMinutes || 10), availableFrom: q.availableFrom || '', availableUntil: q.availableUntil || '', attemptLimit: Number(q.attemptLimit || 1), accessPassword: q.accessPassword || '', questions: q.questions.map(x => ({ ...x })) }); go('create')
  }
  function deleteQuiz(id) {
    const target = quizzes.find(q => String(q.id) === String(id))
    if (user?.role !== 'admin' || !target || target.createdBy !== user.email) return setMessage('You can delete only quizzes created by your account.')
    if (confirm('Delete this quiz?')) setQuizzes(old => old.filter(q => !(String(q.id) === String(id) && q.createdBy === user.email)))
  }
  function startQuiz(quiz, enteredPassword = '') {
    if (user?.role !== 'user') return setMessage('Only student accounts can attempt quizzes.')
    if (quiz.accessPassword && enteredPassword !== quiz.accessPassword) return setMessage('Incorrect quiz password. Ask the admin for the correct password.')
    const now = Date.now()
    const from = quiz.availableFrom ? new Date(quiz.availableFrom).getTime() : null
    const until = quiz.availableUntil ? new Date(quiz.availableUntil).getTime() : null
    if (from && now < from) return setMessage(`This quiz opens on ${new Date(from).toLocaleString()}.`)
    if (until && now > until) return setMessage('The access period for this quiz has ended.')
    const usedAttempts = attempts.filter(a => String(a.quizId) === String(quiz.id) && a.userEmail === user.email).length
    const limit = Number(quiz.attemptLimit || 1)
    if (usedAttempts >= limit) return setMessage(`You have reached the maximum of ${limit} attempt(s) for this quiz.`)
    const ordered = [...quiz.questions]
    for (let i = ordered.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ordered[i], ordered[j]] = [ordered[j], ordered[i]] }
    const durationMinutes = Number(quiz.durationMinutes || 10)
    submittedRef.current = false
    const expiresAt = Date.now() + durationMinutes * 60 * 1000
    setActiveQuiz({ ...quiz, durationMinutes, expiresAt, questions: ordered }); setRemainingSeconds(durationMinutes * 60); setQuestionIndex(0); setAnswers({}); go('take')
  }
  function finishQuiz(autoSubmitted = false) {
    if (!activeQuiz || submittedRef.current) return
    submittedRef.current = true
    const total = activeQuiz.questions.reduce((n, q) => n + Number(q.points || 1), 0)
    let score = 0
    const details = activeQuiz.questions.map(q => {
      const given = String(answers[q.id] ?? '').trim()
      const expected = String(q.answer ?? '').trim()
      const correct = q.type === 'open' ? given.toLowerCase() === expected.toLowerCase() : given === expected
      if (correct) score += Number(q.points || 1)
      return { question: q.text, given, expected, correct, type: q.type }
    })
    const attempt = { autoSubmitted, quizId: activeQuiz.id, id: uid(), quizTitle: activeQuiz.title, userEmail: user.email, userName: user.name, score, total, percent: total ? Math.round(score / total * 100) : 0, date: new Date().toLocaleString(), details }
    setAttempts(old => [...old, attempt]); setActiveQuiz(null); setActiveResult(attempt); go('result')
  }
  useEffect(() => {
    if (!activeQuiz || page !== 'take') return
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((activeQuiz.expiresAt - Date.now()) / 1000))
      setRemainingSeconds(seconds)
      if (seconds <= 0) finishQuiz(true)
    }
    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [activeQuiz, page, answers])

  const [activeResult, setActiveResult] = useState(null)
  function joinRoom(e) {
    e.preventDefault()
    if (user?.role !== 'user') return setMessage('Only student accounts can join quizzes.')
    const quiz = quizzes.find(q => String(q.id).slice(-6) === roomCode.trim() || q.title.toLowerCase() === roomName.trim().toLowerCase())
    if (!quiz) return setMessage('No quiz found. Ask the admin for the quiz code (last 6 digits of quiz ID).')
    const entered = quiz.accessPassword ? window.prompt('Enter the password provided by the admin to attempt this quiz:') : ''
    if (quiz.accessPassword && entered === null) return
    startQuiz(quiz, entered || '')
  }

  const nav = user ? <header className="topbar"><button className="brand" onClick={() => go(user.role === 'admin' ? 'admin' : 'user')}>Quiz<span>Builder</span></button><div className="navright">{user.role === 'admin' && <button className="navlink" onClick={() => go('leaderboard')}>Leaderboard</button>}<span className="welcome">Hi, {user.name}</span><button className="ghost" onClick={logout}>Logout</button></div></header> : null
  const quizCode = q => String(q.id).slice(-6)

  return <div className="app">
    {!user && <header className="topbar"><button className="brand" onClick={() => go('home')}>Quiz<span>Builder</span></button><div className="navright"><button className="ghost" onClick={() => { setAuthMode('login'); go('auth') }}>Login</button><button className="small" onClick={() => { setAuthMode('signup'); go('auth') }}>Sign up</button></div></header>}
    {nav}
    {page === 'home' && <main className="hero"><div className="eyebrow">LEARN · PLAY · IMPROVE</div><h1>Make learning<br/><span>interactive.</span></h1><p className="lead">Create quizzes, challenge yourself, and track your progress in one simple place.</p><div className="actions"><button onClick={() => { setAuthMode('signup'); go('auth') }}>Get started</button><button className="outline" onClick={() => { setAuthMode('login'); go('auth') }}>I already have an account</button></div><div className="featuregrid"><article><b>01 / CREATE</b><h3>Build your quiz</h3><p>Add multiple-choice, true/false, and open-ended questions.</p></article><article><b>02 / PARTICIPATE</b><h3>Take a challenge</h3><p>Attempt randomized quizzes and get your result immediately.</p></article><article><b>03 / ANALYZE</b><h3>Track progress</h3><p>Review attempts, scores, and performance reports.</p></article></div></main>}

    {page === 'auth' && <main className="auth panel"><div className="eyebrow">YOUR LEARNING SPACE</div><h2>{authMode === 'reset' ? 'Reset password' : authMode === 'login' ? 'Welcome back' : 'Create an account'}</h2><p className="muted">{authMode === 'reset' ? 'Verify the captcha and choose a new password.' : authMode === 'login' ? 'Log in to continue to Quiz Builder.' : 'Join and start creating or taking quizzes.'}</p>{authMode === 'reset' ? <form onSubmit={resetPasswordSubmit} className="stack"><label>Registered email<input type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="you@example.com"/></label><label>New password<input type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} placeholder="Enter new password"/></label><label>Captcha: {captcha.a} + {captcha.b} = ?<input type="number" value={captchaInput} onChange={e=>setCaptchaInput(e.target.value)} placeholder="Enter answer"/></label><button className="full">Change password</button></form> : <form onSubmit={submitAuth} className="stack">
      {authMode === 'signup' && <label>Full name<input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Your name" /></label>}
      <label>Email address<input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="you@example.com" /></label>
      <label>Password<input type="password" value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder="Enter password" /></label>
      {authMode === 'signup' && <label>Account type<select value={form.role} onChange={e => setForm({...form, role:e.target.value})}><option value="user">User / Student</option><option value="admin">Admin / Teacher</option></select></label>}
      {message && <p className="message">{message}</p>}<button type="submit" className="full">{authMode === 'login' ? 'Login' : 'Create account'}</button>
    </form>}{message && <p className="message">{message}</p>}{authMode === 'login' && <p className="switch"><button className="textbtn" onClick={()=>{setMessage('');setAuthMode('reset')}}>Forgot password?</button></p>}<p className="switch">{authMode === 'login' ? "Don't have an account?" : authMode === 'reset' ? 'Remembered your password?' : 'Already registered?'} <button className="textbtn" onClick={() => {setAuthMode(authMode === 'login' ? 'signup' : 'login');setMessage('')}}>{authMode === 'login' ? 'Sign up' : 'Login'}</button></p><p className="hint">Demo note: accounts are stored in this browser using Local Storage.</p></main>}

    {page === 'admin' && <main className="content"><div className="pagehead"><div><div className="eyebrow">ADMIN WORKSPACE</div><h1>Dashboard</h1><p className="muted">Manage quizzes and review learner performance.</p></div><button onClick={() => {setEditingId(null);setQuizForm({title:'',description:'',durationMinutes:10,availableFrom:'',availableUntil:'',attemptLimit:1,accessPassword:'',questions:[initialQuestion()]});go('create')}}>＋ Create quiz</button></div><div className="stats"><Stat label="Your quizzes" value={adminStats.quizzes}/><Stat label="Your participants" value={adminStats.users}/><Stat label="Your quiz attempts" value={adminStats.attempts}/><Stat label="Average score" value={`${adminStats.average}%`}/></div><section className="section"><div className="sectiontitle"><h2>Manage quizzes</h2><span>{adminQuizzes.length} total</span></div>{adminQuizzes.length === 0 ? <Empty text="You have not created any quizzes yet. Create your first quiz."/> : <div className="quizgrid">{adminQuizzes.map(q=><article className="quizcard" key={q.id}><div className="cardtop"><span className="tag">QUIZ</span><span className="muted smalltext">{q.questions.length} questions · {Number(q.durationMinutes || 10)} min</span></div><h3>{q.title}</h3><p>{q.description || 'No description added.'}</p><p className="code">Join code: <b>{quizCode(q)}</b></p><div className="cardactions"><button className="outline" onClick={()=>editQuiz(q)}>Edit</button><button className="danger" onClick={()=>deleteQuiz(q.id)}>Delete</button></div></article>)}</div>}</section><section className="section"><div className="sectiontitle"><h2>Recent attempts</h2><button className="outline" onClick={()=>go('reports')}>View full report</button></div><AttemptsTable attempts={adminAttempts.slice(-5).reverse()}/></section></main>}

    {page === 'create' && <main className="content narrow"><div className="pagehead"><div><div className="eyebrow">QUIZ EDITOR</div><h1>{editingId ? 'Edit quiz' : 'Create a quiz'}</h1><p className="muted">Add questions and set the expected answer for automatic scoring.</p></div><button className="outline" onClick={()=>go('admin')}>Back</button></div><form onSubmit={saveQuiz} className="panel stack"><label>Quiz title<input value={quizForm.title} onChange={e=>setQuizForm({...quizForm,title:e.target.value})} placeholder="Example: Java Basics"/></label><label>Description<textarea value={quizForm.description} onChange={e=>setQuizForm({...quizForm,description:e.target.value})} placeholder="What is this quiz about?"/></label><label>Quiz duration (minutes)<input type="number" min="1" max="600" value={quizForm.durationMinutes} onChange={e=>setQuizForm({...quizForm,durationMinutes:e.target.value})} /><span className="muted smalltext">Students will have this much time after starting the quiz.</span></label><label>Quiz opens at (optional)<input type="datetime-local" value={quizForm.availableFrom || ''} onChange={e=>setQuizForm({...quizForm,availableFrom:e.target.value})}/></label><label>Quiz closes at (optional)<input type="datetime-local" value={quizForm.availableUntil || ''} onChange={e=>setQuizForm({...quizForm,availableUntil:e.target.value})}/><span className="muted smalltext">Students can access the quiz only between these times. Leave blank for no restriction.</span></label><label>Maximum attempts per student<input type="number" min="1" max="100" value={quizForm.attemptLimit} onChange={e=>setQuizForm({...quizForm,attemptLimit:e.target.value})}/></label><label>Quiz password (optional)<input type="text" value={quizForm.accessPassword || ""} onChange={e=>setQuizForm({...quizForm,accessPassword:e.target.value})} placeholder="Set a password students must enter"/><span className="muted smalltext">Students must enter this password before the quiz starts. Leave blank for no password.</span></label><div className="sectiontitle"><h2>Questions</h2><span>{quizForm.questions.length} added</span></div>{quizForm.questions.map((q,i)=><div className="questioneditor" key={q.id}><div className="sectiontitle"><h3>Question {i+1}</h3>{quizForm.questions.length>1 && <button type="button" className="textbtn red" onClick={()=>setQuizForm({...quizForm,questions:quizForm.questions.filter(x=>x.id!==q.id)})}>Remove</button>}</div><label>Question type<select value={q.type} onChange={e=>updateQuestion(q.id,{type:e.target.value,answer:e.target.value==='truefalse'?'true':e.target.value==='open'?'':'0'})}><option value="mcq">Multiple choice</option><option value="truefalse">True / False</option><option value="open">Open-ended</option></select></label><label>Question text<textarea value={q.text} onChange={e=>updateQuestion(q.id,{text:e.target.value})} placeholder="Enter your question"/></label>
      {q.type==='mcq' && <><div className="optioneditor">{q.options.map((o,j)=><label key={j}>Option {j+1}<input value={o} onChange={e=>updateQuestion(q.id,{options:q.options.map((v,k)=>k===j?e.target.value:v)})} placeholder={`Option ${j+1}`}/></label>)}</div><label>Correct option<select value={q.answer} onChange={e=>updateQuestion(q.id,{answer:e.target.value})}>{q.options.map((o,j)=><option value={String(j)} key={j}>Option {j+1}{o?` — ${o}`:''}</option>)}</select></label></>}
      {q.type==='truefalse' && <label>Correct answer<select value={q.answer} onChange={e=>updateQuestion(q.id,{answer:e.target.value})}><option value="true">True</option><option value="false">False</option></select></label>}
      {q.type==='open' && <label>Expected answer <input value={q.answer} onChange={e=>updateQuestion(q.id,{answer:e.target.value})} placeholder="Exact answer used for automatic checking"/></label>}
      <label>Points<input type="number" min="1" max="100" value={q.points} onChange={e=>updateQuestion(q.id,{points:Number(e.target.value)})}/></label></div>)}
      <button type="button" className="outline full" onClick={()=>setQuizForm({...quizForm,questions:[...quizForm.questions,initialQuestion()]})}>＋ Add another question</button>{message && <p className="message">{message}</p>}<button className="full" type="submit">{editingId?'Update quiz':'Save quiz'}</button></form></main>}

    {page === 'user' && <main className="content"><div className="pagehead"><div><div className="eyebrow">STUDENT WORKSPACE</div><h1>Available quizzes</h1><p className="muted">Choose a quiz or join using the code shared by your teacher.</p></div></div><form className="joinbox" onSubmit={joinRoom}><div><b>Join a quiz</b><p className="muted">Enter the 6-digit quiz code shown by the admin.</p></div><input value={roomCode} onChange={e=>setRoomCode(e.target.value)} placeholder="Quiz code" maxLength="6"/><button>Join quiz</button></form>{message && <p className="message">{message}</p>}<div className="quizgrid">{quizzes.map(q=>{const used=attempts.filter(a=>String(a.quizId)===String(q.id)&&a.userEmail===user.email).length;const from=q.availableFrom?new Date(q.availableFrom).getTime():0;const until=q.availableUntil?new Date(q.availableUntil).getTime():Infinity;const canStart=Date.now()>=from&&Date.now()<=until&&used<Number(q.attemptLimit||1);return <article className="quizcard" key={q.id}><span className="tag">{canStart?'AVAILABLE':'RESTRICTED'}</span><h3>{q.title}</h3><p>{q.description || 'Test your knowledge with this quiz.'}</p><p className="muted smalltext">{q.questions.length} questions · {Number(q.durationMinutes||10)} min · {used}/{Number(q.attemptLimit||1)} attempts used</p>{q.availableFrom&&<p className="muted smalltext">Opens: {new Date(q.availableFrom).toLocaleString()}</p>}{q.availableUntil&&<p className="muted smalltext">Closes: {new Date(q.availableUntil).toLocaleString()}</p>}<p className="code">Code: <b>{quizCode(q)}</b></p><button disabled={!canStart} onClick={()=>{const entered=q.accessPassword?window.prompt('Enter the quiz password provided by the admin:'):'';if(q.accessPassword&&entered===null)return;startQuiz(q,entered||'')}}>{used>=Number(q.attemptLimit||1)?'Attempt limit reached':Date.now()<from?'Not open yet':Date.now()>until?'Closed':'Start quiz'}</button></article>})}</div>{quizzes.length===0 && <Empty text="No quizzes published yet. Please check again later."/>}<section className="section"><h2>My recent attempts</h2><AttemptsTable attempts={attempts.filter(a=>a.userEmail===user.email).slice(-5).reverse()}/></section></main>}

    {page === 'take' && activeQuiz && <main className="content narrow"><div className="quizstage"><div className="eyebrow">QUIZ IN PROGRESS</div><div className="progressrow"><span>Question {questionIndex+1} of {activeQuiz.questions.length}</span><span>{Math.round((questionIndex+1)/activeQuiz.questions.length*100)}%</span></div><div className="progress"><i style={{width:`${(questionIndex+1)/activeQuiz.questions.length*100}%`}}/></div><h1>{activeQuiz.title}</h1><div className={`timerbox ${remainingSeconds <= 60 ? 'timerwarning' : ''}`}><span>TIME REMAINING</span><strong>{String(Math.floor(remainingSeconds/60)).padStart(2,'0')}:{String(remainingSeconds%60).padStart(2,'0')}</strong></div>{(()=>{const q=activeQuiz.questions[questionIndex];return <div className="panel"><span className="tag">{q.type==='mcq'?'MULTIPLE CHOICE':q.type==='truefalse'?'TRUE / FALSE':'OPEN ENDED'} · {q.points} point(s)</span><h2 className="quizquestion">{q.text}</h2>{q.type==='mcq' && <div className="answerlist">{q.options.map((o,i)=><button key={i} className={`answer ${answers[q.id]===String(i)?'chosen':''}`} onClick={()=>setAnswers({...answers,[q.id]:String(i)})}>{String.fromCharCode(65+i)}. {o}</button>)}</div>}{q.type==='truefalse' && <div className="answerlist two">{['true','false'].map(v=><button key={v} className={`answer ${answers[q.id]===v?'chosen':''}`} onClick={()=>setAnswers({...answers,[q.id]:v})}>{v==='true'?'True':'False'}</button>)}</div>}{q.type==='open' && <label>Your answer<textarea value={answers[q.id]||''} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})} placeholder="Type your answer here"/></label>}<div className="quiznav"><button className="outline" disabled={questionIndex===0} onClick={()=>setQuestionIndex(questionIndex-1)}>Previous</button>{questionIndex<activeQuiz.questions.length-1?<button onClick={()=>setQuestionIndex(questionIndex+1)}>Next question</button>:<button onClick={()=>{if(activeQuiz.questions.some(q=>!String(answers[q.id]??'').trim())){if(!confirm('Some questions are unanswered. Submit anyway?'))return}finishQuiz()}}>Submit quiz</button>}</div></div>})()}</div></main>}

    {page === 'result' && activeResult && <main className="content narrow"><div className="panel resultpanel"><div className="eyebrow">QUIZ COMPLETED</div><h1>Your result</h1><div className="score">{activeResult.score}<span> / {activeResult.total}</span></div><h2>{activeResult.percent}%</h2>{activeResult.autoSubmitted && <p className="message">Time is up. Your quiz was submitted automatically.</p>}<p className="muted">{activeResult.percent>=80?'Excellent work!':activeResult.percent>=50?'Good effort. Keep practicing!':'Keep learning and try again!'}</p><div className="review">{activeResult.details.map((d,i)=><div className="reviewitem" key={i}><b>{i+1}. {d.question}</b><p>Your answer: {d.given || 'Not answered'}</p><p>Expected answer: {d.type==='mcq'?`Option ${Number(d.expected)+1}`:d.expected}</p><span className={d.correct?'correct':'incorrect'}>{d.correct?'Correct':'Incorrect'}</span></div>)}</div><button onClick={()=>go('user')}>Back to dashboard</button></div></main>}

    {page === 'reports' && <main className="content"><div className="pagehead"><div><div className="eyebrow">PERFORMANCE</div><h1>Quiz reports</h1><p className="muted">Review all recorded quiz attempts.</p></div><button className="outline" onClick={()=>go('admin')}>Back to dashboard</button></div><div className="stats"><Stat label="Your attempts" value={adminStats.attempts}/><Stat label="Average score" value={`${adminStats.average}%`}/><Stat label="Your quizzes" value={adminStats.quizzes}/><Stat label="Your participants" value={adminStats.users}/></div><AttemptsTable attempts={[...adminAttempts].reverse()} detailed/></main>}

    {page === 'leaderboard' && user?.role === 'admin' && <main className="content"><div className="pagehead"><div><div className="eyebrow">CAMPUS CHAMPIONS</div><h1>Leaderboard</h1><p className="muted">Rankings are based on average quiz percentage. Ties are broken by total points.</p></div><button className="outline" onClick={()=>go(user.role === 'admin' ? 'admin' : 'user')}>Back to dashboard</button></div><div className="stats"><Stat label="Participants" value={leaderboard.length}/><Stat label="Quiz attempts in your quizzes" value={adminAttempts.length}/><Stat label="Top average" value={leaderboard[0] ? `${leaderboard[0].average}%` : '—'}/><Stat label="Your average" value={leaderboard.find(row=>row.email===user.email) ? `${leaderboard.find(row=>row.email===user.email).average}%` : '—'}/></div>{leaderboard.length ? <div className="panel leaderboard-panel"><div className="sectiontitle"><h2>Top performers</h2><span>All-time rankings</span></div><div className="tablewrap"><table><thead><tr><th>Rank</th><th>Student</th><th>Average score</th><th>Total points</th><th>Best-scoring quiz</th><th>Quizzes taken</th></tr></thead><tbody>{leaderboard.map((row,index)=><tr key={row.email} className={row.email===user.email?'current-user':''}><td><span className={`rank rank-${index+1}`}>{index===0?'🥇':index===1?'🥈':index===2?'🥉':`#${index+1}`}</span></td><td>{row.name}{row.email===user.email?' (You)':''}</td><td><span className="tag">{row.average}%</span></td><td>{row.points}</td><td>{row.bestQuiz ? <>{row.bestQuiz.title} <span className="muted smalltext">({row.bestQuiz.score}/{row.bestQuiz.total})</span></> : '—'}</td><td>{row.attempts}</td></tr>)}</tbody></table></div></div> : <Empty text="No quiz attempts yet. Complete a quiz to appear on the leaderboard."/>}</main>}
    <footer>Quiz Builder <span>·</span> React + Vite <span>·</span> Local Storage demo</footer>
  </div>
}

function Stat({label,value}) { return <div className="stat"><span>{label}</span><b>{value}</b></div> }
function Empty({text}) { return <div className="empty">{text}</div> }
function AttemptsTable({attempts,detailed=false}) {
  if (!attempts.length) return <Empty text="No quiz attempts recorded yet."/>
  return <div className="tablewrap"><table><thead><tr><th>Student</th><th>Quiz</th><th>Score</th><th>Percentage</th><th>Date</th></tr></thead><tbody>{attempts.map(a=><tr key={a.id}><td>{a.userName}</td><td>{a.quizTitle}</td><td>{a.score}/{a.total}</td><td><span className="tag">{a.percent}%</span></td><td>{a.date}</td></tr>)}</tbody></table></div>
}