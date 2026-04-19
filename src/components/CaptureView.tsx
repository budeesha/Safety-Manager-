import React, { useState, useRef } from 'react';
import { Camera, Upload, Send, Activity, Focus, Disc } from 'lucide-react';
import { analyzeIncidentImage, chatAboutIncident } from '../lib/gemini';
import { ChatMessage, SafetyIssue } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface CaptureViewProps {
  onSaveIssue: (issue: SafetyIssue) => void;
  plantContext?: string;
}

export default function CaptureView({ onSaveIssue, plantContext }: CaptureViewProps) {
  const [image, setImage] = useState<{ base64: string; mimeType: string; dataUrl: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [initialAnalysis, setInitialAnalysis] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      setImage({ base64, mimeType: file.type, dataUrl });
      
      // Auto analyze
      setIsAnalyzing(true);
      try {
        const analysis = await analyzeIncidentImage(base64, file.type, plantContext);
        setInitialAnalysis(analysis);
        setChatHistory([{ role: 'model', content: analysis }]);
      } catch (error) {
        console.error(error);
        setInitialAnalysis("Failed to analyze image. Please try again.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !image) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput.trim() };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    setChatInput("");
    setIsChatting(true);

    try {
      const response = await chatAboutIncident(newHistory, userMessage.content, image.base64, image.mimeType, plantContext);
      setChatHistory([...newHistory, { role: 'model', content: response }]);
    } catch (error) {
      console.error(error);
      setChatHistory([...newHistory, { role: 'model', content: "Sorry, I encountered an error." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleSave = () => {
    if (!image || chatHistory.length === 0) return;
    
    // Final check for saving
    const finalStatement = chatHistory[chatHistory.length - 1].content;
    
    const issue: SafetyIssue = {
      id: uuidv4(),
      timestamp: Date.now(),
      updatedAt: Date.now(),
      image: image.dataUrl,
      initialAnalysis,
      chatHistory,
      finalStatement,
    };
    onSaveIssue(issue);
    
    // Reset
    setImage(null);
    setInitialAnalysis("");
    setChatHistory([]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-24 p-4 lg:p-8">
      {!image ? (
        <div className="bg-[#11141b] border border-[#30363d] rounded-lg p-4 lg:p-6 shadow-none">
          <div className="text-[0.75rem] uppercase tracking-widest text-[#8b949e] mb-4 flex justify-between">
            <span>Active Incident Capture</span>
            <span className="text-[#8b949e]">#992-B</span>
          </div>
          <label className="flex flex-col items-center justify-center w-full h-64 border border-dashed border-[#30363d] rounded bg-[#0c0e14] hover:bg-[#1a1f28] transition-colors cursor-pointer">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Camera className="w-10 h-10 text-[#8b949e] mb-4" />
              <p className="mb-2 text-sm text-[#f0f6fc]"><span className="font-semibold">Click to capture</span> or drag and drop</p>
              <p className="text-[0.6rem] uppercase tracking-widest text-[#8b949e] mt-2">[ FIELD PHOTO: PENDING ]</p>
            </div>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              onChange={handleImageUpload} 
            />
          </label>
        </div>
      ) : (
        <div className="bg-[#11141b] border border-[#30363d] rounded-lg p-4 lg:p-6 shadow-none flex flex-col space-y-4">
          <div className="text-[0.75rem] uppercase tracking-widest text-[#8b949e] mb-2 flex justify-between items-center">
            <span>Active Incident Capture</span>
            <span className="text-[#8b949e]">#992-B</span>
          </div>

          <div className="relative rounded overflow-hidden shadow-none border border-dashed border-[#30363d] flex items-center justify-center bg-[#1f242c]">
            <img src={image.dataUrl} alt="Safety Incident Preview" className="w-full h-auto max-h-[300px] object-contain" />
            <button 
              onClick={() => { setImage(null); setChatHistory([]); setInitialAnalysis(""); }}
              className="absolute top-4 right-4 bg-[#05070a]/80 border border-[#30363d] text-[#f0f6fc] px-4 py-1.5 rounded text-[0.7rem] uppercase tracking-wider hover:bg-[#ff6b00] hover:border-[#ff6b00] transition-colors"
            >
              Retake
            </button>
            <div className="absolute bottom-2 right-2 text-[0.6rem] text-[#8b949e] drop-shadow-md bg-black/60 px-2 py-1 rounded">Captured via Mobile Unit-04</div>
          </div>

          {isAnalyzing ? (
            <div className="w-full p-6 animate-pulse flex flex-col items-center justify-center py-12">
              <Activity className="w-8 h-8 text-[#ff6b00] animate-spin mb-4" />
              <p className="text-[0.7rem] uppercase tracking-widest text-[#8b949e]">AI Scanning for Hazards...</p>
            </div>
          ) : (
            <div className="flex flex-col h-[400px]">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pb-2 pr-2 custom-scrollbar">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className="text-[0.65rem] text-[#8b949e] uppercase mb-1">
                      {msg.role === 'user' ? 'Officer Statement' : <span className="text-[#ff6b00] font-bold">AI FIELD ANALYSIS</span>}
                    </div>
                    <div className={`text-[0.85rem] leading-relaxed p-3 rounded ${
                      msg.role === 'user' 
                        ? 'bg-[#1c2128] border border-[#30363d] text-[#f0f6fc] max-w-[90%]' 
                        : 'bg-[#05070a] border-l-2 border-[#ff6b00] text-[#f0f6fc] w-full'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="flex flex-col items-start w-full">
                    <div className="text-[0.65rem] text-[#ff6b00] font-bold uppercase mb-1">AI FIELD ANALYSIS</div>
                    <div className="bg-[#05070a] border-l-2 border-[#ff6b00] text-[#f0f6fc] p-3 rounded w-full flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b00] animate-pulse"></span>
                       <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b00] animate-pulse delay-75"></span>
                       <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b00] animate-pulse delay-150"></span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex bg-[#05070a] rounded border border-[#30363d] p-1 focus-within:border-[#ff6b00] transition-colors">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Clarify statement or provide more context..." 
                  className="flex-1 bg-transparent px-3 py-2 text-[0.85rem] outline-none text-[#f0f6fc] placeholder-[#8b949e]"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={isChatting || !chatInput.trim()}
                  className="bg-[#ff6b00] text-white rounded px-4 flex items-center justify-center disabled:opacity-50 text-[0.8rem] font-bold hover:brightness-110"
                >
                  SEND
                </button>
              </div>
            </div>
          )}

          {!isAnalyzing && chatHistory.length > 0 && (
            <button 
              onClick={handleSave}
              className="w-full mt-4 bg-[#30363d] text-white py-2 rounded text-[0.8rem] font-bold uppercase hover:bg-[#ff6b00] transition-colors"
            >
              Submit Official Report
            </button>
          )}
        </div>
      )}
    </div>
  );
}
