/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Mic, 
  Square, 
  Send, 
  RefreshCw, 
  Copy, 
  Check, 
  Volume2,
  MessageSquare,
  Sparkles,
  History,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface MessageHistory {
  id: string;
  text: string;
  timestamp: Date;
}

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [history, setHistory] = useState<MessageHistory[]>([]);
  const [copied, setCopied] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('vox_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory).map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp)
        })));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('vox_history', JSON.stringify(history));
  }, [history]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Please allow microphone access to use this app.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const model = "gemini-2.5-flash-native-audio-preview-12-2025";
        const response = await genAI.models.generateContent({
          model: model,
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/webm",
                    data: base64Data
                  }
                },
                {
                  text: "Please transcribe this audio accurately. If it's a message, format it clearly. If there are instructions, follow them. Return only the transcribed text."
                }
              ]
            }
          ]
        });

        const text = response.text || "Could not transcribe audio.";
        setTranscript(text);
        
        if (text && text !== "Could not transcribe audio.") {
          const newEntry = {
            id: Date.now().toString(),
            text,
            timestamp: new Date()
          };
          setHistory(prev => [newEntry, ...prev].slice(0, 10));
        }
        setIsProcessing(false);
      };
    } catch (error) {
      console.error("Error processing audio:", error);
      setTranscript("Error processing audio. Please try again.");
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const clearHistory = () => {
    if (confirm("Clear all history?")) {
      setHistory([]);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E4E4E7] font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Volume2 className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">VoxConvert</h1>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Voice to Message Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={clearHistory}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white/80"
              title="Clear History"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Recording & Current Result */}
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-[#151619] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              {/* Decorative background element */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/10 blur-[100px] rounded-full" />
              
              <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">Start Recording</h2>
                  <p className="text-white/40 text-sm">Speak clearly to convert your voice to text</p>
                </div>

                {/* Recording Button Area */}
                <div className="relative flex items-center justify-center">
                  <AnimatePresence>
                    {isRecording && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl"
                      />
                    )}
                  </AnimatePresence>
                  
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessing}
                    className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-orange-500 hover:bg-orange-600'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                  >
                    {isRecording ? (
                      <Square className="w-8 h-8 text-white fill-current" />
                    ) : (
                      <Mic className="w-10 h-10 text-black" />
                    )}
                  </button>

                  {isRecording && (
                    <div className="absolute -bottom-12 font-mono text-orange-500 font-bold tracking-tighter text-xl">
                      {formatTime(recordingTime)}
                    </div>
                  )}
                </div>

                {/* Status Indicator */}
                <div className="h-6 flex items-center justify-center">
                  {isProcessing ? (
                    <div className="flex items-center gap-2 text-orange-500/80 text-sm font-medium">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      AI is processing your voice...
                    </div>
                  ) : isRecording ? (
                    <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Recording in progress
                    </div>
                  ) : (
                    <div className="text-white/20 text-xs uppercase tracking-widest font-mono">
                      System Ready
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Result Area */}
            <AnimatePresence mode="wait">
              {transcript && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-[#151619] border border-white/5 rounded-3xl p-8 shadow-xl space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-500">
                      <Sparkles size={18} />
                      <span className="text-xs font-bold uppercase tracking-widest">Converted Message</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={copyToClipboard}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/40 rounded-2xl p-6 min-h-[120px] border border-white/5">
                    <p className="text-lg leading-relaxed text-white/90 whitespace-pre-wrap">
                      {transcript}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                      onClick={() => setTranscript('')}
                    >
                      Clear
                    </button>
                    <button 
                      className="flex-[2] bg-orange-500 hover:bg-orange-600 text-black py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                      onClick={copyToClipboard}
                    >
                      <Send size={18} />
                      Copy & Send
                    </button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: History */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-2 px-2">
              <History size={18} className="text-white/40" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Recent Conversions</h3>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {history.length === 0 ? (
                <div className="bg-[#151619]/50 border border-dashed border-white/10 rounded-2xl p-12 text-center">
                  <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-3" />
                  <p className="text-white/20 text-sm">No recent messages</p>
                </div>
              ) : (
                history.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group bg-[#151619] border border-white/5 p-5 rounded-2xl hover:border-orange-500/30 transition-all cursor-pointer"
                    onClick={() => setTranscript(item.text)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-mono text-white/30">
                        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistory(prev => prev.filter(h => h.id !== item.id));
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-sm text-white/70 line-clamp-3 leading-relaxed">
                      {item.text}
                    </p>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
