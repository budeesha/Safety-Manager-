import React, { useState, useEffect, useRef } from 'react';
import { Database, Plus, Trash2, Tag, BookOpen, Warehouse, Cog, Info, Sparkles, Send, Check } from 'lucide-react';
import { PlantKnowledge, ChatMessage } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { summarizeKnowledgeChat } from '../lib/gemini';

interface KnowledgeViewProps {
  knowledge: PlantKnowledge[];
  onUpdateKnowledge: (knowledge: PlantKnowledge[]) => void;
}

const CATEGORY_QUESTIONS: Record<string, { q: string, ex: string }[]> = {
  machinery: [
    { q: "What is the machine's full name?", ex: "Hydraulic Forging Press v3" },
    { q: "Who is the manufacturer?", ex: "Schuler AG" },
    { q: "What is the model or serial number?", ex: "SP-2000-HF" },
    { q: "What year was it installed?", ex: "2018" },
    { q: "What are its primary functions in the plant?", ex: "Pre-shaping raw steel billets at 1200°C" },
    { q: "What are the common failure modes observed?", ex: "Seal degradation, piston misalignment" },
    { q: "Are there specific critical maintenance intervals?", ex: "Hydraulic fluid flush every 2000 hours" },
    { q: "What are the key safety sensors or emergency stop locations?", ex: "IR light curtains, dual-hand controller stops" },
    { q: "Does it handle hazardous materials?", ex: "High-pressure hydraulic oil (ISO VG 46)" },
    { q: "Is there any specific lockout/tagout (LOTO) requirement?", ex: "Isolation of 400V main breaker and depressurization of accumulator" }
  ],
  protocol: [
    { q: "What is the formal title of this safety protocol?", ex: "Confined Space Entry Standard (Section 4)" },
    { q: "What specific hazard or regulation does this address?", ex: "Oxygen deficiency and toxic gas buildup (H2S)" },
    { q: "When was this protocol last reviewed or updated?", ex: "January 2024" },
    { q: "Who is the governing authority or owner?", ex: "Industrial Safety Committee (Unit B)" },
    { q: "What is the first critical step in emergency activation?", ex: "Broadcast 'Code Blue' on Channel 4" },
    { q: "What specific PPE is mandatory?", ex: "N95 respirator, anti-static coveralls, SCBA monitor" },
    { q: "Are there specific reporting requirements?", ex: "Daily hot-work permit log must be signed by supervisor" },
    { q: "Who are the primary emergency contacts?", ex: "Internal Fire Crew (Ext. 555)" },
    { q: "What is the mandatory training frequency?", ex: "Refresher every 6 months for active crew" },
    { q: "Are there specific exclusion zones?", ex: "5-meter radius around pit opening" }
  ],
  facility: [
    { q: "What is the full name of the factory unit?", ex: "Southeast Logistics & Assembly Hub (Unit 2)" },
    { q: "Who is the builder of the main structure?", ex: "Turner Construction Co." },
    { q: "What kind of factory is it?", ex: "Automotive Component Stamping" },
    { q: "What is the total area and number of floors?", ex: "12,000 sq. meters, single floor open bay" },
    { q: "Can you provide a zone-by-zone breakdown?", ex: "Receiving, Press A, Press B, Quality Control, Dispatch" },
    { q: "Where are the main assembly points located?", ex: "Point Alpha: Parking Deck A, Point Beta: Main Gate" },
    { q: "Where are the fire suppression controls?", ex: "Central Monitoring Room (North Corridor)" },
    { q: "What are the critical infrastructure dependencies?", ex: "11kV Direct Feed, Cryogenic Nitrogen Tank" },
    { q: "How many active shifts operate?", ex: "3 shifts (Morning, Evening, Night)" },
    { q: "What are the different security access levels?", ex: "Category A (Visitor), Category B (Maintenance), Category C (Admin)" }
  ],
  other: [
    { q: "What is the title of this general knowledge entry?", ex: "Site-Specific PPE Color Coding" },
    { q: "What category does this best fit into?", ex: "Visual Management & Communication" },
    { q: "What are the primary details our AI should know?", ex: "Red helmets are apprentices, Blue are certified safety leads" },
    { q: "Are there any associated risks or hazards?", ex: "Misidentification of authority during emergencies" },
    { q: "Who is the primary point of contact?", ex: "HR Safety Division" }
  ]
};

