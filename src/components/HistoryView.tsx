import React, { useState } from 'react';
import { format } from 'date-fns';
import { ChevronRight, FileText } from 'lucide-react';
import { SafetyIssue } from '../types';
import DeepAnalysisStudio from './DeepAnalysisStudio';

interface HistoryViewProps {
  issues: SafetyIssue[];
  onUpdateIssue: (issue: SafetyIssue) => void;
  plantContext?: string;
}

export default function HistoryView({ issues, onUpdateIssue, plantContext }: HistoryViewProps) {
  const [selectedIssue, setSelectedIssue] = useState<SafetyIssue | null>(null);

  const handleUpdate = (updated: SafetyIssue) => {
    onUpdateIssue(updated);
    if (selectedIssue?.id === updated.id) {
      setSelectedIssue(updated);
    }
  };

  // Grouping logic for History
  const groupedIssues = issues.reduce((acc, issue) => {
    const month = format(issue.updatedAt || issue.timestamp, 'MMMM yyyy');
    if (!acc[month]) acc[month] = [];
    acc[month].push(issue);
    return acc;
  }, {} as Record<string, SafetyIssue[]>);

  const sortedMonths = Object.keys(groupedIssues).sort((a, b) => {
    const dateA = new Date(a).getTime();
    const dateB = new Date(b).getTime();
    return dateB - dateA; // Descending
  });

  const [expandedMonths, setExpandedMonths] = useState<string[]>(sortedMonths.slice(0, 1));

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => 
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
    );
  };

  if (selectedIssue) {
    return (
      <DeepAnalysisStudio 
        issue={selectedIssue} 
        onUpdateIssue={handleUpdate} 
        onClose={() => setSelectedIssue(null)} 
        plantContext={plantContext}
        sourceType="history"
      />
    );
  }

  return (
    <div className="w-full mx-auto p-6 md:p-8">
      <div className="mb-8 border-b border-[#30363d] pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-wide">Incident History</h1>
          <p className="text-sm text-[#8b949e] mt-1">Full Archive of Safety Records</p>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-20 bg-[#11141b] rounded-lg border border-[#30363d]">
          <p className="text-[#8b949e] text-[0.75rem] font-bold uppercase tracking-wider">Historical records empty.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedMonths.map(month => (
            <div key={month} className="bg-[#11141b] border border-[#30363d] rounded-lg overflow-hidden transition-all duration-300">
              <button 
                onClick={() => toggleMonth(month)}
                className="w-full flex items-center justify-between p-6 hover:bg-[#1a1f28] transition-colors"
                id={`history-month-${month.replace(' ', '-')}`}
              >
                <div className="flex items-center gap-4">
                   <div className="bg-[#ff6b00]/10 p-2 rounded">
                      <FileText className="w-5 h-5 text-[#ff6b00]" />
                   </div>
                   <div className="text-left">
                      <h2 className="text-[1rem] font-bold text-[#f0f6fc]">{month}</h2>
                      <p className="text-[0.7rem] uppercase tracking-widest text-[#8b949e]">{groupedIssues[month].length} Captured Incidents</p>
                   </div>
                </div>
                <ChevronRight className={`w-5 h-5 text-[#8b949e] transition-transform duration-300 ${expandedMonths.includes(month) ? 'rotate-90' : ''}`} />
              </button>

              {expandedMonths.includes(month) && (
                <div className="p-6 pt-0 border-t border-[#30363d] animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-6">
                    {groupedIssues[month].map(issue => (
                      <div 
                        key={issue.id} 
                        onClick={() => setSelectedIssue(issue)}
                        className="bg-[#0c0e14] rounded-lg overflow-hidden border border-[#30363d] hover:border-[#ff6b00] transition-colors cursor-pointer group flex flex-col h-[340px]"
                        id={`history-issue-${issue.id}`}
                      >
                         <div className="h-[140px] overflow-hidden relative border-b border-[#30363d] bg-[#1f242c]">
                           <img src={issue.image} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                           <div className="absolute top-2 left-2 bg-[#05070a]/90 backdrop-blur text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded text-[#8b949e]">
                             {format(issue.updatedAt || issue.timestamp, 'MMM dd, yyyy - HH:mm')}
                           </div>
                         </div>
                         <div className="p-4 flex-1 flex flex-col relative">
                            <div className="text-[0.65rem] uppercase tracking-widest text-[#ff6b00] font-bold mb-1">INC-{issue.id.substring(0, 5)}</div>
                            <p className="text-[0.8rem] text-[#f0f6fc] line-clamp-3 leading-relaxed mb-4">
                              {issue.finalStatement}
                            </p>
                            <div className="mt-auto flex items-center text-[#8b949e] font-bold text-[0.65rem] tracking-wider uppercase group-hover:text-[#ff6b00] transition-colors font-mono">
                              View Record <ChevronRight className="w-3 h-3 ml-1" />
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
