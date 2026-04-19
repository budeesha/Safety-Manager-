import React, { useState } from 'react';
import { format, isSameMonth } from 'date-fns';
import { LayoutDashboard, Clock, ChevronRight } from 'lucide-react';
import { SafetyIssue } from '../types';
import DeepAnalysisStudio from './DeepAnalysisStudio';

interface DashboardViewProps {
  issues: SafetyIssue[];
  onUpdateIssue: (issue: SafetyIssue) => void;
  plantContext?: string;
  onViewHistory?: () => void;
}

export default function DashboardView({ issues, onUpdateIssue, plantContext, onViewHistory }: DashboardViewProps) {
  const [selectedIssue, setSelectedIssue] = useState<SafetyIssue | null>(null);

  const handleUpdate = (updated: SafetyIssue) => {
    onUpdateIssue(updated);
    if (selectedIssue?.id === updated.id) {
      setSelectedIssue(updated);
    }
  };

  // Filter for current month only
  const now = new Date();
  const currentMonthIssues = issues.filter(issue => 
    isSameMonth(new Date(issue.updatedAt || issue.timestamp), now)
  ).sort((a, b) => (b.updatedAt || b.timestamp) - (a.updatedAt || a.timestamp));

  if (selectedIssue) {
    return (
      <DeepAnalysisStudio 
        issue={selectedIssue} 
        onUpdateIssue={handleUpdate} 
        onClose={() => setSelectedIssue(null)} 
        plantContext={plantContext}
        sourceType="dashboard"
      />
    );
  }

  return (
    <div className="w-full mx-auto p-6 md:p-8">
      <div className="mb-8 border-b border-[#30363d] pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-wide">Live Dashboard</h1>
          <p className="text-sm text-[#8b949e] mt-1">Current Month Activity / {format(now, 'MMMM yyyy')}</p>
        </div>
        <button 
          onClick={onViewHistory}
          className="flex items-center text-[0.65rem] font-bold uppercase tracking-widest text-[#ff6b00] border border-[#ff6b00]/30 bg-[#ff6b00]/10 px-3 py-1.5 rounded-md hover:bg-[#ff6b00]/20 transition-all"
        >
          <Clock className="w-3.5 h-3.5 mr-2" /> View Full History
        </button>
      </div>

      {currentMonthIssues.length === 0 ? (
        <div className="text-center py-20 bg-[#11141b] rounded-lg border border-[#30363d]">
          <LayoutDashboard className="w-12 h-12 text-[#30363d] mx-auto mb-4" />
          <p className="text-[#8b949e] text-[0.75rem] font-bold uppercase tracking-wider">No incidents logged this month.</p>
          <button 
            onClick={onViewHistory}
            className="mt-4 text-[0.65rem] font-bold uppercase tracking-widest text-[#8b949e] hover:text-[#ff6b00] underline"
          >
            Access Historical Archives
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {currentMonthIssues.map(issue => (
            <div 
              key={issue.id} 
              onClick={() => setSelectedIssue(issue)}
              className="bg-[#11141b] rounded-lg overflow-hidden border border-[#30363d] hover:border-[#ff6b00] transition-colors cursor-pointer group flex flex-col h-[340px]"
              id={`dashboard-issue-${issue.id}`}
            >
               <div className="h-[140px] overflow-hidden relative border-b border-[#30363d] bg-[#1f242c]">
                 <img src={issue.image} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                 <div className="absolute top-2 left-2 bg-[#05070a]/90 backdrop-blur text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded text-[#8b949e]">
                   {format(issue.updatedAt || issue.timestamp, 'MMM dd - HH:mm')}
                 </div>
                 {issue.deepAnalysis && (
                   <div className="absolute top-2 right-2 bg-[#238636]/20 text-[#3fb950] border border-[#238636] text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded flex items-center">
                     Analyzed
                   </div>
                 )}
               </div>
               <div className="p-4 flex-1 flex flex-col relative">
                  <div className="text-[0.65rem] uppercase tracking-widest text-[#ff6b00] font-bold mb-1">INC-{issue.id.substring(0, 5)}</div>
                  <p className="text-[0.8rem] text-[#f0f6fc] line-clamp-3 leading-relaxed mb-4">
                    {issue.finalStatement}
                  </p>
                  
                  <div className="mt-auto flex items-center text-[#8b949e] font-bold text-[0.65rem] tracking-wider uppercase group-hover:text-[#ff6b00] transition-colors font-mono">
                    Investigate <ChevronRight className="w-3 h-3 ml-1" />
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