export default function KnowledgeView({ knowledge, onUpdateKnowledge }: KnowledgeViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<PlantKnowledge>>({
    title: '',
    content: '',
    category: 'machinery'
  });

  // AI Assist State
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<ChatMessage[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [aiInput, setAiInput] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChatHistory, isAiMode]);

  const startAiAssist = () => {
    const questions = CATEGORY_QUESTIONS[newEntry.category || 'machinery'];
    const firstQ = questions[0];
    setAiChatHistory([{ 
      role: 'model', 
      content: `I'll help you build this entry. Let's start with some detail for the ${newEntry.category} category.\n\n**${firstQ.q}**\n*(e.g. ${firstQ.ex})*` 
    }]);
    setCurrentQuestionIndex(0);
    setIsAiMode(true);
  };

  const handleAiSend = () => {
    if (!aiInput.trim()) return;
    
    const userMsg: ChatMessage = { role: 'user', content: aiInput.trim() };
    const nextIndex = currentQuestionIndex + 1;
    const questions = CATEGORY_QUESTIONS[newEntry.category || 'machinery'];
    
    let modelMsg: ChatMessage;
    if (nextIndex < questions.length) {
      const nextQ = questions[nextIndex];
      modelMsg = { role: 'model', content: `**${nextQ.q}**\n*(e.g. ${nextQ.ex})*` };
    } else if (nextIndex === questions.length) {
      modelMsg = { role: 'model', content: "Thank you for the detailed information. Is there anything else (unusual risks, specific past issues, etc.) that you'd like to add to this knowledge entry before I generate the final summary? This extra data will also help train our future detection models." };
    } else {
      modelMsg = { role: 'model', content: "Got it. You can now hit 'Generate' to create the technical specification for this entry." };
    }

    setAiChatHistory(prev => [...prev, userMsg, modelMsg]);
    setAiInput("");
    setCurrentQuestionIndex(nextIndex);
  };

  const generateFromAi = async () => {
    setIsSummarizing(true);
    try {
      // Extract "Other Data" for training collection
      // This is data provided after the standard question set
      const questions = CATEGORY_QUESTIONS[newEntry.category || 'machinery'];
      const extraStartIndex = (questions.length * 2) + 1; // 1 model start + [user+model]*N
      const extraData = aiChatHistory.slice(extraStartIndex)
        .filter(m => m.role === 'user')
        .map(m => m.content);

      if (extraData.length > 0) {
        const savedTraining = localStorage.getItem('safety_training_data');
        const trainingList = savedTraining ? JSON.parse(savedTraining) : [];
        trainingList.push({
          category: newEntry.category,
          timestamp: Date.now(),
          data: extraData
        });
        localStorage.setItem('safety_training_data', JSON.stringify(trainingList));
      }

      const summary = await summarizeKnowledgeChat(newEntry.category || 'machinery', aiChatHistory);
      setNewEntry(prev => ({ ...prev, content: summary }));
      setIsAiMode(false);
      setAiChatHistory([]);
    } catch (e) {
      console.error(e);
      alert("Failed to generate content.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleAddEntries = () => {
    if (!newEntry.title || !newEntry.content) return;
    const entry: PlantKnowledge = {
      id: uuidv4(),
      title: newEntry.title!,
      content: newEntry.content!,
      category: (newEntry.category as any) || 'machinery'
    };
    onUpdateKnowledge([...knowledge, entry]);
    setNewEntry({ title: '', content: '', category: 'machinery' });
    setIsAdding(false);
  };

  const removeEntry = (id: string) => {
    onUpdateKnowledge(knowledge.filter(k => k.id !== id));
  };

  const getIcon = (category: string) => {
    switch (category) {
      case 'machinery': return <Cog className="w-4 h-4" />;
      case 'protocol': return <BookOpen className="w-4 h-4" />;
      case 'facility': return <Warehouse className="w-4 h-4" />;
      default: return <Tag className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-full mx-auto p-6 md:p-8 max-w-5xl">
      <div className="mb-8 border-b border-[#30363d] pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-wide">Plant Knowledge Base</h1>
          <p className="text-sm text-[#8b949e] mt-1">AI Context & Technical Specifications</p>
        </div>
        <button 
          onClick={() => {
            setIsAdding(!isAdding);
            setIsAiMode(false);
          }}
          className="bg-[#ff6b00] text-white px-4 py-2 rounded-md text-[0.75rem] font-bold uppercase flex items-center hover:bg-[#e66000] transition-colors"
        >
          {isAdding ? 'Cancel' : <><Plus className="w-4 h-4 mr-2" /> Add Data Point</>}
        </button>
      </div>

      {isAdding && (
        <div className="bg-[#11141b] border border-[#ff6b00] rounded-lg p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-[0.7rem] uppercase tracking-widest text-[#ff6b00] font-bold mb-4">Add New Context Entry</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[0.65rem] uppercase font-bold text-[#8b949e] mb-1">Title / Identification</label>
              <input 
                type="text" 
                placeholder="e.g. Turbine Block A-7"
                className="w-full bg-[#05070a] border border-[#30363d] rounded px-3 py-2 text-sm outline-none focus:border-[#ff6b00]"
                value={newEntry.title}
                onChange={e => setNewEntry({...newEntry, title: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[0.65rem] uppercase font-bold text-[#8b949e] mb-1">Category</label>
                <select 
                   className="w-full bg-[#05070a] border border-[#30363d] rounded px-3 py-2 text-sm outline-none focus:border-[#ff6b00]"
                   value={newEntry.category}
                   onChange={e => {
                     setNewEntry({...newEntry, category: e.target.value as any});
                     setIsAiMode(false);
                   }}
                >
                  <option value="machinery">Machinery</option>
                  <option value="protocol">Safety Protocol</option>
                  <option value="facility">Factory Info</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="relative">
              <label className="block text-[0.65rem] uppercase font-bold text-[#8b949e] mb-1 flex justify-between">
                <span>Detailed Content / AI Context</span>
                {!isAiMode && (
                  <button 
                    onClick={startAiAssist}
                    className="flex items-center text-[#ff6b00] hover:text-[#e66000] transition-colors text-[0.6rem] font-bold bg-[#ff6b00]/10 px-2 py-0.5 rounded border border-[#ff6b00]/30"
                  >
                    <Sparkles className="w-3 h-3 mr-1" /> AI ASSISTED GENERATION
                  </button>
                )}
              </label>

              {isAiMode ? (
                <div className="bg-[#05070a] border border-[#30363d] rounded p-4 h-[400px] flex flex-col">
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                    {aiChatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded p-3 text-sm ${
                          msg.role === 'user' 
                            ? 'bg-[#1c2128] text-[#f0f6fc] border border-[#30363d]' 
                            : 'bg-[#11141b] text-[#8b949e] border-l-2 border-[#ff6b00]'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex gap-2">
                       <input 
                        type="text"
                        value={aiInput}
                        onChange={e => setAiInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAiSend()}
                        placeholder="Type your answer..."
                        className="flex-1 bg-[#11141b] border border-[#30363d] rounded px-3 py-2 text-sm outline-none focus:border-[#ff6b00]"
                      />
                      <button 
                        onClick={handleAiSend}
                        className="bg-[#30363d] p-2 rounded hover:bg-[#ff6b00] transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    {currentQuestionIndex >= CATEGORY_QUESTIONS[newEntry.category || 'machinery'].length && (
                      <button 
                        onClick={generateFromAi}
                        disabled={isSummarizing}
                        className="w-full bg-[#ff6b00] text-white py-2 rounded text-xs font-bold uppercase tracking-widest flex items-center justify-center disabled:opacity-50"
                      >
                        {isSummarizing ? 'Analyzing & Generating...' : <><Sparkles className="w-4 h-4 mr-2" /> Generate Technical Specifications</>}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <textarea 
                  rows={6}
                  placeholder="Provide specific technical info, common failure modes, or safety steps for the AI to understand..."
                  className="w-full bg-[#05070a] border border-[#30363d] rounded px-3 py-2 text-sm outline-none focus:border-[#ff6b00] resize-none"
                  value={newEntry.content}
                  onChange={e => setNewEntry({...newEntry, content: e.target.value})}
                />
              )}
            </div>

            <button 
              onClick={handleAddEntries}
              disabled={isAiMode}
              className="w-full bg-[#ff6b00] text-white py-3 rounded text-[0.8rem] font-bold uppercase hover:bg-[#e66000] disabled:opacity-50 disabled:grayscale transition-all"
            >
              Sync to Knowledge Engine
            </button>
          </div>
        </div>
      )}

      {knowledge.length === 0 ? (
        <div className="text-center py-20 bg-[#11141b] rounded-lg border border-[#30363d]">
          <Database className="w-12 h-12 text-[#30363d] mx-auto mb-4" />
          <p className="text-[#8b949e] text-[0.75rem] font-bold uppercase tracking-wider">The knowledge core is empty.</p>
          <p className="text-xs text-[#8b949e] mt-2 max-w-xs mx-auto">Add machinery specs, floor plans, and safety protocols to help SAFE-AI provide highly accurate, plant-specific reports.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {knowledge.map((item) => (
            <div key={item.id} className="bg-[#11141b] border border-[#30363d] rounded-lg p-5 group flex flex-col hover:border-[#8b949e] transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#05070a] rounded text-[#ff6b00]">
                    {getIcon(item.category)}
                  </div>
                  <span className="text-[0.65rem] uppercase tracking-widest font-bold text-[#8b949e]">
                    {item.category === 'facility' ? 'Factory Info' : item.category}
                  </span>
                </div>
                <button 
                  onClick={() => removeEntry(item.id)}
                  className="text-[#8b949e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-[#f0f6fc] font-bold text-[0.95rem] mb-2">{item.title}</h3>
              <p className="text-[0.8rem] text-[#8b949e] leading-relaxed line-clamp-3">
                {item.content}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 p-6 bg-[#0c0e14] border border-[#30363d] rounded-lg flex items-start gap-4">
        <div className="p-2 bg-[#ff6b00]/10 rounded-full">
           <Info className="w-5 h-5 text-[#ff6b00]" />
        </div>
        <div>
          <h4 className="text-[0.75rem] font-bold uppercase tracking-widest text-[#f0f6fc] mb-1">AI Contextual Integration</h4>
          <p className="text-[0.8rem] text-[#8b949e] leading-relaxed">
            Data added here is automatically injected into the **Gemini 3 Flash** system prompt. This allows the AI to recognize specific machinery names, internal protocols, and zone identifiers during incident analysis.
          </p>
        </div>
      </div>

      {localStorage.getItem('safety_training_data') && (
        <div className="mt-8 border-t border-[#30363d] pt-8">
          <h4 className="text-[0.7rem] uppercase tracking-widest text-[#8b949e] font-bold mb-4 flex items-center">
            <Database className="w-4 h-4 mr-2" /> Collected Training Data (for Future Updates)
          </h4>
          <div className="space-y-3">
            {JSON.parse(localStorage.getItem('safety_training_data') || '[]').slice(-5).reverse().map((td: any, i: number) => (
              <div key={i} className="bg-[#05070a] border border-[#30363d] rounded p-3">
                <div className="flex justify-between text-[0.6rem] text-[#8b949e] mb-1">
                  <span className="uppercase font-bold text-[#ff6b00]">{td.category} Extra Info</span>
                  <span>{new Date(td.timestamp).toLocaleDateString()}</span>
                </div>
                <ul className="list-disc list-inside text-xs text-[#f0f6fc] opacity-80">
                  {td.data.map((str: string, si: number) => (
                    <li key={si}>{str}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[0.6rem] text-[#8b949e] mt-4 italic text-center">
            This data represents edge cases and additional context not covered by standard questions. It is being stored locally for manual review and future model fine-tuning.
          </p>
        </div>
      )}
    </div>
  );
}

