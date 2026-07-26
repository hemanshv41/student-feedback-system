import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-950 text-rose-100 min-h-screen font-sans flex flex-col justify-center items-center">
          <div className="max-w-2xl bg-slate-900 border border-rose-500/25 p-6 rounded-2xl shadow-2xl space-y-4">
            <h1 className="text-xl font-bold text-rose-400">⚠️ React Application Runtime Error</h1>
            <p className="text-sm text-slate-300">An uncaught exception occurred in the React rendering tree:</p>
            <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-rose-350 overflow-x-auto max-h-60 custom-scrollbar">
              {this.state.error?.toString()}
              {"\n\n"}
              {this.state.error?.stack}
            </pre>
            <div className="flex gap-4">
              <button 
                onClick={() => { localStorage.clear(); window.location.reload(); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
              >
                Clear LocalStorage & Reload
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
              >
                Retry Load
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
