import React, { useState, useEffect } from 'react';
import { Camera, LayoutDashboard, History, Database, Info, Search } from 'lucide-react';
import CaptureView from './components/CaptureView';
import DashboardView from './components/DashboardView';
import HistoryView from './components/HistoryView';
import KnowledgeView from './components/KnowledgeView';
import { SafetyIssue, PlantKnowledge } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'capture' | 'dashboard' | 'history' | 'knowledge'>('dashboard');
  const [issues, setIssues] = useState<SafetyIssue[]>([]);
  const [knowledge, setKnowledge] = useState<PlantKnowledge[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Device detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load from local storage
  useEffect(() => {
    const savedIssues = localStorage.getItem('safety_issues');
    if (savedIssues) {
      try {
        const parsed = JSON.parse(savedIssues);
        const migrated = parsed.map((issue: any) => ({
          ...issue,
          updatedAt: issue.updatedAt || issue.timestamp
        }));
        setIssues(migrated);
      } catch (e) {
        console.error(e);
      }
    }

    const savedKnowledge = localStorage.getItem('plant_knowledge');
    if (savedKnowledge) {
      try {
        setKnowledge(JSON.parse(savedKnowledge));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('safety_issues', JSON.stringify(issues));
  }, [issues]);

  useEffect(() => {
    localStorage.setItem('plant_knowledge', JSON.stringify(knowledge));
  }, [knowledge]);

  const plantContext = knowledge.map(k => `${k.title} (${k.category}): ${k.content}`).join('\n');

  const handleSaveIssue = (issue: SafetyIssue) => {
    setIssues([issue, ...issues]);
  };

  const handleUpdateIssue = (updatedIssue: SafetyIssue) => {
    const issueWithTimestamp = { ...updatedIssue, updatedAt: Date.now() };
    setIssues(issues.map(i => i.id === updatedIssue.id ? issueWithTimestamp : i));
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-[#f0f6fc] font-sans flex flex-col md:flex-row">
      {/* Desktop Sidebar Navigation - Only shown on Desktop */}
      {!isMobile && (
        <nav className="hidden md:flex flex-col w-64 border-r border-[#30363d] bg-[#0c0e14] h-screen sticky top-0 px-4 py-8 relative z-50">
          <div className="mb-12 px-2 flex items-center gap-2">
            <h1 className="text-[1.2rem] font-[800] tracking-[1px] text-[#ff6b00]">SAFE-AI <span className="font-[200] text-[0.8rem] text-white">PRO</span></h1>
          </div>
          
          <div className="space-y-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center px-4 py-2 rounded-md transition-colors border-l-4 ${
                activeTab === 'dashboard' 
                  ? 'bg-[#11141b] text-[#f0f6fc] border-[#ff6b00]' 
                  : 'text-[#8b949e] border-transparent hover:bg-[#11141b]'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mr-3" />
              <span className="font-semibold text-sm">Dashboard</span>
            </button>

            <button 
              onClick={() => setActiveTab('history')}
              className={`w-full flex items-center px-4 py-2 rounded-md transition-colors border-l-4 ${
                activeTab === 'history' 
                  ? 'bg-[#11141b] text-[#f0f6fc] border-[#ff6b00]' 
                  : 'text-[#8b949e] border-transparent hover:bg-[#11141b]'
              }`}
            >
              <History className="w-5 h-5 mr-3" />
              <span className="font-semibold text-sm">Incident History</span>
            </button>

            <button 
              onClick={() => setActiveTab('knowledge')}
              className={`w-full flex items-center px-4 py-2 rounded-md transition-colors border-l-4 ${
                activeTab === 'knowledge' 
                  ? 'bg-[#11141b] text-[#f0f6fc] border-[#ff6b00]' 
                  : 'text-[#8b949e] border-transparent hover:bg-[#11141b]'
              }`}
            >
              <Database className="w-5 h-5 mr-3" />
              <span className="font-semibold text-sm">Plant Knowledge</span>
            </button>
            
            <div className="mt-8 px-4 py-3 bg-[#05070a] border border-[#30363d] rounded text-[0.65rem] text-[#8b949e]">
              <p className="font-bold text-[#ff6b00] mb-1">FIELD UNIT REDIRECT</p>
              Use mobile device to access Field Incident Capture system.
            </div>
          </div>
          
          <div className="mt-auto px-2 text-[0.7rem] text-[#8b949e]">
            System Status: <span className="text-[#238636]">Online</span>
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-y-auto">
        <header className="hidden md:flex border-b border-[#30363d] bg-[#05070a] px-8 py-0 h-[64px] items-center justify-between sticky top-0 z-40">
           <div className="text-[0.85rem] text-[#8b949e]">Safety Officers / Investigations / <strong>{activeTab.toUpperCase()}</strong></div>
           <div className="flex items-center gap-3 text-[0.85rem]">
             <span>Officer Marcus Vane</span>
             <div className="w-8 h-8 rounded-full bg-[#ff6b00] text-white flex items-center justify-center font-bold text-[0.75rem]">MV</div>
           </div>
        </header>

        {activeTab === 'capture' && isMobile && <CaptureView onSaveIssue={handleSaveIssue} plantContext={plantContext} />}
        {activeTab === 'dashboard' && <DashboardView issues={issues} onUpdateIssue={handleUpdateIssue} plantContext={plantContext} onViewHistory={() => setActiveTab('history')} />}
        {activeTab === 'history' && <HistoryView issues={issues} onUpdateIssue={handleUpdateIssue} plantContext={plantContext} />}
        {activeTab === 'knowledge' && <KnowledgeView knowledge={knowledge} onUpdateKnowledge={setKnowledge} />}
        
        {/* Fallback messages if user tries to bypass */}
        {activeTab === 'capture' && !isMobile && (
          <div className="flex flex-col items-center justify-center h-full text-[#8b949e] p-8">
            <Camera className="w-16 h-16 mb-4 opacity-20" />
            <h2 className="text-xl font-bold text-[#f0f6fc]">Mobile Device Required</h2>
            <p className="max-w-xs text-center mt-2 text-sm">Please open this application on a mobile device to use the visual search and field incident reporting tools.</p>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation - Only shown on Mobile */}
      {isMobile && (
        <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0c0e14]/90 backdrop-blur-md border border-[#30363d] rounded-full z-50 px-6 py-3 flex gap-4 xs:gap-8 shadow-2xl">
          <button 
            onClick={() => setActiveTab('capture')}
            className={`flex flex-col items-center ${activeTab === 'capture' ? 'text-[#ff6b00]' : 'text-[#8b949e]'}`}
          >
            <Camera className={`w-5 h-5 mb-1`} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Scan</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center ${activeTab === 'dashboard' ? 'text-[#ff6b00]' : 'text-[#8b949e]'}`}
          >
            <LayoutDashboard className={`w-5 h-5 mb-1`} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Dash</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center ${activeTab === 'history' ? 'text-[#ff6b00]' : 'text-[#8b949e]'}`}
          >
            <History className={`w-5 h-5 mb-1`} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Logs</span>
          </button>

          <button 
            onClick={() => setActiveTab('knowledge')}
            className={`flex flex-col items-center ${activeTab === 'knowledge' ? 'text-[#ff6b00]' : 'text-[#8b949e]'}`}
          >
            <Database className={`w-5 h-5 mb-1`} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Context</span>
          </button>
        </nav>
      )}
    </div>
  );
}

