import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { FileText, ChevronRight, Activity, X, Edit3, MessageCircle, Save, Sparkles, Send, Download, Presentation } from 'lucide-react';
import Markdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PptxGenJS from 'pptxgenjs';
import { SafetyIssue, FishboneData } from '../types';
import { generateDeepAnalysis, refineIncidentSection, updateFishboneViaChat } from '../lib/gemini';
import FishboneDiagram from './FishboneDiagram';

interface DeepAnalysisStudioProps {
  issue: SafetyIssue;
  onUpdateIssue: (issue: SafetyIssue) => void;
  onClose: () => void;
  plantContext?: string;
  sourceType: 'dashboard' | 'history';
}

export default function DeepAnalysisStudio({ issue, onUpdateIssue, onClose, plantContext, sourceType }: DeepAnalysisStudioProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingSection, setEditingSection] = useState<'statement' | 'fishbone' | 'compliance' | 'documentation' | null>(null);
  const [chattingSection, setChattingSection] = useState<'statement' | 'fishbone' | 'compliance' | 'documentation' | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fishboneEditState, setFishboneEditState] = useState<FishboneData | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!analysisRef.current) return;
    setIsProcessing(true);
    try {
      const canvas = await html2canvas(analysisRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#05070a'
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Incident_Report_${issue.id.substring(0, 5)}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF Export failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportSlides = () => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    // Slide 1: Title & Incident Overview
    const s1 = pptx.addSlide();
    s1.background = { color: '05070A' };
    s1.addText(`INCIDENT INVESTIGATION REPORT: INC-${issue.id.substring(0, 5)}`, {
      x: 0.5, y: 0.5, w: '90%', fontSize: 24, color: 'FF6B00', bold: true
    });
    s1.addText(`Date: ${format(issue.timestamp, 'MMMM dd, yyyy')}`, {
      x: 0.5, y: 1.0, fontSize: 14, color: '8B949E'
    });
    s1.addText("OFFICER STATEMENT:", { x: 0.5, y: 2.0, fontSize: 18, color: 'f0f6fc', bold: true });
    s1.addText(issue.finalStatement, {
      x: 0.5, y: 2.5, w: '90%', fontSize: 12, color: 'f0f6fc', margin: 10, fill: { color: '11141B' }
    });

    if (issue.deepAnalysis) {
      // Slide 2: Fishbone Diagram Summary
      const s2 = pptx.addSlide();
      s2.background = { color: '05070A' };
      s2.addText("ROOT CAUSE ANALYSIS (FISHBONE)", { x: 0.5, y: 0.5, fontSize: 24, color: 'FF6B00', bold: true });
      
      let yPos = 1.2;
      (Object.keys(issue.deepAnalysis.fishbone) as Array<keyof FishboneData>).forEach((cat, idx) => {
        const xPos = idx < 3 ? 0.5 : 5.0;
        const currentY = yPos + (idx % 3) * 1.8;
        s2.addText(cat.toUpperCase(), { x: xPos, y: currentY, fontSize: 14, color: 'FF6B00', bold: true });
        s2.addText(issue.deepAnalysis!.fishbone[cat].join('\n'), {
          x: xPos, y: currentY + 0.3, w: 4, fontSize: 10, color: 'f0f6fc', bullet: true
        });
      });

      // Slide 3: Compliance & Documentation
      const s3 = pptx.addSlide();
      s3.background = { color: '05070A' };
      s3.addText("COMPLIANCE FINDINGS & AUDIT SUMMARY", { x: 0.5, y: 0.5, fontSize: 24, color: 'FF6B00', bold: true });
      s3.addText(issue.deepAnalysis.closures.join('\n\n'), {
        x: 0.5, y: 1.5, w: '90%', fontSize: 11, color: 'f0f6fc', bullet: true
      });
    }

    pptx.writeFile({ fileName: `Incident_Presentation_${issue.id.substring(0, 5)}.pptx` });
  };

  const handleDeepAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      let mimeType = 'image/jpeg';
      let base64 = '';

      if (issue.image.startsWith('data:')) {
        mimeType = issue.image.split(';')[0].split(':')[1];
        base64 = issue.image.split(',')[1];
      } else {
        // Fallback for non-data URLs if any
        base64 = issue.image; 
      }

      if (!base64) throw new Error("Invalid image data");

      const deepAnalysis = await generateDeepAnalysis(issue.finalStatement, base64, mimeType, plantContext);
      onUpdateIssue({ ...issue, deepAnalysis, updatedAt: Date.now() });
      
      // Optional: Scroll to results
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      
    } catch (e) {
      console.error(e);
      alert(`Engineering Scan Failed: ${e instanceof Error ? e.message : 'Unknown Error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startEditing = (section: 'statement' | 'compliance' | 'documentation', value: string) => {
    setEditingSection(section);
    setEditValue(value);
  };

  const handleManualSave = async (section: 'statement' | 'compliance' | 'documentation') => {
    setIsProcessing(true);
    try {
      // Manual edit followed by AI polish
      const sectionName = section === 'statement' ? 'OFFICER STATEMENT' : (section === 'compliance' ? 'COMPLIANCE DOCUMENTATION' : 'FORMAL REPORT');
      const refined = await refineIncidentSection(sectionName, editValue, "Integrate the user's manual edits seamlessly while maintaining a professional industrial safety tone.", plantContext);
      
      let updatedIssue = { ...issue, updatedAt: Date.now() };
      if (section === 'statement') {
        updatedIssue.finalStatement = refined;
      } else if (section === 'compliance' && updatedIssue.deepAnalysis) {
        // Assume lines for compliance
        updatedIssue.deepAnalysis.closures = refined.split('\n').filter(l => l.trim().length > 0);
      } else if (section === 'documentation' && updatedIssue.deepAnalysis) {
        updatedIssue.deepAnalysis.documentation = refined;
      }
      
      onUpdateIssue(updatedIssue);
      setEditingSection(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChatAction = async (section: 'statement' | 'fishbone' | 'compliance' | 'documentation') => {
    if (!chatInput.trim()) return;
    setIsProcessing(true);
    try {
      let updatedIssue = { ...issue, updatedAt: Date.now() };
      
      if (section === 'fishbone' && issue.deepAnalysis) {
        const newFishbone = await updateFishboneViaChat(issue.deepAnalysis.fishbone, chatInput, plantContext);
        updatedIssue.deepAnalysis.fishbone = newFishbone;
        if (fishboneEditState) setFishboneEditState(newFishbone);
      } else {
        const sectionName = section === 'statement' ? 'OFFICER STATEMENT' : (section === 'compliance' ? 'COMPLIANCE FINDINGS' : 'FORMAL REPORT');
        const currentVal = section === 'statement' ? issue.finalStatement : (section === 'compliance' ? issue.deepAnalysis?.closures.join('\n') : issue.deepAnalysis?.documentation);
        const refined = await refineIncidentSection(sectionName, currentVal || '', chatInput, plantContext);
        
        if (section === 'statement') updatedIssue.finalStatement = refined;
        else if (section === 'compliance' && updatedIssue.deepAnalysis) updatedIssue.deepAnalysis.closures = refined.split('\n').filter(l => l.trim().length > 0);
        else if (section === 'documentation' && updatedIssue.deepAnalysis) updatedIssue.deepAnalysis.documentation = refined;
      }

      onUpdateIssue(updatedIssue);
      setChatInput('');
      setChattingSection(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateManualFishbone = (category: keyof FishboneData, index: number, value: string) => {
    if (!fishboneEditState) return;
    const newState = { ...fishboneEditState };
    newState[category][index] = value;
    setFishboneEditState(newState);
  };

  const addFishboneItem = (category: keyof FishboneData) => {
    if (!fishboneEditState) return;
    const newState = { ...fishboneEditState };
    newState[category].push('');
    setFishboneEditState(newState);
  };

  const removeFishboneItem = (category: keyof FishboneData, index: number) => {
    if (!fishboneEditState) return;
    const newState = { ...fishboneEditState };
    newState[category] = newState[category].filter((_, i) => i !== index);
    setFishboneEditState(newState);
  };

  const saveManualFishbone = () => {
    if (!fishboneEditState) return;
    onUpdateIssue({
      ...issue,
      updatedAt: Date.now(),
      deepAnalysis: {
        ...issue.deepAnalysis!,
        fishbone: fishboneEditState
      }
    });
    setEditingSection(null);
    setFishboneEditState(null);
  };

  return (
    <div className="w-full mx-auto p-6 md:p-8 animate-in fade-in duration-500">
      <button 
        onClick={onClose}
        className="flex items-center text-[0.75rem] font-bold uppercase tracking-widest text-[#8b949e] mb-6 hover:text-[#f0f6fc] transition-colors"
      >
        <X className="w-4 h-4 mr-2" /> Back to {sourceType === 'dashboard' ? 'Dashboard' : 'History'}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
        {/* Left Sidebar: Original Capture Data */}
        <div className="lg:col-span-1 space-y-6">
          <div className="border border-[#30363d] bg-[#11141b] rounded-lg p-4 flex flex-col gap-4 sticky top-24">
             <div className="text-[0.75rem] uppercase tracking-widest text-[#8b949e] flex justify-between items-center mb-2">
                <span className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-[#ff6b00]" /> Intelligence Studio</span>
                <span>#{issue.id.substring(0, 5).toUpperCase()}</span>
             </div>
             
             <div className="rounded overflow-hidden shadow-none border border-dashed border-[#30363d] flex items-center justify-center bg-[#1f242c] relative">
               <img src={issue.image} alt="Incident" className="w-full h-auto object-cover max-h-[300px]" referrerPolicy="no-referrer" />
               <div className="absolute bottom-2 right-2 text-[0.6rem] text-[#8b949e] drop-shadow-md bg-black/60 px-2 py-1 rounded">Captured on {format(issue.timestamp, 'HH:mm - MMM dd')}</div>
             </div>
             
             {/* Officer Statement Section */}
             <div className="group relative">
               <div className="flex justify-between items-baseline mb-2">
                 <h3 className="text-xs uppercase font-bold text-[#8b949e] tracking-widest">Officer Statement</h3>
                 <div className="flex gap-2">
                   <button 
                    onClick={() => startEditing('statement', issue.finalStatement)}
                    className="p-1 hover:text-[#ff6b00] text-[#8b949e] transition-colors" title="Edit Manually"
                   >
                     <Edit3 className="w-3.5 h-3.5" />
                   </button>
                   <button 
                    onClick={() => setChattingSection(chattingSection === 'statement' ? null : 'statement')}
                    className={`p-1 transition-colors ${chattingSection === 'statement' ? 'text-[#ff6b00]' : 'text-[#8b949e] hover:text-[#ff6b00]'}`} title="AI Chat Refinement"
                   >
                     <MessageCircle className="w-3.5 h-3.5" />
                   </button>
                 </div>
               </div>

               {editingSection === 'statement' ? (
                 <div className="space-y-2">
                    <textarea 
                      className="w-full bg-[#05070a] border border-[#30363d] rounded p-3 text-[0.85rem] text-[#f0f6fc] outline-none focus:border-[#ff6b00] h-32"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                       <button onClick={() => setEditingSection(null)} className="text-[0.6rem] uppercase tracking-widest text-[#8b949e] hover:text-[#f0f6fc]">Cancel</button>
                       <button 
                        onClick={() => handleManualSave('statement')}
                        className="text-[0.6rem] uppercase tracking-widest bg-[#ff6b00] text-white px-3 py-1 rounded font-bold disabled:opacity-50"
                        disabled={isProcessing}
                       >
                         {isProcessing ? 'Polishing...' : 'Save & Polish'}
                       </button>
                    </div>
                 </div>
               ) : (
                 <div className="bg-[#05070a] p-3 rounded text-[0.85rem] leading-relaxed text-[#f0f6fc] border-l-2 border-[#ff6b00]">
                   {issue.finalStatement}
                 </div>
               )}

               {chattingSection === 'statement' && (
                 <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex gap-2">
                      <input 
                        className="flex-1 bg-[#1f242c] border border-[#30363d] rounded px-3 py-1.5 text-xs outline-none focus:border-[#ff6b00]"
                        placeholder="e.g. 'Make it sound more urgent'"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleChatAction('statement')}
                      />
                      <button 
                        onClick={() => handleChatAction('statement')}
                        className="bg-[#30363d] p-2 rounded text-[#ff6b00] hover:bg-[#ff6b00] hover:text-white transition-all disabled:opacity-50"
                        disabled={isProcessing}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                 </div>
               )}
             </div>

             {!issue.deepAnalysis && !isAnalyzing && (
               <button 
                 onClick={handleDeepAnalysis}
                 className="w-full mt-4 bg-[#ff6b00] text-white py-3 rounded text-[0.8rem] font-bold uppercase tracking-wider flex items-center justify-center hover:bg-[#e66000] transition-colors"
               >
                 <Activity className="w-4 h-4 mr-2" /> Run AI Intelligence Deep Scan
               </button>
             )}

             {isAnalyzing && (
                 <div className="w-full mt-4 border border-[#30363d] bg-[#0c0e14] py-3 rounded text-[0.8rem] font-bold uppercase tracking-wider flex items-center justify-center text-[#8b949e] animate-pulse">
                 <Activity className="w-4 h-4 mr-2 animate-spin text-[#ff6b00]" /> Scanning Incident Vectors...
               </div>
             )}
          </div>
        </div>

        {/* Right Content: Deep Analysis Studio */}
        <div className="lg:col-span-1 space-y-10" ref={analysisRef}>
          {issue.deepAnalysis ? (
            <>
              {/* Fishbone Section */}
              <section className="bg-[#11141b] rounded-lg border border-[#30363d] p-6">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-[0.75rem] uppercase tracking-widest text-[#8b949e] font-bold">Cause-and-Effect Analysis (Fishbone)</h2>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => {
                          if (editingSection === 'fishbone') {
                            setEditingSection(null);
                            setFishboneEditState(null);
                          } else {
                            setEditingSection('fishbone');
                            setFishboneEditState(JSON.parse(JSON.stringify(issue.deepAnalysis!.fishbone)));
                          }
                        }}
                        className={`flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-widest py-1.5 px-3 rounded border transition-all ${
                          editingSection === 'fishbone' 
                            ? 'border-[#ff6b00] text-[#ff6b00] bg-[#ff6b00]/10' 
                            : 'border-[#30363d] text-[#8b949e] hover:border-[#ff6b00] hover:text-[#ff6b00]'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> {editingSection === 'fishbone' ? 'Close Editor' : 'Manual Edit Blocks'}
                      </button>
                      <button 
                        onClick={() => setChattingSection(chattingSection === 'fishbone' ? null : 'fishbone')}
                        className={`flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-widest py-1.5 px-3 rounded border transition-all ${
                          chattingSection === 'fishbone' 
                            ? 'border-[#ff6b00] text-[#ff6b00] bg-[#ff6b00]/10' 
                            : 'border-[#30363d] text-[#8b949e] hover:border-[#ff6b00] hover:text-[#ff6b00]'
                        }`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> {chattingSection === 'fishbone' ? 'Close Chat' : 'Chat & Edit Diagram'}
                      </button>
                    </div>
                 </div>
                 
                 {chattingSection === 'fishbone' && (
                   <div className="mb-6 p-4 bg-[#05070a] border border-[#ff6b00]/30 rounded-lg animate-in slide-in-from-top-2">
                     <p className="text-[0.7rem] text-[#8b949e] mb-3 font-medium flex items-center gap-2">
                       <Sparkles className="w-3 h-3 text-[#ff6b00]" /> Instruct AI to modify categories or add specific root causes.
                     </p>
                     <div className="flex gap-2">
                        <input 
                          className="flex-1 bg-[#11141b] border border-[#30363d] rounded px-4 py-2 text-sm outline-none focus:border-[#ff6b00]"
                          placeholder="e.g. 'Add improper PPE to the Man category'"
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleChatAction('fishbone')}
                        />
                        <button 
                          onClick={() => handleChatAction('fishbone')}
                          className="bg-[#ff6b00] px-4 rounded text-white hover:bg-[#e66000] transition-all disabled:opacity-50"
                          disabled={isProcessing}
                        >
                          {isProcessing ? <Activity className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                   </div>
                 )}

                 {editingSection === 'fishbone' && fishboneEditState && (
                    <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                      {(Object.keys(fishboneEditState) as Array<keyof FishboneData>).map((category) => (
                        <div key={category} className="bg-[#05070a] border border-[#30363d] rounded p-4">
                           <div className="flex justify-between items-center mb-3">
                              <h4 className="text-[0.65rem] font-bold text-[#f0f6fc] uppercase tracking-widest">{category}</h4>
                              <button 
                                onClick={() => addFishboneItem(category)}
                                className="text-[0.6rem] text-[#ff6b00] hover:underline uppercase tracking-tighter"
                              >
                                + Add Item
                              </button>
                           </div>
                           <div className="space-y-2">
                              {fishboneEditState[category].map((item, idx) => (
                                <div key={idx} className="flex gap-2">
                                  <input 
                                    className="flex-1 bg-[#11141b] border border-[#30363d] rounded px-2 py-1 text-[0.75rem] outline-none focus:border-[#ff6b00]"
                                    value={item}
                                    onChange={(e) => updateManualFishbone(category, idx, e.target.value)}
                                  />
                                  <button onClick={() => removeFishboneItem(category, idx)} className="text-[#8b949e] hover:text-[#f85149]">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                           </div>
                        </div>
                      ))}
                      <div className="md:col-span-full flex justify-end gap-3 pt-4 border-t border-[#30363d]">
                        <button onClick={() => { setEditingSection(null); setFishboneEditState(null); }} className="text-[0.7rem] uppercase font-bold text-[#8b949e] hover:text-white transition-colors">Cancel</button>
                        <button 
                          onClick={saveManualFishbone}
                          className="bg-[#ff6b00] text-white px-4 py-2 rounded text-[0.7rem] uppercase font-bold hover:bg-[#e66000] flex items-center gap-2"
                        >
                          <Save className="w-3.5 h-3.5" /> Save Diagram Edits
                        </button>
                      </div>
                    </div>
                 )}

                 <FishboneDiagram data={issue.deepAnalysis.fishbone} />
              </section>

              {/* Compliance Section */}
              <section className="bg-[#11141b] rounded-lg border border-[#30363d] p-6">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-[0.75rem] uppercase tracking-widest text-[#8b949e] font-bold">Compliance & Standards</h2>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => startEditing('compliance', issue.deepAnalysis?.closures.join('\n') || '')}
                        className="text-[0.65rem] font-bold uppercase tracking-widest text-[#8b949e] hover:text-[#ff6b00] flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Manual Edit
                      </button>
                      <button 
                        onClick={() => setChattingSection(chattingSection === 'compliance' ? null : 'compliance')}
                        className={`text-[0.65rem] font-bold uppercase tracking-widest flex items-center gap-1.5 ${chattingSection === 'compliance' ? 'text-[#ff6b00]' : 'text-[#8b949e] hover:text-[#ff6b00]'}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> AI Chat
                      </button>
                    </div>
                 </div>

                 {editingSection === 'compliance' && (
                    <div className="mb-6 space-y-3">
                      <textarea 
                        className="w-full bg-[#05070a] border border-[#30363d] rounded p-4 text-[0.8rem] text-[#f0f6fc] outline-none h-40 font-mono"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        placeholder="Each line will be treated as a separate violation finding..."
                      />
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setEditingSection(null)} className="text-[0.7rem] uppercase tracking-widest text-[#8b949e] hover:text-[white]">Cancel</button>
                        <button 
                          onClick={() => handleManualSave('compliance')}
                          className="bg-[#ff6b00] text-white px-4 py-2 rounded text-[0.7rem] uppercase font-bold hover:bg-[#e66000] disabled:opacity-50"
                          disabled={isProcessing}
                        >
                          Save & Polish
                        </button>
                      </div>
                    </div>
                 )}

                 {chattingSection === 'compliance' && (
                   <div className="mb-6 p-4 bg-[#05070a] border border-[#ff6b00]/30 rounded-lg">
                      <div className="flex gap-2">
                        <input 
                          className="flex-1 bg-[#11141b] border border-[#30363d] rounded px-4 py-2 text-sm outline-none focus:border-[#ff6b00]"
                          placeholder="e.g. 'Translate violations to ISO 45001 standards'"
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                        />
                        <button onClick={() => handleChatAction('compliance')} className="bg-[#ff6b00] px-4 rounded text-white disabled:opacity-50" disabled={isProcessing}>
                          {isProcessing ? <Activity className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                   </div>
                 )}

                 <div className="overflow-x-auto w-full">
                   <table className="compliance-list">
                     <thead>
                       <tr>
                         <th>Reference</th>
                         <th>Description of Violation / Closure</th>
                         <th>Impact</th>
                       </tr>
                     </thead>
                     <tbody>
                       {issue.deepAnalysis.closures?.map((closure, idx) => (
                         <tr key={idx}>
                           <td className="whitespace-nowrap font-mono text-[0.75rem]">{`STD-${idx + 1}`}</td>
                           <td className="min-w-[200px] leading-relaxed">{closure}</td>
                           <td><span className="status-pill violation uppercase">High</span></td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
              </section>

              {/* Documentation Section */}
              <section className="bg-[#0c0e14] border border-[#30363d] rounded-lg shadow-sm p-8">
                 <div className="flex justify-between items-center mb-8">
                    <h2 className="text-[0.75rem] uppercase tracking-widest text-[#8b949e] flex items-center gap-2 font-bold">
                      <FileText className="w-4 h-4 text-[#ff6b00]" /> Formal Reporting Studio
                    </h2>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => startEditing('documentation', issue.deepAnalysis?.documentation || '')}
                        className="text-[0.7rem] font-bold uppercase tracking-widest text-[#8b949e] hover:text-[#ff6b00] flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Markdown
                      </button>
                      <button 
                        onClick={() => setChattingSection(chattingSection === 'documentation' ? null : 'documentation')}
                        className={`text-[0.7rem] font-bold uppercase tracking-widest flex items-center gap-1.5 ${chattingSection === 'documentation' ? 'text-[#ff6b00]' : 'text-[#8b949e] hover:text-[#ff6b00]'}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Chat Refinement
                      </button>
                    </div>
                 </div>

                 {editingSection === 'documentation' && (
                    <div className="mb-10 space-y-4">
                      <textarea 
                        className="w-full bg-[#05070a] border border-[#30363d] rounded p-6 text-[0.85rem] text-[#f0f6fc] outline-none h-[500px] font-mono leading-relaxed"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                      />
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setEditingSection(null)} className="text-[0.75rem] uppercase tracking-widest text-[#8b949e] hover:text-white">Cancel</button>
                        <button 
                          onClick={() => handleManualSave('documentation')}
                          className="bg-[#ff6b00] text-white px-6 py-2 rounded text-[0.75rem] uppercase font-bold hover:bg-[#e66000] disabled:opacity-50 flex items-center gap-2"
                          disabled={isProcessing}
                        >
                          {isProcessing && <Activity className="w-3.5 h-3.5 animate-spin" />} Save & AI Polish
                        </button>
                      </div>
                    </div>
                 )}

                 {chattingSection === 'documentation' && (
                   <div className="mb-10 p-5 bg-[#11141b] border border-[#ff6b00]/30 rounded-lg">
                      <p className="text-[0.7rem] text-[#8b949e] mb-3 uppercase tracking-widest font-bold">What should the AI change in the report?</p>
                      <div className="flex gap-3">
                        <input 
                          className="flex-1 bg-[#05070a] border border-[#30363d] rounded px-4 py-2 text-sm outline-none focus:border-[#ff6b00]"
                          placeholder="e.g. 'Add a section on environmental impact mitigation'"
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                        />
                        <button onClick={() => handleChatAction('documentation')} className="bg-[#ff6b00] px-6 rounded text-white font-bold" disabled={isProcessing}>
                          {isProcessing ? <Activity className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                   </div>
                 )}
                 
                 <div className="markdown-body editor-preview">
                    <Markdown>{issue.deepAnalysis.documentation}</Markdown>
                 </div>
                 
                 <div className="mt-12 flex justify-end gap-4 border-t border-[#30363d] pt-8">
                    <button 
                      onClick={handleExportPDF}
                      className="px-6 py-2.5 rounded text-[0.75rem] font-bold uppercase tracking-widest border border-[#30363d] text-[#8b949e] hover:bg-[#11141b] transition-all flex items-center gap-2"
                      disabled={isProcessing}
                    >
                      <Download className="w-4 h-4" /> {isProcessing ? 'Capturing...' : 'Download PDF Report'}
                    </button>
                    <button 
                      onClick={handleExportSlides}
                      className="px-6 py-2.5 rounded text-[0.75rem] font-bold uppercase tracking-widest border border-[#ff6b00]/30 text-[#ff6b00] bg-[#ff6b00]/5 hover:bg-[#ff6b00]/10 transition-all flex items-center gap-2"
                    >
                      <Presentation className="w-4 h-4" /> Export Slides (PPTX)
                    </button>

                   <button className="px-6 py-2.5 rounded text-[0.75rem] font-bold uppercase tracking-widest bg-[#238636] text-white hover:bg-[#2eaa42] transition-all">Sign & Close Case</button>
                 </div>
              </section>
            </>
          ) : (
             <div className="flex flex-col items-center justify-center h-full min-h-[500px] border border-dashed border-[#30363d] rounded-lg bg-[#0c0e14] text-[#8b949e]">
                <Sparkles className="w-16 h-16 mb-6 opacity-20 text-[#ff6b00]" />
                <h2 className="text-[0.9rem] font-bold uppercase tracking-[0.2em] text-[#f0f6fc]">Intelligence Engine Idle</h2>
                <p className="text-xs mt-3 w-80 text-center opacity-70 leading-relaxed">Run the Deep Intelligence Scan to unlock root-cause mapping, compliance cross-referencing, and automated formal documentation.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
