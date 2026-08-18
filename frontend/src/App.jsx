import React, { useState, useEffect, useRef } from 'react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { 
  BrainCircuit, MessageSquare, Bot, LogIn, LogOut, 
  Star, AlertTriangle, CheckCircle, RefreshCw, Filter, 
  FileText, BookOpen, Clock, Activity, Sparkles, Send,
  ArrowRight
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

const DEFAULT_SECTIONS = [
  {
    title: "Teaching Quality",
    questions: [
      { key: "q1", label: "How clearly did the instructor explain concepts?" },
      { key: "q2", label: "Was the instructor well-prepared for classes?" },
      { key: "q3", label: "Was the pace of teaching appropriate?" },
      { key: "q4", label: "Did the instructor answer questions effectively?" },
      { key: "q5", label: "Did the instructor encourage participation?" },
      { key: "q6", label: "Were real-world examples provided?" }
    ]
  },
  {
    title: "Course Content",
    questions: [
      { key: "q1", label: "Was the syllabus relevant?" },
      { key: "q2", label: "Was the course content easy to understand?" },
      { key: "q3", label: "Were learning objectives clear?" },
      { key: "q4", label: "Did the course improve your knowledge?" },
      { key: "q5", label: "Was the course organised well?" }
    ]
  },
  {
    title: "Laboratory / Practical Sessions",
    questions: [
      { key: "q1", label: "Were practical sessions useful?" },
      { key: "q2", label: "Was laboratory equipment sufficient?" },
      { key: "q3", label: "Were lab computers in good condition?" },
      { key: "q4", label: "Was software available when needed?" },
      { key: "q5", label: "Were practical exercises aligned with theory?" }
    ]
  },
  {
    title: "Assignments & Evaluation",
    questions: [
      { key: "q1", label: "Were assignments useful?" },
      { key: "q2", label: "Were assignments clearly explained?" },
      { key: "q3", label: "Was feedback on assignments helpful?" },
      { key: "q4", label: "Was evaluation fair?" },
      { key: "q5", label: "Were deadlines reasonable?" }
    ]
  },
  {
    title: "Infrastructure",
    questions: [
      { key: "q1", label: "Classroom condition" },
      { key: "q2", label: "Internet/Wi-Fi quality" },
      { key: "q3", label: "Projector and smart board availability" },
      { key: "q4", label: "Computer laboratory quality" },
      { key: "q5", label: "Library resources" },
      { key: "q6", label: "Cleanliness" }
    ]
  },
  {
    title: "Student Support",
    questions: [
      { key: "q1", label: "Faculty availability outside class" },
      { key: "q2", label: "Academic guidance" },
      { key: "q3", label: "Career guidance" },
      { key: "q4", label: "Technical support" },
      { key: "q5", label: "Administrative support" }
    ]
  },
  {
    title: "Overall Satisfaction",
    questions: [
      { key: "q1", label: "Overall course satisfaction" },
      { key: "q2", label: "Would you recommend this course?" },
      { key: "q3", label: "Would you recommend this faculty member?" },
      { key: "q4", label: "Did this course meet your expectations?" }
    ]
  }
];

const initializeRatings = (sections) => {
  const ratings = {};
  (sections || []).forEach(sec => {
    ratings[sec.title] = {};
    (sec.questions || []).forEach(q => {
      ratings[sec.title][q.key] = 0; // Default to 0 stars (unfilled)
    });
  });
  return ratings;
};

const initializeTexts = (sections) => {
  const texts = {};
  (sections || []).forEach(sec => {
    texts[sec.title] = "";
  });
  return texts;
};

function App() {
  // Auth state
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token') || '';
    } catch (e) {
      return '';
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored && (stored.startsWith('{') || stored.startsWith('[') || stored === 'null')) {
        return JSON.parse(stored);
      }
      return null;
    } catch (e) {
      return null;
    }
  });
  
  // Navigation
  const [currentView, setCurrentView] = useState(() => {
    try {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (savedToken && savedUser) {
        const u = JSON.parse(savedUser);
        return u.role === 'student' ? 'student-dashboard' : 'dashboard';
      }
    } catch (e) {}
    if (window.location.pathname === '/admin') {
      return 'admin-login';
    }
    return 'login';
  });
  const [formStep, setFormStep] = useState(0); // 0: metadata selection, 1-7: sections, 8: review & submit
  
  // Theme state
  const [theme, setTheme] = useState('dark');

  // Metadata arrays
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  
  // Dashboard & Feedbacks data
  const [dashboardData, setDashboardData] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  
  // Filter state
  const [filters, setFilters] = useState({
    subject_id: '',
    teacher_id: '',
    semester: ''
  });

  // Login form state
  const [loginRole, setLoginRole] = useState('student'); // 'student' or 'faculty'
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Feedback categories and questions state (Admin dynamic template)
  const [feedbackSections, setFeedbackSections] = useState(() => {
    try {
      const saved = localStorage.getItem('custom_feedback_sections');
      return saved ? JSON.parse(saved) : DEFAULT_SECTIONS;
    } catch (e) {
      return DEFAULT_SECTIONS;
    }
  });

  // Student Feedback form state
  const [studentForm, setStudentForm] = useState(() => ({
    subject_id: '',
    teacher_id: '',
    semester: 'Semester 1',
    student_roll: '',
    student_dept: 'Computer Science',
    section_ratings: initializeRatings(feedbackSections),
    section_texts: initializeTexts(feedbackSections)
  }));
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  
  // AI processing visualizer stages
  const [pipelineStage, setPipelineStage] = useState(0);
  const pipelineStages = [
    "Cleaning raw text & removing noise...",
    "Analyzing sentiment distribution...",
    "Categorizing subject topics & issues...",
    "Extracting critical keywords & nouns...",
    "Synthesizing recommendations & priorities...",
    "Finalizing submission logs..."
  ];

  // Chat assistant state
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'bot', text: "👋 Hello Administrator! I'm your Academic Assistant. I can summarize feedback, retrieve issue statistics, or identify low satisfaction departments. Ask me anything!" }
  ]);
  const [chatbotTyping, setChatbotTyping] = useState(false);
  const chatEndRef = useRef(null);

  // User Management state
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all'); // 'all', 'student', 'faculty'
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const fetchUsers = async () => {
    if (!token) return;
    setLoadingUsers(true);
    setUsersError('');
    try {
      const data = await apiFetch('/api/users');
      setUsersList(data || []);
    } catch (err) {
      setUsersError(err.message || 'Failed to retrieve university user directory');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleBlock = async (targetUser) => {
    try {
      const isCurrentlyBlocked = targetUser.is_blocked;
      const endpoint = `/api/users/${targetUser.id}/${isCurrentlyBlocked ? 'unblock' : 'block'}`;
      const updatedUser = await apiFetch(endpoint, { method: 'PUT' });
      setUsersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_blocked: updatedUser.is_blocked } : u));
    } catch (err) {
      alert(err.message || 'Failed to update block state for user');
    }
  };

  useEffect(() => {
    if (token && currentView === 'users') {
      fetchUsers();
    }
  }, [token, currentView]);

  // App initialization
  useEffect(() => {
    // Apply dark mode on mount
    document.documentElement.classList.add('dark');
    
    // Load metadata
    fetchMetadata();

    // Verify token validity on startup (checks for block status)
    const verifyToken = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${savedToken}` }
          });
          if (!res.ok) {
            handleLogout();
          } else {
            const data = await res.json();
            if (data.is_blocked) {
              handleLogout();
            }
          }
        } catch (e) {
          // Network error or backend offline, keep local state
        }
      }
    };
    verifyToken();
  }, []);

  // Fetch dashboard and feedback list whenever view changes, or filters change
  useEffect(() => {
    if (token) {
      fetchDashboardData();
      fetchFeedbackList();
    }
  }, [token, filters, currentView]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatbotTyping]);

  // Helper API Fetch wrapper
  const apiFetch = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
    
    if (response.status === 401) {
      handleLogout();
      throw new Error("Session expired. Please log in again.");
    }
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Something went wrong');
    }
    
    return response.json();
  };

  const fetchMetadata = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/subjects`);
      const data = await res.json();
      setSubjects(data);
      
      const resT = await fetch(`${API_BASE_URL}/api/teachers`);
      const dataT = await resT.json();
      setTeachers(dataT);
      
      // Setup initial dropdowns for student form based on 'Semester 1' subjects
      const initialSem = 'Semester 1';
      const initialSubs = data.filter(s => s.semester === initialSem);
      const initialTeachs = dataT.filter(t => t.semester === initialSem);
      
      setStudentForm(prev => ({
        ...prev,
        semester: initialSem,
        subject_id: initialSubs.length > 0 ? initialSubs[0].id : '',
        teacher_id: initialTeachs.length > 0 ? initialTeachs[0].id : ''
      }));
    } catch (err) {
      console.error("Error loading subjects/teachers metadata:", err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      let queryStr = '';
      const params = [];
      if (filters.subject_id) params.push(`subject_id=${filters.subject_id}`);
      if (filters.teacher_id) params.push(`teacher_id=${filters.teacher_id}`);
      if (filters.semester) params.push(`semester=${filters.semester}`);
      if (params.length > 0) {
        queryStr = `?${params.join('&')}`;
      }
      
      const data = await apiFetch(`/api/analytics/dashboard${queryStr}`);
      setDashboardData(data);
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  };

  const fetchFeedbackList = async () => {
    try {
      let queryStr = '';
      const params = [];
      if (filters.subject_id) params.push(`subject_id=${filters.subject_id}`);
      if (filters.teacher_id) params.push(`teacher_id=${filters.teacher_id}`);
      if (filters.semester) params.push(`semester=${filters.semester}`);
      if (params.length > 0) {
        queryStr = `?${params.join('&')}`;
      }
      const data = await apiFetch(`/api/feedback/list${queryStr}`);
      setFeedbacks(data);
    } catch (err) {
      console.error("Feedback list error:", err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      if (!response.ok) {
        throw new Error('Invalid username or password');
      }
      const data = await response.json();
      const userPayload = {
        username: data.username,
        role: data.role,
        teacher_id: data.teacher_id,
        roll_number: data.roll_number,
        full_name: data.full_name,
        department: data.department
      };
      
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(userPayload));
      
      setToken(data.access_token);
      setUser(userPayload);
      setLoginForm({ username: '', password: '' });
      
      if (data.role === 'student') {
        setCurrentView('student-dashboard');
      } else {
        setCurrentView('dashboard');
      }
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    department: 'Computer Science',
    roll_number: '',
    full_name: ''
  });
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoginError('');
    setRegisterSuccess(false);
    
    const payload = {
      username: loginRole === 'student' ? registerForm.roll_number : registerForm.username,
      email: registerForm.email,
      password: registerForm.password,
      role: loginRole,
      department: registerForm.department,
      roll_number: loginRole === 'student' ? registerForm.roll_number : null,
      full_name: registerForm.full_name
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Registration failed');
      }
      
      setRegisterSuccess(true);
      setIsSignUp(false);
      setLoginForm({ username: payload.username, password: '' });
      setRegisterForm({
        username: '',
        email: '',
        password: '',
        department: 'Computer Science',
        roll_number: '',
        full_name: ''
      });
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    const isCurrentlyAdmin = user?.role === 'admin' || window.location.pathname === '/admin';
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    if (isCurrentlyAdmin) {
      window.history.pushState(null, '', '/admin');
      setCurrentView('admin-login');
    } else {
      window.history.pushState(null, '', '/');
      setCurrentView('login');
    }
  };

  const navigateTo = (view) => {
    setCurrentView(view);
    if (view === 'admin-login') {
      window.history.pushState(null, '', '/admin');
    } else if (view === 'login') {
      window.history.pushState(null, '', '/');
    }
  };

  const startFeedbackForSubject = (subject) => {
    setStudentForm(prev => ({
      ...prev,
      subject_id: subject.id,
      semester: subject.semester || 'Semester 1'
    }));
    // Auto-select first matching teacher for this semester
    const matchingTeachers = teachers.filter(t => t.semester === subject.semester);
    if (matchingTeachers.length > 0) {
      setStudentForm(prev => ({
        ...prev,
        teacher_id: matchingTeachers[0].id
      }));
    }
    setFormStep(0);
    setCurrentView('student');
  };

  const handleSemesterChange = (selectedSem) => {
    const nextSubs = subjects.filter(s => s.semester === selectedSem);
    const nextTeachs = teachers.filter(t => t.semester === selectedSem);
    
    setStudentForm(prev => ({
      ...prev,
      semester: selectedSem,
      subject_id: nextSubs.length > 0 ? nextSubs[0].id : '',
      teacher_id: nextTeachs.length > 0 ? nextTeachs[0].id : ''
    }));
  };

  const handleRatingChange = (section, questionKey, rating) => {
    setStudentForm(prev => ({
      ...prev,
      section_ratings: {
        ...prev.section_ratings,
        [section]: {
          ...prev.section_ratings[section],
          [questionKey]: rating
        }
      }
    }));
  };

  const handleTextChange = (section, text) => {
    setStudentForm(prev => ({
      ...prev,
      section_texts: {
        ...prev.section_texts,
        [section]: text
      }
    }));
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setFeedbackError('');
    
    // Check validation of comments (only the last section: Overall Satisfaction is mandatory)
    const overallComment = studentForm.section_texts["Overall Satisfaction"] || '';
    if (overallComment.trim().length < 10) {
      setFeedbackError('Mandatory overall satisfaction comment must be at least 10 characters for AI analysis.');
      return;
    }
    
    setSubmittingFeedback(true);
    setPipelineStage(0);
    
    const stageTimer = setInterval(() => {
      setPipelineStage(prev => {
        if (prev < pipelineStages.length - 1) {
          return prev + 1;
        }
        clearInterval(stageTimer);
        return prev;
      });
    }, 800);

    try {
      const payload = {
        subject_id: parseInt(studentForm.subject_id),
        teacher_id: parseInt(studentForm.teacher_id),
        semester: studentForm.semester,
        section_ratings: studentForm.section_ratings,
        section_texts: studentForm.section_texts,
        student_roll: user?.role === 'student' ? user.roll_number : (studentForm.student_roll || "Anonymous"),
        student_dept: user?.role === 'student' ? user.department : (studentForm.student_dept || "Computer Science")
      };

      const response = await fetch(`${API_BASE_URL}/api/feedback/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned error status ${response.status}`);
      }
      
      setTimeout(() => {
        clearInterval(stageTimer);
        setSubmittingFeedback(false);
        setFeedbackSuccess(true);
        setFormStep(0);
        setStudentForm(prev => ({
          ...prev,
          section_ratings: initializeRatings(feedbackSections),
          section_texts: initializeTexts(feedbackSections)
        }));
      }, 3500);

    } catch (err) {
      clearInterval(stageTimer);
      setSubmittingFeedback(false);
      setFeedbackError(err.message || 'Failed to submit feedback.');
    }
  };

  const handleSeedData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/setup/seed`, { method: 'POST' });
      const data = await res.json();
      alert(data.message);
      // Reload metadata & lists
      fetchMetadata();
      if (token) {
        fetchDashboardData();
        fetchFeedbackList();
      }
    } catch (err) {
      alert("Error seeding data: " + err.message);
    }
  };

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    } else {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  };

  // Re-run setup trigger in dashboard
  const handleResetData = async () => {
    if (window.confirm("Are you sure you want to seed the database? This adds sample students and reports.")) {
      await handleSeedData();
    }
  };

  // Custom PDF Print layout trigger
  const handleExportPDF = () => {
    window.print();
  };

  // Preset chatbot suggestions
  const handlePresetChat = (queryText) => {
    setChatQuery(queryText);
    triggerChatResponse(queryText);
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;
    const query = chatQuery;
    setChatQuery('');
    triggerChatResponse(query);
  };

  const triggerChatResponse = (query) => {
    // Add user message
    const userMsg = { id: Date.now(), sender: 'user', text: query };
    setChatMessages(prev => [...prev, userMsg]);
    setChatbotTyping(true);

    // Formulate a smart response based on dashboard data
    setTimeout(() => {
      let reply = "I analyzed the database. Could you clarify if you are asking about departments, top issues, or specific summaries?";
      const q = query.toLowerCase();

      if (dashboardData) {
        const { total_feedback, average_rating, sentiment_breakdown, category_counts, recommendations } = dashboardData;
        
        if (q.includes('lowest') || q.includes('department') || q.includes('poor') || q.includes('bad')) {
          reply = `According to our sentiment records, the category with the most negative mentions is currently "${category_counts[0]?.category || 'None'}". Our records show ${sentiment_breakdown.negative} negative feedbacks overall. In the class logs, Prof. Grace Hopper (CS-304) has negative student listings detailing "teaching explanation speeds".`;
        } 
        else if (q.includes('top') || q.includes('issue') || q.includes('complaint') || q.includes('most common')) {
          const list = category_counts.slice(0, 3).map((c, i) => `${i+1}. ${c.category} (${c.count} mentions)`).join('\n');
          reply = `The top feedback issue areas detected by the AI pipeline are:\n${list || 'No issues reported yet.'}`;
        }
        else if (q.includes('summarize') || q.includes('summary') || q.includes('sentiment') || q.includes('how are students feeling')) {
          const posPct = total_feedback > 0 ? Math.round((sentiment_breakdown.positive / total_feedback) * 100) : 0;
          const negPct = total_feedback > 0 ? Math.round((sentiment_breakdown.negative / total_feedback) * 100) : 0;
          const neuPct = total_feedback > 0 ? Math.round((sentiment_breakdown.neutral / total_feedback) * 100) : 0;
          
          reply = `Summary of student feedback (${total_feedback} submissions analyzed):\n- Positive Sentiment: ${posPct}%\n- Neutral Sentiment: ${neuPct}%\n- Negative Sentiment: ${negPct}%\nOverall satisfaction average stands at ${average_rating} out of 5.0 stars. The faculty explains topics well, but students consistently report issues in labs and internet connectivity.`;
        }
        else if (q.includes('recommend') || q.includes('action') || q.includes('fix')) {
          if (recommendations.length > 0) {
            const list = recommendations.slice(0, 2).map((r, i) => `- [${r.category}] Action: ${r.action}`).join('\n');
            reply = `Here are the top AI recommendations for corrective action:\n${list}`;
          } else {
            reply = "Feedback data is currently positive! No critical recommendations needed at this moment.";
          }
        }
      } else {
        reply = "I cannot access the dashboard metrics. Please ensure you are logged in as an administrator to retrieve live reports.";
      }

      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: reply }]);
      setChatbotTyping(false);
    }, 1000);
  };

  // Parse color mapping for Chart
  const SENTIMENT_COLORS = {
    Positive: '#10b981', // emerald
    Neutral: '#64748b',  // slate
    Negative: '#f43f5e'  // rose
  };

  const BAR_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444'];

  return (
    <div className="relative min-h-screen bg-[#080809] text-[#e4e4e7] flex flex-col font-sans transition-colors duration-300 overflow-x-hidden">
      
      {/* Liquid Aurora Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-lime-500/10 to-emerald-500/5 blur-[120px] animate-aurora-1 pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-pink-500/5 blur-[140px] animate-aurora-2 pointer-events-none z-0"></div>
      <div className="absolute top-[40%] left-[30%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tr from-cyan-500/10 to-blue-500/5 blur-[120px] animate-aurora-1 pointer-events-none z-0"></div>

      {/* Floating Pill Header (Only when logged in) */}
      {token && (
        <header className="w-full max-w-6xl mx-auto px-4 pt-6 pb-2 sticky top-0 z-30 print:hidden">
          <div className="glass-pill-nav h-16 px-4 flex items-center justify-between gap-4">
            
            {/* Left Brand Area */}
            <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => navigateTo(user?.role === 'student' ? 'student-dashboard' : 'dashboard')}>
              <div className="p-2 bg-blue-600 rounded-full text-white">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-white hidden sm:inline leading-none">EduFeedback AI</span>
            </div>

            {/* Middle Nav Links (pill tabs) */}
            <nav className="flex items-center bg-slate-950/40 p-0.5 rounded-full border border-white/5">
              {/* Dashboard Tab */}
              {user?.role === 'student' ? (
                <button
                  onClick={() => setCurrentView('student-dashboard')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                    currentView === 'student-dashboard'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Dashboard
                </button>
              ) : (
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                    currentView === 'dashboard'
                      ? 'bg-blue-650 text-white shadow-md'
                      : 'text-slate-405 hover:text-slate-200'
                  }`}
                >
                  Overview
                </button>
              )}

              {/* Feedback Stream (Faculty & Admin) */}
              {user?.role !== 'student' && (
                <button
                  onClick={() => setCurrentView('feedback-list')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                    currentView === 'feedback-list'
                      ? 'bg-blue-650 text-white shadow-md'
                      : 'text-slate-405 hover:text-slate-200'
                  }`}
                >
                  Feedbacks
                </button>
              )}

              {/* Users controls (Admin only) */}
              {user?.role === 'admin' && (
                <button
                  onClick={() => setCurrentView('users')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                    currentView === 'users'
                      ? 'bg-blue-650 text-white shadow-md'
                      : 'text-slate-405 hover:text-slate-200'
                  }`}
                >
                  Accounts
                </button>
              )}

              {/* Form Designer (Admin only) */}
              {user?.role === 'admin' && (
                <button
                  onClick={() => setCurrentView('form-designer')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                    currentView === 'form-designer'
                      ? 'bg-blue-650 text-white shadow-md'
                      : 'text-slate-405 hover:text-slate-200'
                  }`}
                >
                  Designer
                </button>
              )}

              {/* Share/Give Feedback Form tab */}
              <button
                onClick={() => {
                  if (user?.role === 'student') {
                    setStudentForm(prev => ({
                      ...prev,
                      subject_id: '',
                      teacher_id: '',
                      semester: 'Semester 1'
                    }));
                    setFormStep(0);
                  }
                  setCurrentView('student');
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                  currentView === 'student'
                    ? 'bg-blue-655 text-white shadow-md'
                    : 'text-slate-405 hover:text-slate-200'
                }`}
              >
                {user?.role === 'student' ? 'Evaluate' : 'Feedback Form'}
              </button>
            </nav>

            {/* Right User Profile Area */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden md:flex flex-col items-end leading-tight">
                <span className="text-xs font-bold text-slate-200">
                  {user?.role === 'faculty' && teachers.find(t => t.id === user.teacher_id)
                    ? teachers.find(t => t.id === user.teacher_id).name
                    : (user?.username === 'admin' || user?.role === 'admin' ? 'Hemansh Verma' : user?.username)}
                </span>
                <span className="text-[9px] text-slate-450 uppercase font-semibold tracking-wider mt-0.5">
                  {user?.role === 'admin' ? 'Administrator' : (user?.role === 'faculty' ? 'Faculty' : 'Student')}
                </span>
              </div>
              
              {/* Profile Avatar / Logout dropdown shortcut */}
              <button 
                onClick={handleLogout}
                className="w-9 h-9 rounded-full bg-white/10 border border-white/5 flex items-center justify-center font-bold text-blue-455 hover:bg-rose-950/20 hover:text-rose-455 transition cursor-pointer"
                title="Log Out Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </header>
      )}

      {/* Main Container Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 relative z-10 space-y-6">

          {/* ========================================================================= */}
          {/* ========================== 1.5 STUDENT DASHBOARD ========================= */}
          {/* ========================================================================= */}
          {token && currentView === 'student-dashboard' && (
            <div className="space-y-6 max-w-6xl mx-auto py-6 animate-fade-in-up">
              {/* Welcome Banner */}
              <div className="glass-panel p-6 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-655 via-violet-500 to-cyan-500"></div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                  <div>
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block">Student Console</span>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">Welcome back, {user?.full_name || 'Student'}!</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Roll Number: <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.roll_number}</span> | Department: <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.department}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setStudentForm(prev => ({
                        ...prev,
                        subject_id: '',
                        teacher_id: '',
                        semester: 'Semester 1'
                      }));
                      setFormStep(0);
                      setCurrentView('student');
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition hover-glow-blue cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Share New Feedback
                  </button>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Metric 1: Total Feedbacks */}
                <div className="glass-panel p-6 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block uppercase">Evaluations Completed</span>
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">{(feedbacks || []).length}</h3>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/20">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                </div>

                {/* Metric 2: Average Rating Given */}
                <div className="glass-panel p-6 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block uppercase">Average Rating Given</span>
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 flex items-center gap-1.5">
                      {(feedbacks || []).length > 0 
                        ? ((feedbacks || []).reduce((acc, f) => acc + f.rating, 0) / (feedbacks || []).length).toFixed(1) 
                        : '0.0'}
                      <span className="text-sm font-normal text-slate-400">/ 5.0</span>
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center border border-amber-500/20">
                    <Star className="w-6 h-6 fill-amber-500" />
                  </div>
                </div>

                {/* Metric 3: Sentiment Summary */}
                <div className="glass-panel p-6 flex items-center justify-between sm:col-span-2 lg:col-span-1">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block uppercase">Sentiment Breakdown</span>
                    <div className="flex gap-4 mt-2">
                      <div className="text-center">
                        <span className="text-xs text-slate-400 block">Pos</span>
                        <span className="text-sm font-bold text-emerald-500">{(feedbacks || []).filter(f => f.sentiment === 'Positive').length}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs text-slate-400 block">Neu</span>
                        <span className="text-sm font-bold text-blue-405">{(feedbacks || []).filter(f => f.sentiment === 'Neutral').length}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs text-slate-400 block">Neg</span>
                        <span className="text-sm font-bold text-rose-500">{(feedbacks || []).filter(f => f.sentiment === 'Negative').length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-violet-500/10 text-violet-500 rounded-xl flex items-center justify-center border border-violet-500/20">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Main Content Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Side: Submitted Feedbacks */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="glass-panel p-6">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-500" /> Your Submitted Reviews
                    </h3>

                    {(feedbacks || []).length === 0 ? (
                      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        <p className="text-sm">You haven't submitted any feedback evaluations yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(feedbacks || []).map((fb) => (
                          <div key={fb.id} className="p-4 bg-white/5 border border-white/8 rounded-2xl flex flex-col sm:flex-row justify-between items-start gap-4 hover:bg-white/10 hover:border-white/15 transition-all duration-300">
                            <div className="space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold text-blue-450 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                                  {fb.subject?.code || 'SUB'}
                                </span>
                                <h4 className="text-sm font-bold text-white">
                                  {fb.subject?.name}
                                </h4>
                              </div>
                              <p className="text-xs text-slate-400">
                                Evaluated: <span className="font-semibold text-slate-600 dark:text-slate-300">{fb.teacher?.name}</span> ({fb.semester})
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 italic">
                                "{fb.text}"
                              </p>
                            </div>
                            <div className="flex sm:flex-col items-end gap-2 shrink-0">
                              {/* Rating Stars */}
                              <div className="flex gap-0.5 text-amber-500">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={`w-3.5 h-3.5 ${i < fb.rating ? 'fill-amber-500' : 'text-slate-300 dark:text-slate-750'}`} />
                                ))}
                              </div>
                              {/* Sentiment Badge */}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                fb.sentiment === 'Positive' 
                                  ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' 
                                  : fb.sentiment === 'Negative'
                                  ? 'bg-rose-500/10 text-rose-450 border-rose-500/20'
                                  : 'bg-blue-500/10 text-blue-450 border-blue-500/20'
                              }`}>
                                {fb.sentiment || 'Neutral'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Pending evaluations */}
                <div className="space-y-6">
                  <div className="glass-panel p-6">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-purple-500" /> Pending Evaluations
                    </h3>

                    {(() => {
                      const submittedSubjectIds = new Set((feedbacks || []).map(fb => fb.subject_id));
                      const pending = (subjects || []).filter(sub => !submittedSubjectIds.has(sub.id));

                      if (pending.length === 0) {
                        return (
                          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                            <span className="text-3xl block mb-2">🎉</span>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">All Clear!</p>
                            <p className="text-[10px] mt-1">You have submitted feedback for all university subjects.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {pending.map((sub) => (
                            <div key={sub.id} className="p-3.5 bg-white/5 border border-white/8 rounded-2xl space-y-3 flex flex-col justify-between hover:bg-white/10 hover:border-white/15 transition-all duration-300">
                              <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                                      {sub.code}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{sub.semester}</span>
                                  </div>
                                  <h4 className="text-xs font-bold text-white mt-1.5 leading-tight">
                                    {sub.name}
                                  </h4>
                                </div>
                                <button
                                  onClick={() => startFeedbackForSubject(sub)}
                                  className="w-full bg-white/10 hover:bg-purple-600 text-slate-200 hover:text-white border border-white/10 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  Evaluate Subject <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ========================== 1. STUDENT FEEDBACK FORM ====================== */}
          {/* ========================================================================= */}
          {currentView === 'student' && (
            <div className="max-w-xl mx-auto py-8">
              
              {/* Feedback Success View */}
              {feedbackSuccess ? (
                <div className="glass-panel p-8 text-center relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"></div>
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-450 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Feedback Processed Successfully!</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Our machine learning pipeline analyzed your feedback in real-time, extracted key concerns, and updated the faculty decision dashboard anonymously.
                  </p>
                  
                  <div className="bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 p-4 text-left max-w-sm mx-auto mb-8 rounded-xl">
                    <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2">AI Processing Pipeline Output</h4>
                    <ul className="text-xs space-y-1.5 text-slate-650 dark:text-slate-350">
                      <li className="flex items-center gap-2">🟢 Language cleaner: <span className="text-slate-450 dark:text-slate-400">Complete</span></li>
                      <li className="flex items-center gap-2">🟢 Sentiment Classifier: <span className="text-slate-450 dark:text-slate-400">Neutral/Positive checks run</span></li>
                      <li className="flex items-center gap-2">🟢 Topic Categorization: <span className="text-slate-450 dark:text-slate-400">Completed</span></li>
                    </ul>
                  </div>

                  <button 
                    onClick={() => setFeedbackSuccess(false)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-500/10"
                  >
                    Submit Another Feedback
                  </button>
                </div>
              ) : (
                
                /* Main Feedback Form Card */
                <div className="glass-panel overflow-hidden relative">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-600 via-violet-500 to-cyan-500"></div>
                  
                  <div className="p-6 md:p-8 border-b border-slate-200/30 dark:border-slate-850">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <BrainCircuit className="w-5 h-5 text-blue-500" /> Share Student Feedback
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Your feedback will be automatically categorized and analyzed by AI to help faculty improve classes, labs, and assignments.
                    </p>
                  </div>

                  <form onSubmit={handleStudentSubmit} className="p-6 md:p-8 space-y-6">
                    
                    {/* Student Identity Lock Badge */}
                    {user?.role === 'student' && (
                      <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block">Active Student Session</span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">{user.full_name} ({user.roll_number})</h4>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{user.department}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                          {user.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST'}
                        </div>
                      </div>
                    )}

                    {/* Progress indicator */}
                    <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/30 p-3.5 border border-slate-200/30 dark:border-slate-850 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        {formStep === 0 ? "Step 1: Course Info" : formStep === 8 ? "Step 3: Review Details" : `Step 2: Section ${formStep} of 7`}
                      </span>
                      <div className="flex gap-1">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-4 h-1.5 rounded-full transition-all ${
                              i === formStep ? 'bg-blue-500 w-8' : i < formStep ? 'bg-emerald-500' : 'bg-slate-350 dark:bg-slate-800'
                            }`}
                          ></div>
                        ))}
                      </div>
                    </div>

                    {/* STEP 0: Metadata Selection */}
                    {formStep === 0 && (
                      <div className="space-y-6">
                        
                        {/* Student Roll and Dept inputs (Only shown for non-students testing the form) */}
                        {user?.role !== 'student' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-100/50 dark:bg-slate-900/30 p-4 border border-slate-200/30 dark:border-slate-850 rounded-xl">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Student Roll Number</label>
                              <input 
                                type="text" 
                                value={studentForm.student_roll}
                                onChange={(e) => setStudentForm(prev => ({ ...prev, student_roll: e.target.value }))}
                                placeholder="Enter Roll Number (e.g. 2000290100001)"
                                className="w-full glass-input"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Student Department</label>
                              <select
                                value={studentForm.student_dept}
                                onChange={(e) => setStudentForm(prev => ({ ...prev, student_dept: e.target.value }))}
                                className="w-full glass-input"
                              >
                                <option value="Computer Science">Computer Science</option>
                                <option value="Information Technology">Information Technology</option>
                                <option value="Electrical Engineering">Electrical Engineering</option>
                                <option value="Electronics & Communication">Electronics & Communication</option>
                                <option value="Mechanical Engineering">Mechanical Engineering</option>
                                <option value="Civil Engineering">Civil Engineering</option>
                              </select>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">1. Select Semester</label>
                            <select 
                              value={studentForm.semester}
                              onChange={(e) => handleSemesterChange(e.target.value)}
                              className="w-full glass-input font-semibold"
                            >
                              {Array.from({ length: 8 }).map((_, idx) => (
                                <option key={idx} value={`Semester ${idx + 1}`}>{`Semester ${idx + 1}`}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-550 dark:text-slate-450 uppercase tracking-wider mb-2">Academic Status</label>
                            <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> AKTU Program Eligible
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Subject Select */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">2. Subject Course</label>
                            <select 
                              value={studentForm.subject_id}
                              onChange={(e) => setStudentForm(prev => ({ ...prev, subject_id: e.target.value }))}
                              className="w-full glass-input"
                              required
                            >
                              <option value="" disabled>Select Subject</option>
                              {subjects.filter(s => s.semester === studentForm.semester).map(s => (
                                <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                              ))}
                            </select>
                            {subjects.filter(s => s.semester === studentForm.semester).length === 0 && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">No AKTU subjects registered for this semester yet.</p>
                            )}
                          </div>

                          {/* Teacher Select */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">3. Teacher / Instructor</label>
                            <select 
                              value={studentForm.teacher_id}
                              onChange={(e) => setStudentForm(prev => ({ ...prev, teacher_id: e.target.value }))}
                              className="w-full glass-input"
                              required
                            >
                              <option value="" disabled>Select Teacher</option>
                              {teachers.filter(t => t.semester === studentForm.semester).map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
                              ))}
                            </select>
                            {teachers.filter(t => t.semester === studentForm.semester).length === 0 && (
                              <p className="text-[10px] text-amber-605 dark:text-amber-500 mt-1">No instructors assigned to this semester yet.</p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!studentForm.subject_id || !studentForm.teacher_id}
                          onClick={() => setFormStep(1)}
                          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-550 text-white font-bold py-3 rounded-xl transition shadow-lg text-sm flex items-center justify-center gap-2"
                        >
                          Start Questionnaire <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* STEPS 1-X: Questionnaire Sections */}
                    {formStep >= 1 && formStep <= feedbackSections.length && (() => {
                      const section = feedbackSections[formStep - 1];
                      const comment = studentForm.section_texts[section.title] || '';
                      
                      return (
                        <div className="space-y-6">
                          <div className="border-b border-slate-900 pb-3">
                            <h4 className="text-base font-bold text-white flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-cyan-400" /> Section {formStep}: {section.title}
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">Please rate each item and provide a mandatory descriptive comment.</p>
                          </div>

                          {/* Star rating questions list */}
                          <div className="space-y-4 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                            {section.questions.map(q => {
                              const curRating = studentForm.section_ratings[section.title]?.[q.key] || 0;
                              return (
                                <div key={q.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white/5 border border-white/8 rounded-2xl">
                                  <span className="text-xs text-slate-200">{q.label}</span>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map(star => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={() => handleRatingChange(section.title, q.key, star)}
                                        className="text-slate-600 hover:scale-110 transition cursor-pointer"
                                      >
                                        <Star className={`w-5 h-5 ${star <= curRating ? 'fill-amber-400 text-amber-400' : 'text-slate-650'}`} />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Mandatory or Optional Textbox */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                              Feedback Observations {section.title === "Overall Satisfaction" ? "(Mandatory)" : "(Optional)"}
                            </label>
                            <textarea
                              value={comment}
                              onChange={(e) => handleTextChange(section.title, e.target.value)}
                              placeholder={`What did you observe or like/dislike regarding ${section.title.toLowerCase()}?`}
                              className="w-full glass-input p-4 text-sm text-white focus:ring-1 focus:ring-blue-500/20 h-24 resize-none"
                              required={section.title === "Overall Satisfaction"}
                            />
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-[10px] text-slate-500">
                                {section.title === "Overall Satisfaction" ? "Min 10 characters required." : "Optional additional comments."}
                              </span>
                              {(section.title !== "Overall Satisfaction" && comment.trim().length === 0) ? null : (
                                <span className={`text-[10px] font-bold ${(section.title !== "Overall Satisfaction" || comment.trim().length >= 10) ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {comment.trim().length} {section.title === "Overall Satisfaction" ? '/ 10 chars' : 'chars'}
                                </span>
                              )}
                            </div>
                          </div>

                          {feedbackError && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>{feedbackError}</span>
                            </div>
                          )}

                          {/* Stepper Buttons */}
                          <div className="flex gap-4 pt-2 border-t border-slate-900">
                            <button
                              type="button"
                              onClick={() => { setFeedbackError(''); setFormStep(formStep - 1); }}
                              className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 font-bold py-2.5 rounded-xl transition text-xs cursor-pointer"
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                // Validate all questions in this section have been rated
                                const secRatings = studentForm.section_ratings[section.title] || {};
                                const unrated = section.questions.some(q => !secRatings[q.key] || secRatings[q.key] === 0);
                                if (unrated) {
                                  setFeedbackError(`Please rate all questions in the "${section.title}" section before proceeding.`);
                                  return;
                                }

                                const isMandatory = section.title === "Overall Satisfaction";
                                if (isMandatory && comment.trim().length < 10) {
                                  setFeedbackError(`Please provide at least 10 characters comment feedback for "${section.title}" to run AI analysis.`);
                                  return;
                                }
                                setFeedbackError('');
                                setFormStep(formStep + 1);
                              }}
                              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl transition text-xs cursor-pointer"
                            >
                              Next Section
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Review & Submit Final Step */}
                    {formStep === feedbackSections.length + 1 && (
                      <div className="space-y-6">
                        <div className="border-b border-slate-900 pb-3">
                          <h4 className="text-base font-bold text-white">3. Review and Submit Feedback</h4>
                          <p className="text-xs text-slate-405 mt-0.5">Please review your entries. All mandatory comments are registered.</p>
                        </div>

                        {/* Review cards */}
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                          {feedbackSections.map((sec) => {
                            const q_ratings = studentForm.section_ratings[sec.title] || {};
                            const allVals = Object.values(q_ratings);
                            const avgVal = allVals.length > 0 ? (allVals.reduce((a, b) => a + b, 0) / allVals.length).toFixed(1) : "5.0";
                            const comment = studentForm.section_texts[sec.title] || '';
                            
                            return (
                              <div key={sec.title} className="p-3 bg-white/5 border border-white/8 rounded-2xl space-y-1 text-xs">
                                <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                                  <span className="font-semibold text-slate-200">{sec.title}</span>
                                  <span className="text-amber-400 font-bold flex items-center gap-1">
                                    ★ {avgVal}
                                  </span>
                                </div>
                                <p className="text-slate-450 italic mt-1 font-medium">"{comment || 'No comments registered.'}"</p>
                              </div>
                            );
                          })}
                        </div>

                        {feedbackError && (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{feedbackError}</span>
                          </div>
                        )}

                        <div className="flex gap-4 pt-2 border-t border-slate-900">
                          <button
                            type="button"
                            onClick={() => { setFeedbackError(''); setFormStep(feedbackSections.length); }}
                            className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 font-bold py-3 rounded-xl transition text-xs cursor-pointer"
                          >
                            Back to Edit
                          </button>
                          <button
                            type="submit"
                            disabled={submittingFeedback}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/10"
                          >
                            Submit Feedback to AI <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Visual pipeline loader */}
                    {submittingFeedback && (
                      <div className="glass-panel p-4 space-y-3 animate-pulse">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">AI Processing Active</span>
                          <span className="text-[10px] text-slate-500">Stage {pipelineStage + 1} of {pipelineStages.length}</span>
                        </div>
                        <p className="text-xs text-slate-350 font-semibold">{pipelineStages[pipelineStage]}</p>
                        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full transition-all duration-300" 
                            style={{ width: `${((pipelineStage + 1) / pipelineStages.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Seed data fallback */}
                    {subjects.length === 0 && (
                      <div className="text-center pt-2">
                        <p className="text-xs text-slate-400 mb-2">No subjects found. Seed the database with mock configurations to start testing.</p>
                        <button
                          type="button"
                          onClick={handleSeedData}
                          className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition flex items-center gap-1.5 mx-auto cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Initial Database Setup (Seed Data)
                        </button>
                      </div>
                    )}

                  </form>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* ============================= 2. FACULTY PORTAL LOGIN ==================== */}
          {/* ================================================================          {/* ========================================================================= */}
          {/* ============================= 2. AUTHENTICATION PORTALS ==================== */}
          {/* ========================================================================= */}
          {(currentView === 'login' || currentView === 'admin-login') && (
            <div className="relative min-h-[75vh] flex items-center justify-center py-10 px-4 overflow-hidden">
              {/* Floating Animated Gradient Blobs */}
              <div className="absolute top-10 left-10 w-64 h-64 bg-blue-500/20 dark:bg-blue-500/10 rounded-full blur-3xl animate-blob-1 pointer-events-none"></div>
              <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-500/20 dark:bg-purple-500/10 rounded-full blur-3xl animate-blob-2 pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500/10 dark:bg-pink-500/5 rounded-full blur-3xl animate-blob-3 pointer-events-none"></div>

              {/* Glassmorphic Login Card */}
              <div className="glass-panel max-w-md w-full p-6 md:p-8 relative z-10 shadow-2xl border border-slate-200/55 dark:border-slate-800/80 animate-fade-in-up">
                
                {/* Visual indicator bar */}
                <div className={`absolute top-0 inset-x-0 h-1.5 rounded-t-2xl transition-all duration-500 ${
                  currentView === 'admin-login' 
                    ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500' 
                    : (loginRole === 'student' ? 'bg-blue-650' : 'bg-purple-650')
                }`}></div>

                {currentView === 'login' ? (
                  <>
                    {/* Role Switcher Tab bar with smooth sliding highlight */}
                    <div className="flex border border-slate-200/40 dark:border-slate-800/40 mb-6 p-0.5 bg-slate-100/50 dark:bg-slate-950/30 rounded-xl relative overflow-hidden">
                      <div 
                        className="absolute top-0.5 bottom-0.5 rounded-lg transition-all duration-300 bg-blue-650 shadow-md shadow-blue-500/20"
                        style={{
                          left: loginRole === 'student' ? '2px' : 'calc(50% + 2px)',
                          width: 'calc(50% - 4px)',
                          backgroundColor: loginRole === 'student' ? '#2563eb' : '#9333ea'
                        }}
                      ></div>
                      <button
                        type="button"
                        onClick={() => { setLoginRole('student'); setLoginError(''); setIsSignUp(false); }}
                        className={`flex-1 text-center py-2.5 text-xs font-bold rounded-lg relative z-10 transition-colors duration-300 ${
                          loginRole === 'student' ? 'text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-250'
                        }`}
                      >
                        Student Portal
                      </button>
                      <button
                        type="button"
                        onClick={() => { setLoginRole('faculty'); setLoginError(''); setIsSignUp(false); }}
                        className={`flex-1 text-center py-2.5 text-xs font-bold rounded-lg relative z-10 transition-colors duration-300 ${
                          loginRole === 'faculty' ? 'text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-250'
                        }`}
                      >
                        Faculty / Staff
                      </button>
                    </div>

                    <div className="text-center mb-6">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 border transition-all duration-300 ${
                        loginRole === 'student' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>
                        <LogIn className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {isSignUp 
                          ? (loginRole === 'student' ? 'Student Registration' : 'Faculty Sign Up')
                          : (loginRole === 'student' ? 'Student Feedback Portal' : 'Faculty Analytics Portal')}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {isSignUp
                          ? 'Create your university database profile to register credentials.'
                          : (loginRole === 'student'
                              ? 'Access evaluation forms, view semesters, and record subject ratings.'
                              : 'Review consolidated ratings, AI sentiment timelines, and recommendations.')}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 border bg-pink-500/10 text-pink-500 border-pink-500/25">
                      <BrainCircuit className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Academic Admin Console</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Authenticate administrative credentials to oversee feedback flows and user status.
                    </p>
                  </div>
                )}

                {registerSuccess && (
                  <div className="p-3 mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Registration successful! You can now log in.</span>
                  </div>
                )}

                {/* Authentication Form */}
                <form onSubmit={isSignUp ? handleRegister : handleLogin} className="space-y-4">
                  {isSignUp && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Full Name</label>
                      <input 
                        type="text" 
                        value={registerForm.full_name}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="Enter full name (e.g. Hemansh Verma)"
                        className="w-full glass-input focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 focus:ring-blue-500"
                        required
                      />
                    </div>
                  )}

                  {isSignUp && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Email Address</label>
                      <input 
                        type="email" 
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="e.g. student@aktu.edu"
                        className="w-full glass-input focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 focus:ring-blue-500"
                        required
                      />
                    </div>
                  )}

                  {/* Role Specific Input */}
                  {currentView === 'admin-login' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Administrator Email ID</label>
                      <input 
                        type="email" 
                        value={loginForm.username}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="hemanshv@gmail.com"
                        className="w-full glass-input focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 focus:ring-pink-500"
                        required
                      />
                    </div>
                  ) : (
                    loginRole === 'student' ? (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">University Roll Number</label>
                        <input 
                          type="text" 
                          value={isSignUp ? registerForm.roll_number : loginForm.username}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (isSignUp) {
                              setRegisterForm(prev => ({ ...prev, roll_number: val }));
                            } else {
                              setLoginForm(prev => ({ ...prev, username: val }));
                            }
                          }}
                          placeholder="Enter 13-digit Roll Number"
                          className="w-full glass-input focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 focus:ring-blue-500"
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Username</label>
                        <input 
                          type="text" 
                          value={isSignUp ? registerForm.username : loginForm.username}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (isSignUp) {
                              setRegisterForm(prev => ({ ...prev, username: val }));
                            } else {
                              setLoginForm(prev => ({ ...prev, username: val }));
                            }
                          }}
                          placeholder="Enter username"
                          className="w-full glass-input focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 focus:ring-purple-500"
                          required
                        />
                      </div>
                    )
                  )}

                  {isSignUp && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Department</label>
                      <select
                        value={registerForm.department}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full glass-input"
                      >
                        <option value="Computer Science">Computer Science</option>
                        <option value="Information Technology">Information Technology</option>
                        <option value="Electrical Engineering">Electrical Engineering</option>
                        <option value="Electronics & Communication">Electronics & Communication</option>
                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                        <option value="Civil Engineering">Civil Engineering</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Password</label>
                    <input 
                      type="password" 
                      value={isSignUp ? registerForm.password : loginForm.password}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (isSignUp) {
                          setRegisterForm(prev => ({ ...prev, password: val }));
                        } else {
                          setLoginForm(prev => ({ ...prev, password: val }));
                        }
                      }}
                      placeholder="Enter password"
                      className={`w-full glass-input focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                        currentView === 'admin-login' ? 'focus:ring-pink-500' : (loginRole === 'student' ? 'focus:ring-blue-500' : 'focus:ring-purple-500')
                      }`}
                      required
                    />
                  </div>

                  {loginError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className={`w-full text-white font-bold py-3 rounded-xl transition-all duration-300 text-sm shadow-lg ${
                      currentView === 'admin-login'
                        ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 shadow-pink-500/20 hover-glow-purple cursor-pointer'
                        : (loginRole === 'student' 
                            ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/15 hover-glow-blue cursor-pointer' 
                            : 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/15 hover-glow-purple cursor-pointer')
                    }`}
                  >
                    {isSignUp ? 'Create Account' : 'Authenticate Account'}
                  </button>

                  <div className="text-center pt-2 flex flex-col gap-2">
                    {currentView === 'login' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setIsSignUp(!isSignUp); setLoginError(''); }}
                          className="text-xs text-blue-500 hover:text-blue-400 font-semibold transition cursor-pointer"
                        >
                          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { navigateTo('admin-login'); setLoginError(''); setIsSignUp(false); setLoginForm({ username: '', password: '' }); }}
                          className="text-xs text-slate-400 hover:text-slate-350 transition font-medium underline mt-2 cursor-pointer"
                        >
                          Access Academic Admin Portal
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { navigateTo('login'); setLoginError(''); setLoginForm({ username: '', password: '' }); }}
                        className="text-xs text-blue-500 hover:text-blue-400 font-semibold transition underline cursor-pointer"
                      >
                        Back to Student & Faculty Portal
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ==================== 3. ADMINISTRATIVE ANALYTICS DASHBOARD =============== */}
          {/* ========================================================================= */}
          {token && currentView === 'dashboard' && (
            <div className="space-y-6">
              
              {/* FILTER BAR SECTION */}
              <div className="glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-200">Filter Analytics:</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 md:max-w-3xl">
                  {/* Subject filter */}
                  <select 
                    value={filters.subject_id}
                    onChange={(e) => setFilters(prev => ({ ...prev, subject_id: e.target.value }))}
                    className="glass-input py-1.5 px-3 text-xs focus:ring-1 focus:ring-blue-500/20"
                  >
                    <option value="">All Subjects</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>

                  {/* Teacher filter */}
                  {user?.role !== 'faculty' && (
                    <select 
                      value={filters.teacher_id}
                      onChange={(e) => setFilters(prev => ({ ...prev, teacher_id: e.target.value }))}
                      className="glass-input py-1.5 px-3 text-xs focus:ring-1 focus:ring-blue-500/20"
                    >
                      <option value="">All Teachers</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}

                  {/* Semester filter */}
                  <select 
                    value={filters.semester}
                    onChange={(e) => setFilters(prev => ({ ...prev, semester: e.target.value }))}
                    className="glass-input py-1.5 px-3 text-xs focus:ring-1 focus:ring-blue-500/20"
                  >
                    <option value="">All Semesters</option>
                    {Array.from({ length: 8 }).map((_, idx) => (
                      <option key={idx} value={`Semester ${idx + 1}`}>{`Semester ${idx + 1}`}</option>
                    ))}
                  </select>
                </div>

                {/* Reset filters button */}
                <button
                  onClick={() => setFilters({ subject_id: '', teacher_id: '', semester: '' })}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition duration-200 cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>

              {/* DASHBOARD METRICS CARDS */}
              {dashboardData ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Card 1: Total Feedback */}
                    <div className="glass-panel p-5 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Submissions</p>
                          <h3 className="text-3xl font-extrabold text-white mt-1">{dashboardData.total_feedback}</h3>
                        </div>
                        <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-xs text-emerald-400 mt-3 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> Real-time active database
                      </p>
                    </div>

                    {/* Card 2: Average Rating */}
                    <div className="glass-panel p-5 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Average Rating</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-3xl font-extrabold text-white">{dashboardData.average_rating}</h3>
                            <span className="text-sm text-slate-400">/ 5.0</span>
                          </div>
                        </div>
                        <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg">
                          <Star className="w-5 h-5 fill-amber-400/20 text-amber-400" />
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-400 text-sm mt-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-3.5 h-3.5 ${
                              i < Math.round(dashboardData.average_rating) 
                                ? 'fill-amber-400 text-amber-400' 
                                : 'text-slate-600'
                            }`} 
                          />
                        ))}
                        <span className="text-xs text-slate-400 ml-2">Satisfaction baseline</span>
                      </div>
                    </div>

                    {/* Card 3: Sentiment Breakdown */}
                    <div className="glass-panel p-5 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        {(() => {
                          const total = dashboardData.total_feedback;
                          const posPct = total > 0 ? Math.round((dashboardData.sentiment_breakdown.positive / total) * 100) : 0;
                          return (
                            <div>
                              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Positive Ratio</p>
                              <h3 className="text-3xl font-extrabold text-emerald-400 mt-1">
                                {posPct}% 
                                <span className="text-sm font-normal text-slate-350 ml-1.5">Positive</span>
                              </h3>
                            </div>
                          );
                        })()}
                        <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                          <Sparkles className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2 mt-3 flex overflow-hidden">
                        {(() => {
                          const total = dashboardData.total_feedback;
                          if (total === 0) return <div className="bg-slate-650 w-full"></div>;
                          const posW = (dashboardData.sentiment_breakdown.positive / total) * 100;
                          const neuW = (dashboardData.sentiment_breakdown.neutral / total) * 100;
                          const negW = (dashboardData.sentiment_breakdown.negative / total) * 100;
                          return (
                            <>
                              <div className="bg-emerald-500 h-full" style={{ width: `${posW}%` }}></div>
                              <div className="bg-slate-400 h-full" style={{ width: `${neuW}%` }}></div>
                              <div className="bg-rose-500 h-full" style={{ width: `${negW}%` }}></div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Card 4: Actionable recommendations count */}
                    <div className="glass-panel p-5 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Critical Alerts</p>
                          <h3 className="text-3xl font-extrabold text-rose-400 mt-1">{dashboardData.alerts.length}</h3>
                        </div>
                        <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-lg">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-xs text-slate-450 mt-3 flex items-center gap-1">
                        {dashboardData.alerts.length > 0 ? (
                          <span className="text-rose-400 font-semibold">Action items pending review</span>
                        ) : (
                          <span className="text-emerald-400">All environments stable</span>
                        )}
                      </p>
                    </div>

                  </div>

                  {/* CHARTS AND RECOMMENDATIONS PANEL */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Top Issue Categories Bar Chart */}
                    <div className="glass-panel p-5 flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-400" /> Key Topic Mentions
                        </h3>
                        <span className="text-xs text-slate-400">By total frequency</span>
                      </div>
                      
                      <div className="relative flex-1 min-h-[240px]">
                        {dashboardData.category_counts.length > 0 ? (
                          <ResponsiveContainer width="100%" height={230}>
                            <BarChart data={dashboardData.category_counts} layout="vertical" margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                              <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis dataKey="category" type="category" stroke="#94a3b8" fontSize={10} width={100} tickLine={false} axisLine={false} />
                              <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} labelStyle={{ color: '#fff' }} />
                              <Bar dataKey="count" radius={[0, 9999, 9999, 0]}>
                                {dashboardData.category_counts.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">No category feedback logged.</div>
                        )}
                      </div>
                    </div>

                    {/* Sentiment Donut Chart */}
                    <div className="glass-panel p-5 flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                          <Activity className="w-4 h-4 text-purple-400" /> Sentiment Distribution
                        </h3>
                        <span className="text-xs text-slate-400">AI Classification</span>
                      </div>
                      
                      <div className="relative flex-1 min-h-[240px] flex items-center justify-center">
                        {dashboardData.total_feedback > 0 ? (
                          <ResponsiveContainer width="100%" height={230}>
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'Positive', value: dashboardData.sentiment_breakdown.positive },
                                  { name: 'Neutral', value: dashboardData.sentiment_breakdown.neutral },
                                  { name: 'Negative', value: dashboardData.sentiment_breakdown.negative }
                                ]}
                                cx="50%"
                                cy="45%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                <Cell fill={SENTIMENT_COLORS.Positive} />
                                <Cell fill={SENTIMENT_COLORS.Neutral} />
                                <Cell fill={SENTIMENT_COLORS.Negative} />
                              </Pie>
                              <RechartsTooltip />
                              <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-slate-400">{value}</span>} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">No records found.</div>
                        )}
                      </div>
                    </div>

                    {/* Alerts / Escalated Issues */}
                    <div className="glass-panel p-5 flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-rose-500" /> Escalated Warnings
                        </h3>
                        
                        <div className="space-y-2.5 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                          {dashboardData.alerts.length > 0 ? (
                            dashboardData.alerts.map(alert => (
                              <div 
                                key={alert.id} 
                                className={`p-3 border rounded-lg flex items-start gap-2.5 ${
                                  alert.priority === 'Flagged Toxic' 
                                    ? 'bg-rose-500/10 border-rose-500/30' 
                                    : 'bg-amber-500/10 border-amber-500/20'
                                }`}
                              >
                                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                                  alert.priority === 'Flagged Toxic' ? 'text-rose-500' : 'text-amber-400'
                                }`} />
                                <div className="text-xs">
                                  <p className={`font-semibold ${alert.priority === 'Flagged Toxic' ? 'text-rose-350' : 'text-amber-350'}`}>
                                    {alert.priority === 'Flagged Toxic' ? 'Flagged Toxic Language' : 'High Priority Grievance'}
                                  </p>
                                  <p className="text-slate-300 mt-1 italic">"{alert.text}"</p>
                                  <p className="text-[10px] text-slate-450 mt-1">Course: {alert.subject_name} | Instructor: {alert.teacher_name}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-10 text-xs text-slate-500">No critical alerts detected in filtered dataset.</div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* WORD CLOUD TAGS & RECOMMENDATIONS */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Word Tag Cloud */}
                    <div className="lg:col-span-1 glass-panel p-5 flex flex-col">
                      <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-cyan-400" /> Word Frequency Tags
                      </h3>
                      
                      <div className="flex flex-wrap gap-2 items-center justify-center p-4 border border-white/5 rounded-2xl bg-white/5 flex-1">
                        {dashboardData.keywords.length > 0 ? (
                          dashboardData.keywords.map((kw, i) => {
                            // Calculate font size class based on word frequency
                            const sizeVal = kw.value;
                            let sizeClass = "text-xs px-2 py-1";
                            let colorClass = "bg-white/10 text-slate-305 border border-white/5";
                            
                            if (sizeVal > 4) {
                              sizeClass = "text-base font-bold px-3 py-1.5";
                              colorClass = "bg-blue-600/10 text-blue-400 border border-blue-500/20";
                            } else if (sizeVal > 2) {
                              sizeClass = "text-sm font-semibold px-2.5 py-1";
                              colorClass = "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
                            }
                            
                            return (
                              <span 
                                key={i} 
                                className={`${sizeClass} ${colorClass} rounded-lg select-none hover:scale-105 transition cursor-default`}
                              >
                                {kw.text}
                              </span>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-500 text-center">No keywords extracted yet. Add student feedbacks.</div>
                        )}
                      </div>
                    </div>

                    {/* AI Recommendations */}
                    <div className="lg:col-span-2 glass-panel p-5 flex flex-col">
                      <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2 mb-3">
                        <Bot className="w-4 h-4 text-emerald-400" /> Faculty Corrective Recommendations
                      </h3>
                      
                      <div className="overflow-x-auto border border-white/5 rounded-2xl bg-white/5 flex-1">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/10 text-slate-200 font-bold">
                              <th className="p-3">Grievance Category</th>
                              <th className="p-3 text-center">Negative Mentions</th>
                              <th className="p-3">Automated AI Action Recommendation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-300">
                            {dashboardData.recommendations.length > 0 ? (
                              dashboardData.recommendations.map((rec, i) => (
                                <tr key={i} className="hover:bg-slate-800/30">
                                  <td className="p-3 font-semibold text-slate-250 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                    {rec.category}
                                  </td>
                                  <td className="p-3 text-center font-bold text-rose-400">{rec.count}</td>
                                  <td className="p-3 text-slate-400 text-xs italic">{rec.action}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="3" className="p-8 text-center text-xs text-emerald-400 font-semibold">
                                  ✅ No negative complaints detected. Pedagogy and support environments working successfully!
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>

                  {/* BOTTOM RECENT FEEDBACK ROW */}
                  <div className="glass-panel p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-400" /> Recent Submissions Flow
                      </h3>
                      <button 
                        onClick={() => setCurrentView('feedback-list')}
                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition"
                      >
                        View Full Logs <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dashboardData.recent_feedbacks.length > 0 ? (
                        dashboardData.recent_feedbacks.slice(0, 4).map(fb => (
                          <div key={fb.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 space-y-2 relative overflow-hidden">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[10px] text-slate-500">{new Date(fb.timestamp).toLocaleString()}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                fb.sentiment === 'Positive' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                fb.sentiment === 'Negative' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              }`}>
                                {fb.sentiment}
                              </span>
                            </div>
                            <div className="space-y-1.5 mt-1 max-h-24 overflow-y-auto custom-scrollbar">
                              {fb.text.split(' | ').map((line, idx) => {
                                if (line.includes(': ')) {
                                  const [secName, secComment] = line.split(': ');
                                  if (secComment.trim() && secComment.trim() !== "No major observations logged.") {
                                    return (
                                      <div key={idx} className="text-[11px] leading-relaxed">
                                        <strong className="text-slate-400 font-bold">{secName}: </strong>
                                        <span className="text-slate-300 italic">"{secComment}"</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                }
                                return <p key={idx} className="text-[11px] text-slate-350 italic">"{line}"</p>;
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-800 flex justify-between">
                              <span>Instructor: {fb.teacher.name}</span>
                              <span className="font-bold text-slate-350">{fb.subject.code}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 text-center py-6 text-xs text-slate-500">No feedbacks received yet.</div>
                      )}
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* ======================= CHATBOT / CO-PILOT ASSISTANT ==================== */}
                  {/* ========================================================================= */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Chatbot description */}
                    <div className="glass-panel p-5 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-blue-600 rounded-xl text-white">
                          <Bot className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base">AI Copilot Decider</h4>
                          <p className="text-xs text-slate-400">Semantic support bot</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-350 leading-relaxed">
                        Query feedback metrics using conversational analytics. The bot reads live SQL database totals, parses negative topics, lists top complaints, and extracts active faculty profiles to help you frame resolutions quickly.
                      </p>
                    </div>

                    {/* Chatbot Interface */}
                    <div className="lg:col-span-2 glass-panel p-4 flex flex-col h-[340px]">
                      
                      {/* Chat Messages */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 text-xs">
                        {chatMessages.map(msg => (
                          <div 
                            key={msg.id} 
                            className={`p-3 rounded-xl max-w-[85%] whitespace-pre-line leading-relaxed ${
                              msg.sender === 'user' 
                                ? 'bg-blue-600 text-white ml-auto font-medium' 
                                : 'bg-white/10 border border-white/8 text-slate-200'
                            }`}
                          >
                            {msg.text}
                          </div>
                        ))}
                        {chatbotTyping && (
                          <div className="bg-white/5 border border-white/8 text-slate-400 p-2.5 rounded-xl max-w-[30%] text-[10px] animate-pulse">
                            Assistant typing...
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Chat Presets */}
                      <div className="flex gap-2 py-2 overflow-x-auto custom-scrollbar scroll-smooth no-scrollbar text-[10px] select-none print:hidden shrink-0">
                        <button 
                          onClick={() => handlePresetChat("What are the top three issue categories?")}
                          className="px-2.5 py-1 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 rounded-lg whitespace-nowrap transition cursor-pointer"
                        >
                          Top issue areas
                        </button>
                        <button 
                          onClick={() => handlePresetChat("Summarize overall feedback sentiment.")}
                          className="px-2.5 py-1 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 rounded-lg whitespace-nowrap transition cursor-pointer"
                        >
                          Overall sentiment summary
                        </button>
                        <button 
                          onClick={() => handlePresetChat("Which instructor has the lowest satisfaction?")}
                          className="px-2.5 py-1 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 rounded-lg whitespace-nowrap transition cursor-pointer"
                        >
                          Lowest satisfaction profile
                        </button>
                        <button 
                          onClick={() => handlePresetChat("Recommend actions for our negative categories.")}
                          className="px-2.5 py-1 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 rounded-lg whitespace-nowrap transition cursor-pointer"
                        >
                          Get corrective recommendations
                        </button>
                      </div>

                      {/* Input Box */}
                      <form onSubmit={handleChatSubmit} className="flex gap-2 border-t border-white/5 pt-3 shrink-0 print:hidden">
                        <input 
                          type="text" 
                          value={chatQuery}
                          onChange={(e) => setChatQuery(e.target.value)}
                          placeholder="Type query to scan database..." 
                          className="flex-1 glass-input py-2 px-3.5 text-xs focus:ring-1 focus:ring-blue-500/20"
                        />
                        <button 
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-550 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer shadow-lg shadow-blue-600/10"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>

                    </div>

                  </div>

                </>
              ) : (
                <div className="text-center py-20 glass-panel space-y-3">
                  <Activity className="w-12 h-12 text-slate-600 animate-spin mx-auto" />
                  <p className="text-sm text-slate-450">Loading dashboard analytics parameters...</p>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* ==================== 3.5 USER MANAGEMENT CONTROL PANEL =================== */}
          {/* ========================================================================= */}
          {token && currentView === 'users' && user?.role === 'admin' && (
            <div className="space-y-6 max-w-6xl mx-auto py-6 animate-fade-in-up">
              {/* Header card */}
              <div className="glass-panel p-6 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"></div>
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <span className="text-[10px] font-bold text-pink-500 uppercase tracking-widest block">System Control</span>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">User Account Directory</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Manage academic faculty access permissions, student roll credentials, and system locks.
                    </p>
                  </div>
                </div>
              </div>

              {/* Filter controls */}
              <div className="glass-panel p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                {/* Search query */}
                <div className="w-full sm:max-w-xs relative">
                  <input
                    type="text"
                    placeholder="Search by name, roll, email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full glass-input pr-10"
                  />
                </div>

                {/* Role Filter Selector */}
                <div className="flex border border-slate-200/40 dark:border-slate-800/40 p-0.5 bg-slate-100/50 dark:bg-slate-950/30 rounded-xl w-full sm:w-auto shrink-0 relative overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('all')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors duration-200 cursor-pointer ${
                      userRoleFilter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-450 hover:text-slate-200'
                    }`}
                  >
                    All Accounts
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('student')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors duration-200 cursor-pointer ${
                      userRoleFilter === 'student' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-450 hover:text-slate-200'
                    }`}
                  >
                    Students
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('faculty')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors duration-200 cursor-pointer ${
                      userRoleFilter === 'faculty' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-405 hover:text-slate-200'
                    }`}
                  >
                    Faculty / Staff
                  </button>
                </div>
              </div>

              {/* Error boundary & Loader inside table */}
              <div className="glass-panel overflow-hidden">
                {loadingUsers ? (
                  <div className="text-center py-20">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Loading user catalog...</p>
                  </div>
                ) : usersError ? (
                  <div className="text-center py-20 text-rose-500">
                    <p className="text-sm font-semibold">{usersError}</p>
                    <button 
                      onClick={fetchUsers}
                      className="mt-4 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 hover:text-white px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                    >
                      Retry Connection
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full border-collapse text-left text-sm text-slate-500 dark:text-slate-400">
                      <thead className="bg-white/5 text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-white/8">
                        <tr>
                          <th className="px-6 py-4">Account Holder</th>
                          <th className="px-6 py-4">University Roll / ID</th>
                          <th className="px-6 py-4">Academic Role</th>
                          <th className="px-6 py-4">Department</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(() => {
                          const filtered = (usersList || []).filter(u => {
                            // Filter by role
                            if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
                            // Filter by search query
                            if (userSearchQuery.trim()) {
                              const q = userSearchQuery.toLowerCase();
                              const nameMatch = u.full_name?.toLowerCase().includes(q);
                              const rollMatch = u.roll_number?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q);
                              const emailMatch = u.email?.toLowerCase().includes(q);
                              return nameMatch || rollMatch || emailMatch;
                            }
                            return true;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                  No accounts found matching the current search parameters.
                                </td>
                              </tr>
                            );
                          }

                          return filtered.map((u) => (
                            <tr key={u.id} className="hover:bg-white/5 transition">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-slate-900 dark:text-slate-200">{u.full_name || u.username}</div>
                                <div className="text-xs text-slate-450 dark:text-slate-400 mt-0.5">{u.email}</div>
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-slate-800 dark:text-slate-300">
                                {u.roll_number || u.username}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                                  u.role === 'student'
                                    ? 'bg-blue-500/10 text-blue-450 border-blue-500/20'
                                    : 'bg-purple-500/10 text-purple-450 border-purple-500/20'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-350">
                                {u.department || 'N/A'}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`flex items-center gap-1.5 text-xs font-semibold ${
                                  u.is_blocked ? 'text-rose-500' : 'text-emerald-500'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    u.is_blocked ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                                  }`}></span>
                                  {u.is_blocked ? 'Locked / Blocked' : 'Active / Allowed'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => handleToggleBlock(u)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                                    u.is_blocked
                                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white'
                                  }`}
                                >
                                  {u.is_blocked ? 'Allow Access' : 'Revoke Access'}
                                </button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ==================== 3.6 DYNAMIC FEEDBACK FORM DESIGNER ================== */}
          {/* ========================================================================= */}
          {token && currentView === 'form-designer' && user?.role === 'admin' && (
            <div className="space-y-6 max-w-6xl mx-auto py-6 animate-fade-in-up">
              {/* Welcome banner */}
              <div className="glass-panel p-6 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500"></div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                  <div>
                    <span className="text-[10px] font-bold text-pink-500 uppercase tracking-widest block">System Template Designer</span>
                    <h2 className="text-xl font-extrabold text-white mt-1">Feedback Questionnaire Architect</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Customize evaluation categories and question fields. Students will see these changes updated in real-time.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (window.confirm("Are you sure you want to reset the feedback form to the default AKTU template?")) {
                          setFeedbackSections(DEFAULT_SECTIONS);
                          localStorage.setItem('custom_feedback_sections', JSON.stringify(DEFAULT_SECTIONS));
                          alert("Feedback form template reset to factory default!");
                        }
                      }}
                      className="px-3.5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Reset to Default
                    </button>
                    <button
                      onClick={() => {
                        localStorage.setItem('custom_feedback_sections', JSON.stringify(feedbackSections));
                        // Update ratings default shape inside student form
                        setStudentForm(prev => ({
                          ...prev,
                          section_ratings: initializeRatings(feedbackSections),
                          section_texts: initializeTexts(feedbackSections)
                        }));
                        alert("🎉 Questionnaire template saved and published successfully!");
                      }}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-600/10 cursor-pointer"
                    >
                      Save & Publish Layout
                    </button>
                  </div>
                </div>
              </div>

              {/* Designer Board */}
              <div className="space-y-6">
                {feedbackSections.map((sec, secIdx) => (
                  <div key={secIdx} className="glass-panel p-6 space-y-4 relative overflow-hidden">
                    <div className="absolute left-0 inset-y-0 w-1 bg-purple-500"></div>
                    
                    {/* Category Title Header */}
                    <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/5">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-bold text-purple-400">Category {secIdx + 1}:</span>
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFeedbackSections(prev => prev.map((s, idx) => idx === secIdx ? { ...s, title: val } : s));
                          }}
                          className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-white/20 focus:border-purple-500 focus:outline-none px-1 py-0.5 flex-1 max-w-sm"
                          placeholder="Category Name"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete the "${sec.title}" category? All its questions will be removed.`)) {
                            setFeedbackSections(prev => prev.filter((_, idx) => idx !== secIdx));
                          }
                        }}
                        className="text-xs text-rose-500 hover:text-rose-400 font-bold transition cursor-pointer"
                      >
                        Delete Category
                      </button>
                    </div>

                    {/* Questions Stepper Details */}
                    <div className="space-y-3">
                      {sec.questions.map((q, qIdx) => (
                        <div key={qIdx} className="flex items-center gap-3 p-3 bg-white/5 border border-white/8 rounded-2xl">
                          <span className="text-[10px] font-bold text-slate-500 font-mono">Q{qIdx + 1}:</span>
                          <input
                            type="text"
                            value={q.label}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFeedbackSections(prev => prev.map((s, sIdx) => sIdx === secIdx ? {
                                ...s,
                                questions: s.questions.map((ques, idx) => idx === qIdx ? { ...ques, label: val } : ques)
                              } : s));
                            }}
                            className="bg-transparent text-xs text-slate-200 focus:outline-none flex-1 border-b border-transparent focus:border-purple-500/40"
                            placeholder="Type evaluation rating question..."
                          />
                          <button
                            onClick={() => {
                              setFeedbackSections(prev => prev.map((s, sIdx) => sIdx === secIdx ? {
                                ...s,
                                questions: s.questions.filter((_, idx) => idx !== qIdx)
                              } : s));
                            }}
                            className="text-[10px] text-slate-500 hover:text-rose-500 font-semibold transition cursor-pointer"
                          >
                            Delete Field
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Question Addition controls */}
                    <div className="pt-2 flex justify-start">
                      <button
                        onClick={() => {
                          const newKey = `q${sec.questions.length + 1}_${Date.now()}`;
                          setFeedbackSections(prev => prev.map((s, sIdx) => sIdx === secIdx ? {
                            ...s,
                            questions: [...s.questions, { key: newKey, label: "New Rating Evaluation Question" }]
                          } : s));
                        }}
                        className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        + Add Rating Question
                      </button>
                    </div>

                  </div>
                ))}
              </div>

              {/* Add category footer control */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => {
                    const newSection = {
                      title: "New Evaluation Category",
                      questions: [
                        { key: `q1_${Date.now()}`, label: "Rate the performance or availability in this category." }
                      ]
                    };
                    setFeedbackSections(prev => [...prev, newSection]);
                  }}
                  className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/12 text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xl shadow-black/30"
                >
                  + Add New Evaluation Category Section
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* ==================== 4. LIVE FEEDBACK TABLE & LOGS ======================= */}
          {/* ========================================================================= */}
          {token && currentView === 'feedback-list' && (
            <div className="space-y-6">
              
              {/* FILTER BAR SECTION */}
              <div className="glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-200">Filter Feedback Stream:</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 md:max-w-3xl">
                  {/* Subject filter */}
                  <select 
                    value={filters.subject_id}
                    onChange={(e) => setFilters(prev => ({ ...prev, subject_id: e.target.value }))}
                    className="glass-input py-1.5 px-3 text-xs focus:ring-1 focus:ring-blue-500/20"
                  >
                    <option value="">All Subjects</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>

                  {/* Teacher filter */}
                  {user?.role !== 'faculty' && (
                    <select 
                      value={filters.teacher_id}
                      onChange={(e) => setFilters(prev => ({ ...prev, teacher_id: e.target.value }))}
                      className="glass-input py-1.5 px-3 text-xs focus:ring-1 focus:ring-blue-500/20"
                    >
                      <option value="">All Teachers</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}

                  {/* Semester filter */}
                  <select 
                    value={filters.semester}
                    onChange={(e) => setFilters(prev => ({ ...prev, semester: e.target.value }))}
                    className="glass-input py-1.5 px-3 text-xs focus:ring-1 focus:ring-blue-500/20"
                  >
                    <option value="">All Semesters</option>
                    {Array.from({ length: 8 }).map((_, idx) => (
                      <option key={idx} value={`Semester ${idx + 1}`}>{`Semester ${idx + 1}`}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setFilters({ subject_id: '', teacher_id: '', semester: '' })}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition duration-200 cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>

              {/* FEEDBACK DATATABLE CARD */}
              <div className="glass-panel overflow-hidden">
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-transparent">
                  <div>
                    <h3 className="font-bold text-white text-base">Feedback Pipelines Archive</h3>
                    <p className="text-xs text-slate-400 mt-1">Real-time classification tags and extracted metadata logs.</p>
                  </div>
                  <span className="px-2.5 py-1 bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs rounded-xl">
                    {feedbacks.length} submissions found
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5 text-slate-200 font-bold uppercase tracking-wider">
                        <th className="p-4">Submission Text</th>
                        <th className="p-4">Rating</th>
                        <th className="p-4">Sentiment</th>
                        <th className="p-4">Topic Category</th>
                        <th className="p-4">Keywords</th>
                        <th className="p-4 text-center">Priority</th>
                        <th className="p-4">AI Recommended Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-350">
                      {feedbacks.length > 0 ? (
                        feedbacks.map((fb) => (
                          <tr 
                            key={fb.id} 
                            className={`hover:bg-slate-800/20 transition ${
                              fb.priority === 'Flagged Toxic' ? 'bg-rose-500/5' : ''
                            }`}
                          >
                            {/* Raw feedback text with course/teacher details under it */}
                            <td className="p-4 max-w-sm">
                              <div className="space-y-1.5 mt-1 max-h-36 overflow-y-auto custom-scrollbar">
                                {fb.text.split(' | ').map((line, idx) => {
                                  if (line.includes(': ')) {
                                    const [secName, secComment] = line.split(': ');
                                    if (secComment.trim() && secComment.trim() !== "No major observations logged.") {
                                      return (
                                        <div key={idx} className="text-xs leading-relaxed">
                                          <strong className="text-slate-400 font-bold">{secName}: </strong>
                                          <span className="text-slate-300 italic">"{secComment}"</span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }
                                  return <p key={idx} className="text-xs text-slate-300 italic">"{line}"</p>;
                                })}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-500">
                                <span className="bg-blue-500/10 text-blue-455 border border-blue-500/20 px-2 py-0.5 rounded font-bold">{fb.subject.code}</span>
                                <span>•</span>
                                <span>Instructor: <strong className="text-slate-400">{fb.teacher.name}</strong></span>
                                <span>•</span>
                                <span>Term: {fb.semester}</span>
                                <span>•</span>
                                <span>{new Date(fb.timestamp).toLocaleDateString()}</span>
                              </div>
                            </td>

                            {/* Stars rating */}
                            <td className="p-4 whitespace-nowrap">
                              <div className="flex items-center gap-0.5 text-amber-400 font-semibold">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                <span>{fb.rating}.0</span>
                              </div>
                            </td>

                            {/* Sentiment label */}
                            <td className="p-4 whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                fb.sentiment === 'Positive' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                  : fb.sentiment === 'Negative' 
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                              }`}>
                                {fb.sentiment || 'Neutral'}
                              </span>
                            </td>

                            {/* Detected Category */}
                            <td className="p-4 font-semibold text-slate-300">
                              {fb.categories || 'General'}
                            </td>

                            {/* Extracted Keywords */}
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1 max-w-[150px]">
                                {fb.keywords ? (
                                  fb.keywords.split(',').map((kw, i) => (
                                    <span key={i} className="bg-white/10 border border-white/10 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">
                                      {kw.trim()}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </div>
                            </td>

                            {/* Priority tag */}
                            <td className="p-4 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                fb.priority === 'Flagged Toxic' ? 'bg-rose-500/20 text-rose-350 border border-rose-500/35 animate-pulse' :
                                fb.priority === 'High' ? 'bg-rose-500/10 text-rose-450 font-extrabold border border-rose-500/20' :
                                fb.priority === 'Medium' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                                'bg-blue-500/10 text-blue-450 border border-blue-500/20'
                              }`}>
                                {fb.priority || 'Low'}
                              </span>
                            </td>

                            {/* AI Recommendations */}
                            <td className="p-4 text-xs italic text-slate-400 max-w-xs">
                              {fb.recommendation || 'No critical corrective action needed.'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="p-12 text-center text-xs text-slate-500">
                            No matching feedback found in archives.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </main>

      {/* ========================================================================= */}
      {/* ==================== 5. PRINT CSS STYLE LAYOUTS FOR PDF ================= */}
      {/* ========================================================================= */}
      {/* This hidden div gets styled only on @media print to layout clean reports */}
      {token && dashboardData && (
        <div className="hidden print:block w-full p-8 text-black bg-white min-h-screen">
          <div className="border-b-2 border-blue-600 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Academic Analytics & AI Decision Report</h1>
            <p className="text-xs text-slate-500 mt-1">Generated dynamically via EduFeedback AI Pipeline • Date: {new Date().toLocaleDateString()}</p>
            {filters.semester && <p className="text-xs text-slate-500">Filters: Semester: {filters.semester}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="border border-slate-300 p-4 rounded text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Submissions</p>
              <h2 className="text-2xl font-bold text-blue-600 mt-1">{dashboardData.total_feedback}</h2>
            </div>
            <div className="border border-slate-300 p-4 rounded text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase">Average Rating</p>
              <h2 className="text-2xl font-bold text-amber-600 mt-1">{dashboardData.average_rating} / 5.0</h2>
            </div>
            <div className="border border-slate-300 p-4 rounded text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase">Positive Ratio</p>
              {(() => {
                const total = dashboardData.total_feedback;
                const posPct = total > 0 ? Math.round((dashboardData.sentiment_breakdown.positive / total) * 100) : 0;
                return <h2 className="text-2xl font-bold text-emerald-600 mt-1">{posPct}%</h2>;
              })()}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-300 pb-2 mb-3">Detected Issue Areas Breakdown</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
                  <th className="p-2">Category</th>
                  <th className="p-2 text-center">Total Mentions</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.category_counts.map((c, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="p-2 font-semibold">{c.category}</td>
                    <td className="p-2 text-center">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-300 pb-2 mb-3">AI Corrective Actions Recommendation List</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
                  <th className="p-2">Category</th>
                  <th className="p-2 text-center">Negative Mentions</th>
                  <th className="p-2">AI Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.recommendations.map((r, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="p-2 font-bold text-slate-800">{r.category}</td>
                    <td className="p-2 text-center text-rose-600 font-bold">{r.count}</td>
                    <td className="p-2 text-slate-600 italic">{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-300 pb-2 mb-3">Escalated Grievances & Flags</h3>
            <div className="space-y-3">
              {dashboardData.alerts.map(a => (
                <div key={a.id} className="border border-slate-350 p-3 rounded">
                  <p className="text-xs font-bold text-rose-600">[{a.priority}] - Course: {a.subject_name} | Instructor: {a.teacher_name}</p>
                  <p className="text-xs text-slate-700 italic mt-1">"{a.text}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
