/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Briefcase, 
  Search, 
  Database,
  Loader2,
  Sparkles,
  CheckCircle2,
  Activity,
  MoreHorizontal,
  ListTodo,
  Plus,
  Trash2,
  Circle,
  Mail,
  Zap,
  BookMarked,
  Calendar,
  LayoutDashboard
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { sendMessageToAgentStream, ChatMessage, ToolCall, MOCK_DB, AgentStep } from '@/services/gemini';

// --- Components ---

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Daily Dashboard', icon: LayoutDashboard },
    { id: 'chat', label: 'AI Assistant', icon: Bot },
    { id: 'email', label: 'Email Hub', icon: Mail },
    { id: 'tasks', label: 'Tasks & Reminders', icon: ListTodo },
    { id: 'automations', label: 'Automations', icon: Zap },
    { id: 'memory', label: 'Notes & Memory', icon: BookMarked },
  ];

  return (
    <div className="hidden md:flex w-[280px] flex-col h-screen pt-8 pb-6 pl-8 pr-4">
      <div className="mb-10 px-6 flex items-center">
        <button onClick={() => window.location.reload()} className="text-2xl font-bold text-black tracking-tight text-left hover:opacity-70 transition-opacity">
          Saints Assistant
        </button>
      </div>
      
      <nav className="flex-1 space-y-1.5 pr-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-full text-[14px] font-medium transition-all",
              activeTab === item.id 
                ? "bg-black text-white shadow-sm" 
                : "text-zinc-500 hover:bg-black/[0.04] hover:text-black"
            )}
          >
            <item.icon size={16} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

const AgentStepBlock = ({ step }: { step: AgentStep }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-3xl transition-all",
        step.status === 'streaming' ? "bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-black/5" : "bg-zinc-50 border border-black/[0.02]"
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-white shadow-sm border border-black/5 text-zinc-500"
        )}>
          {step.type === 'tool' ? <Database size={12} /> : <Bot size={12} />}
        </div>
        <span className="font-semibold text-[13px] text-zinc-800 truncate">
          {step.type === 'tool' ? `Tool Call: ${step.toolName}` : 'Thinking'}
        </span>
        {step.status === 'streaming' && <Loader2 size={12} className="animate-spin text-zinc-400 ml-auto shrink-0" />}
        {step.status === 'completed' && (
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {step.latencyMs !== undefined && (
              <span className="text-[10px] text-zinc-500 font-medium">
                {(step.latencyMs / 1000).toFixed(2)}s
              </span>
            )}
            <div className="text-emerald-500">
              <CheckCircle2 size={14} />
            </div>
          </div>
        )}
      </div>
      
      {step.type === 'tool' && step.toolArgs && (
        <pre className="text-[10px] bg-white text-zinc-500 p-3 rounded-2xl overflow-x-auto mt-3 font-mono whitespace-pre-wrap border border-black/[0.04]">
          {JSON.stringify(step.toolArgs, null, 2)}
        </pre>
      )}
      
      {step.type === 'text' && step.content && (
        <div className="text-[13px] text-zinc-500 mt-2 line-clamp-2 leading-relaxed">"{step.content}"</div>
      )}

      {step.result && (
        <div className="mt-4 pt-3 border-t border-black/[0.04] flex flex-col gap-1 text-[11px]">
          <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[9px]">Result</span> 
          <span className="text-zinc-700 truncate font-medium">{step.result.message || 'Success'}</span>
        </div>
      )}
    </motion.div>
  );
};

const ChatInterface = ({ 
  history, 
  onSendMessage, 
  isProcessing,
  currentTool,
  agentSteps,
  streamingText,
  setActiveTab
}: { 
  history: ChatMessage[], 
  onSendMessage: (msg: string) => void,
  isProcessing: boolean,
  currentTool: ToolCall | null,
  agentSteps: AgentStep[],
  streamingText: string,
  setActiveTab: (tab: string) => void
}) => {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isProcessing, currentTool, streamingText]);

  useEffect(() => {
    if (leftScrollRef.current) {
      leftScrollRef.current.scrollTop = leftScrollRef.current.scrollHeight;
    }
  }, [agentSteps]);

  const isGeneratingReport = agentSteps.some(s => s.type === 'tool' && s.toolName === 'generate_yearly_report');
  const isGeneratingDashboard = agentSteps.some(s => s.type === 'tool' && s.toolName === 'create_operations_dashboard');
  const isGeneratingWidget = isGeneratingReport || isGeneratingDashboard;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col md:flex-row-reverse h-auto md:h-full w-full gap-4 md:gap-6">
      {/* Right side: Process & Agent Steps */}
      <div className="min-h-[300px] flex-1 md:min-h-0 md:flex-initial w-full md:w-[60%] flex flex-col rounded-[32px] bg-white border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden relative">
        <header className="h-[60px] md:h-[72px] flex items-center px-4 md:px-8 bg-white shrink-0 border-b border-black/[0.04]">
          <h2 className="font-semibold text-zinc-900 text-[15px] flex items-center gap-3">
            {isProcessing ? (
              <Loader2 className="text-zinc-400 animate-spin" size={16} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center border border-black/5">
                <Activity className="text-zinc-600" size={14} />
              </div>
            )}
            Execution Trace
          </h2>
        </header>
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-4 md:pb-8 pt-4 md:pt-6 space-y-4" ref={leftScrollRef}>
          {agentSteps.length === 0 && !isProcessing && (
             <div className="text-zinc-400 text-sm font-medium mt-10 text-center">Start a task to see agent steps here.</div>
          )}
          {agentSteps.map((step) => (
            <AgentStepBlock key={step.id} step={step} />
          ))}
        </div>
      </div>

      {/* Left side: Chat */}
      <div className="min-h-[450px] flex-1 md:min-h-0 md:flex-initial w-full md:w-[40%] flex flex-col rounded-[32px] bg-white border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden relative">
        {/* Header */}
        <header className="h-[60px] md:h-[72px] flex items-center px-4 md:px-8 justify-between shrink-0 border-b border-black/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center border border-black/5">
              <Bot className="text-zinc-600" size={14} />
            </div>
            <h2 className="font-semibold text-zinc-900 text-[15px]">Virtual Assistant</h2>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-8 space-y-6" ref={scrollRef}>
          {history.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-6">
              <div className="w-16 h-16 bg-white shadow-sm border border-black/5 rounded-full flex items-center justify-center">
                <Bot size={32} className="text-zinc-300" />
              </div>
              <p className="font-medium text-zinc-500">How can I help you today?</p>
              <div className="flex flex-wrap justify-center gap-3 w-full max-w-md">
                <button onClick={() => onSendMessage("Add a task to check Q3 metrics")} className="px-5 py-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[13px]">
                Add a task to check Q3 metrics
                </button>
                <button onClick={() => onSendMessage("Create a new dashboard")} className="px-5 py-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[13px]">
                Create a new dashboard
                </button>
                <button onClick={() => onSendMessage("Generate a summary report")} className="px-5 py-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[13px]">
                Generate a summary report
                </button>
              </div>
            </div>
          )}

          {history.map((msg, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={idx} 
              className={cn(
                "flex gap-4 max-w-full",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-auto mb-1",
                msg.role === 'user' ? "bg-black text-white" : "bg-white border border-black/5 text-zinc-900 shadow-sm"
              )}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              
              <div className={cn(
                "rounded-3xl text-[14px] leading-relaxed max-w-[85%] font-medium",
                msg.role === 'user' 
                  ? "p-5 bg-black text-white rounded-br-[8px]" 
                  : msg.hasReport || msg.hasDashboard 
                    ? "p-0" 
                    : "p-5 bg-white rounded-bl-[8px] text-zinc-800 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
              )}>
                {msg.role === 'model' && (msg.hasReport || msg.hasDashboard) ? (
                  <div className="flex flex-col gap-3 min-w-[200px]">
                    <div className="p-4 bg-white border border-black/5 rounded-3xl rounded-bl-[8px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col gap-3">
                      <span className="font-medium text-[14px] text-zinc-800">
                        {msg.hasReport && msg.hasDashboard ? 'Report & Dashboard ready' : msg.hasReport ? 'Report now ready' : 'Dashboard now ready'}
                      </span>
                      {msg.latencyMs && (
                        <div className="text-emerald-600 flex items-center gap-1.5 text-[11px] font-medium">
                          <Activity size={12} className="text-emerald-500" /> Latency {(msg.latencyMs / 1000).toFixed(2)}s
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {msg.hasReport && (
                        <button 
                          onClick={() => setActiveTab('reports')}
                          className="bg-black text-white px-6 py-3 rounded-full font-medium w-max hover:bg-zinc-800 transition-colors text-[13px] shadow-sm flex items-center gap-2"
                        >
                          go to reports &rarr;
                        </button>
                      )}
                      {msg.hasDashboard && (
                        <button 
                          onClick={() => setActiveTab('dashboards')}
                          className="bg-black text-white px-6 py-3 rounded-full font-medium w-max hover:bg-zinc-800 transition-colors text-[13px] shadow-sm flex items-center gap-2"
                        >
                          go to dashboards &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={cn("markdown-body", msg.role === 'user' ? "text-white" : "text-zinc-800")}>
                      <ReactMarkdown>{msg.parts?.map((p: any) => p.text || "").join("") || ""}</ReactMarkdown>
                    </div>

                    {msg.role === 'model' && msg.latencyMs !== undefined && (
                      <div className="mt-4 pt-4 border-t border-black/[0.04] flex items-center justify-end text-emerald-600 text-[11px]">
                        <span className="font-mono bg-emerald-50/50 text-emerald-600 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                          <CheckCircle2 size={12} />
                          {(msg.latencyMs / 1000).toFixed(2)}s
                        </span>
                      </div>
                    )}
                  </>
                )}
                
                {/* Grounding Sources */}
                {msg.groundingMetadata?.groundingChunks && (
                  <div className="mt-4 pt-4 border-t border-black/[0.04]">
                    <p className="text-[10px] font-semibold text-zinc-400 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                      <Search size={12} /> Sources
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => (
                        <a 
                          key={i} 
                          href={chunk.web?.uri} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[11px] px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 rounded-full text-zinc-500 border border-black/5 transition-colors"
                        >
                          {chunk.web?.title || new URL(chunk.web?.uri).hostname}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          
          {isProcessing && streamingText && !isGeneratingWidget && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 max-w-full"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-auto mb-1 bg-white border border-black/5 text-zinc-900 shadow-sm">
                <Bot size={14} />
              </div>
              <div className="p-5 rounded-3xl text-[14px] leading-relaxed max-w-[85%] font-medium bg-white rounded-bl-[8px] border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] text-zinc-800 opacity-70">
                <div className="markdown-body text-zinc-800">
                  <ReactMarkdown>{streamingText}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          )}

          {isProcessing && !streamingText && !isGeneratingWidget && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-white border border-black/5 text-zinc-900 shadow-sm flex items-center justify-center mt-auto mb-1">
                <Bot size={14} />
              </div>
              <div className="bg-white px-5 py-4 rounded-3xl rounded-bl-[8px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-black/[0.04] flex items-center gap-2">
                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {isProcessing && isGeneratingWidget && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 max-w-full"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-auto mb-1 bg-white border border-black/5 text-zinc-900 shadow-sm">
                <Bot size={14} />
              </div>
              <div className="flex flex-col gap-3 min-w-[200px]">
                <div className="p-4 bg-white border border-black/5 rounded-3xl rounded-bl-[8px] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col gap-3">
                  <span className="font-medium text-[14px] text-zinc-800">
                    {isGeneratingReport && isGeneratingDashboard ? 'Finalizing Report & Dashboard...' : isGeneratingReport ? 'Report now ready' : 'Dashboard now ready'}
                  </span>
                  <div className="text-zinc-400 flex items-center gap-1.5 text-[11px] font-medium">
                    <Loader2 size={12} className="animate-spin" /> Finalizing...
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {isGeneratingReport && (
                    <button 
                      disabled
                      className="bg-black/50 text-white px-6 py-3 rounded-full font-medium w-max text-[13px] shadow-sm flex items-center gap-2 cursor-not-allowed"
                    >
                      go to reports &rarr;
                    </button>
                  )}
                  {isGeneratingDashboard && (
                    <button 
                      disabled
                      className="bg-black/50 text-white px-6 py-3 rounded-full font-medium w-max text-[13px] shadow-sm flex items-center gap-2 cursor-not-allowed"
                    >
                      go to dashboards &rarr;
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 shrink-0 bg-white">
          <form onSubmit={handleSubmit} className="relative flex items-center bg-zinc-50 rounded-full border border-black/5 p-2 focus-within:ring-2 focus-within:ring-black/5 focus-within:border-black/10 transition-all">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Write a message..."
              disabled={isProcessing}
              className="flex-1 bg-transparent px-5 py-2 outline-none placeholder:text-zinc-400 text-zinc-900 text-[14px] font-medium"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center disabled:opacity-50 transition-colors ml-2 hover:bg-zinc-800"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white relative right-0.5 top-0.5" strokeWidth={2} />}
            </button>
          </form>

          {history.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4 w-full">
              <button onClick={() => onSendMessage("Add a task to check Q3 metrics")} className="px-4 py-2 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[12px]">
              Add a task to check Q3 metrics
              </button>
              <button onClick={() => onSendMessage("Create a new dashboard")} className="px-4 py-2 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[12px]">
                Create a new dashboard
              </button>
              <button onClick={() => onSendMessage("Generate a summary report")} className="px-4 py-2 bg-zinc-50 hover:bg-zinc-100 rounded-full transition-all border border-black/5 text-zinc-600 font-medium text-[12px]">
              Generate a summary report 
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TodoView = ({ onAction }: { onAction: (msg?: string) => void }) => {
  const [todos, setTodos] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [newTodo, setNewTodo] = useState('');

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setTodos([...todos, { id: Math.random().toString(), text: newTodo.trim(), completed: false }]);
    setNewTodo('');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-end mb-8 pl-2">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Todo List</h2>
            <p className="text-zinc-500 mt-1 text-[15px] font-medium">Manage and monitor your tasks.</p>
          </div>
        </div>
        
        <form onSubmit={handleAddTodo} className="flex gap-2 mb-8">
          <input 
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 px-5 py-3 rounded-2xl border border-black/10 text-zinc-900 font-medium placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black/5"
          />
          <button type="submit" className="px-5 bg-black text-white rounded-2xl hover:bg-zinc-800 transition-colors flex items-center justify-center font-medium gap-2">
            <Plus size={18} />
            Add
          </button>
        </form>

        <div className="grid gap-3">
          {todos.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-black/[0.04]">
              <p className="text-zinc-400 font-medium">No tasks found. Add a task above.</p>
            </div>
          ) : (
            todos.map((todo) => (
              <div key={todo.id} className="bg-white p-4 rounded-2xl border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex justify-between items-center transition-all hover:border-black/10">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => toggleTodo(todo.id)}>
                  {todo.completed ? (
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  ) : (
                    <Circle size={24} className="text-zinc-300" />
                  )}
                  <span className={cn("text-[15px] font-medium", todo.completed ? "text-zinc-400 line-through" : "text-zinc-800")}>
                    {todo.text}
                  </span>
                </div>
                <button onClick={() => deleteTodo(todo.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const DailyDashboardView = ({ onAction, isConnected, onConnect }: { onAction: (msg?: string) => void, isConnected: boolean, onConnect: () => void }) => {
  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-end mb-8 pl-2">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Daily Dashboard</h2>
            <p className="text-zinc-500 mt-1 text-[15px] font-medium">Your hub for priorities, emails, and calendar.</p>
          </div>
        </div>
        
        {/* Top Priorities & Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-[32px] border border-black/[0.04] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <h3 className="font-semibold text-[17px] mb-6 flex items-center gap-2"><Sparkles className="text-yellow-500" size={20} /> Top Priorities (AI Generated)</h3>
            <div className="space-y-3">
              <div className="p-5 bg-zinc-50 rounded-3xl border border-black/5 flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-black/5 shadow-sm text-lg font-bold">1</div>
                <div>
                  <h4 className="font-semibold text-zinc-900 text-[15px]">Follow up with Acme Corp</h4>
                  <p className="text-[13px] text-zinc-500 mt-0.5">Due today. They haven't responded to the proposal.</p>
                </div>
              </div>
              <div className="p-5 bg-zinc-50 rounded-3xl border border-black/5 flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-black/5 shadow-sm text-lg font-bold">2</div>
                <div>
                  <h4 className="font-semibold text-zinc-900 text-[15px]">Review Q3 Marketing Invoice</h4>
                  <p className="text-[13px] text-zinc-500 mt-0.5">Urgent email tagged as <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase">Money</span></p>
                </div>
              </div>
              <div className="p-5 bg-zinc-50 rounded-3xl border border-black/5 flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-black/5 shadow-sm text-lg font-bold">3</div>
                <div>
                  <h4 className="font-semibold text-zinc-900 text-[15px]">Prepare for Sync Meeting</h4>
                  <p className="text-[13px] text-zinc-500 mt-0.5">Meeting starts in 45 minutes.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-[32px] border border-black/[0.04] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col">
            <h3 className="font-semibold text-[17px] mb-6 flex items-center gap-2"><Calendar className="text-blue-500" size={20} /> Calendar Event</h3>
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 border border-dashed border-black/10 rounded-[24px] bg-zinc-50/50">
              <Calendar size={32} className={cn("mb-4", isConnected ? "text-blue-500" : "text-zinc-300")} />
              <p className="text-[14px] font-medium text-zinc-600 mb-6">
                {isConnected ? "No upcoming events today." : "Connect Google Calendar to see today's events."}
              </p>
              {!isConnected && (
                <button onClick={onConnect} className="px-5 py-2.5 bg-black text-white text-[13px] font-semibold rounded-full hover:bg-zinc-800 transition-colors">
                  Connect Calendar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Urgent Emails & Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-[32px] border border-black/[0.04] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <h3 className="font-semibold text-[17px] mb-6 flex items-center gap-2"><Mail className="text-red-500" size={20} /> Urgent Emails</h3>
            <div className="space-y-4">
               <div className="text-center py-10">
                 <Mail size={24} className={cn("mx-auto mb-3", isConnected ? "text-red-500" : "text-zinc-300")} />
                 <p className="text-[14px] text-zinc-400 font-medium pb-6">
                   {isConnected ? "You're all caught up! No urgent emails." : "Connect Gmail to sync urgent messages."}
                 </p>
                 {!isConnected && (
                   <button onClick={onConnect} className="px-5 py-2.5 bg-black text-white text-[13px] font-semibold rounded-full hover:bg-zinc-800 transition-colors">Connect Gmail</button>
                 )}
               </div>
            </div>
          </div>
          
          <div className="bg-white rounded-[32px] border border-black/[0.04] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <h3 className="font-semibold text-[17px] mb-6 flex items-center gap-2"><Zap className="text-purple-500" size={20} /> Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => onAction("Summarize my emails")} className="p-5 bg-zinc-50 rounded-3xl border border-black/5 hover:border-black/10 hover:shadow-sm transition-all text-left flex flex-col items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center border border-black/5"><Bot size={18} className="text-zinc-600" /></div>
                <span className="text-[14px] font-semibold text-zinc-900 leading-tight">Summarize Emails</span>
              </button>
              <button onClick={() => onAction("Generate follow-ups")} className="p-5 bg-zinc-50 rounded-3xl border border-black/5 hover:border-black/10 hover:shadow-sm transition-all text-left flex flex-col items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center border border-black/5"><ListTodo size={18} className="text-zinc-600" /></div>
                <span className="text-[14px] font-semibold text-zinc-900 leading-tight">Follow-ups Due</span>
              </button>
              <button onClick={() => onAction("Create email rule")} className="p-5 bg-zinc-50 rounded-3xl border border-black/5 hover:border-black/10 hover:shadow-sm transition-all text-left flex flex-col items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center border border-black/5"><Zap size={18} className="text-zinc-600" /></div>
                <span className="text-[14px] font-semibold text-zinc-900 leading-tight">New Automation</span>
              </button>
              <button onClick={() => onAction("Search my client notes")} className="p-5 bg-zinc-50 rounded-3xl border border-black/5 hover:border-black/10 hover:shadow-sm transition-all text-left flex flex-col items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center border border-black/5"><BookMarked size={18} className="text-zinc-600" /></div>
                <span className="text-[14px] font-semibold text-zinc-900 leading-tight">Search Memory</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

const EmailHubView = ({ onAction, isConnected, onConnect }: { onAction: (msg?: string) => void, isConnected: boolean, onConnect: () => void }) => {
  const [emails, setEmails] = useState<any[]>([]);
  const [analysisData, setAnalysisData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  const [draftingFor, setDraftingFor] = useState<string | null>(null);
  const [draftTone, setDraftTone] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isConnected) {
      fetchEmails();
    }
  }, [isConnected]);

  const fetchEmails = async () => {
     setIsLoading(true);
     try {
        const res = await fetch('/api/emails');
        if(res.ok) {
          const data = await res.json();
          setEmails(data.emails || []);
          if (data.emails && data.emails.length > 0) {
             analyzeEmails(data.emails);
          }
        }
     } catch(e) {
        console.error(e);
     }
     setIsLoading(false);
  };

  const analyzeEmails = async (emailsToAnalyze: any[]) => {
     setIsAnalyzing(true);
     try {
        const minifiedEmails = emailsToAnalyze.map(e => ({ id: e.id, from: e.from, subject: e.subject, snippet: e.snippet }));
        const res = await fetch('/api/emails/analyze', {
           method: 'POST',
           headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({ emails: minifiedEmails })
        });
        if(res.ok) {
          const data = await res.json();
          if (data.analysis) {
             setAnalysisData(data.analysis);
          }
        }
     } catch(e) {
        console.error(e);
     }
     setIsAnalyzing(false);
  };

  const handleDraft = async (email: any, tone: string) => {
    setDraftingFor(email.id);
    setDraftTone(tone);
    setDraftText("");
    setIsDrafting(true);
    setExpandedEmail(email.id);

    try {
      const res = await fetch('/api/emails/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailSubject: email.subject, emailBody: email.body || email.snippet, tone })
      });
      if (res.ok) {
        const data = await res.json();
        setDraftText(data.draft);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to draft email.");
    }
    setIsDrafting(false);
  };

  const handleSend = async (email: any) => {
    setIsSending(true);
    try {
      const toMatch = email.from.match(/<(.*?)>/) || [null, email.from];
      const to = toMatch[1].trim();
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: draftText, 
          to, 
          subject: email.subject, 
          threadId: email.threadId || email.id
        })
      });
      if (res.ok) {
         setDraftingFor(null);
         setDraftTone(null);
         setDraftText("");
         alert("Reply sent successfully via Gmail!");
      } else {
         alert("Failed to send email. Check API key and tokens.");
      }
    } catch(e) {
      console.error(e);
      alert("Failed to send email.");
    }
    setIsSending(false);
  };

  if (!isConnected) {
    return (
      <div className="p-4 md:p-8 h-full flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-white shadow-sm border border-black/5 rounded-[24px] flex items-center justify-center mb-6">
          <Mail size={36} className="text-blue-500" />
        </div>
        <h2 className="text-3xl font-bold text-zinc-900 tracking-tight mb-3">Smart Email Hub</h2>
        <p className="text-zinc-500 font-medium max-w-md mx-auto mb-10 text-[15px] leading-relaxed">
          Google API integration required. Connect to auto-categorize emails (Money, Financial, Important), detect paychecks, sum threads, and draft replies instantly.
        </p>
        <button onClick={onConnect} className="px-8 py-4 bg-black text-white font-semibold rounded-full hover:bg-zinc-800 transition-colors flex items-center gap-3">
          <Mail size={20} /> Connect Gmail
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto w-full">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-3 mb-1">
              Inbox Intelligence {isAnalyzing && <Loader2 size={18} className="animate-spin text-zinc-400 mt-1" />}
            </h2>
            <p className="text-zinc-500 text-[15px] font-medium">
              {isAnalyzing ? "AI is processing your inbox in the background..." : "Inbox categorized and summarized."}
            </p>
          </div>
          <button className="px-4 py-2 bg-zinc-100 text-zinc-600 font-semibold text-[13px] rounded-full flex items-center gap-2 hover:bg-zinc-200" onClick={fetchEmails}>
            {isLoading ? <Loader2 size={16} className="animate-spin"/> : "Refresh"}
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-black/[0.04]">
            <Loader2 size={32} className="animate-spin text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-400 font-medium">Fetching secure metadata...</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {emails.map(email => {
              const analysis = analysisData[email.id];
              return (
                <div key={email.id} className="bg-white p-6 rounded-3xl border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1 w-full overflow-hidden">
                      <div 
                        className="flex justify-between items-start mb-2 cursor-pointer group" 
                        onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                      >
                        <h4 className="font-semibold text-[15px] text-zinc-900 truncate max-w-[70%] group-hover:text-blue-600 transition-colors">{email.from.replace(/<.*>/, '').trim()}</h4>
                        {analysis ? (
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase",
                            analysis.categoryId === 'Income' || analysis.categoryId === 'Financial' ? "bg-emerald-100 text-emerald-800" :
                            analysis.categoryId === 'Important' ? "bg-amber-100 text-amber-800" :
                            "bg-zinc-100 text-zinc-600"
                          )}>
                            {analysis.categoryId || 'General'}
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-blue-50 text-blue-500 rounded-full text-[11px] font-semibold flex items-center gap-1.5">
                            <Loader2 size={12} className="animate-spin" /> Processing
                          </span>
                        )}
                      </div>
                      <p 
                        className="text-zinc-900 font-semibold text-[16px] mb-2 leading-tight cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                      >
                        {email.subject}
                      </p>
                      
                      {expandedEmail === email.id ? (
                        <div className="text-zinc-700 font-medium text-[14px] leading-relaxed mb-4 p-4 bg-zinc-50 border border-black/5 rounded-2xl whitespace-pre-wrap">
                          {email.body ? email.body : email.snippet.replace(/&#39;/g, "'").replace(/&quot;/g, '"')}
                        </div>
                      ) : (
                        <p className="text-zinc-600 font-medium text-[14px] leading-relaxed mb-4">
                          {analysis?.summary || email.snippet.replace(/&#39;/g, "'").replace(/&quot;/g, '"')}
                        </p>
                      )}

                      {analysis?.isPaycheck && (
                        <div className="mb-4 p-4 bg-emerald-50/80 border border-emerald-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                              <Sparkles size={18} className="text-emerald-600" />
                            </div>
                            <div className="text-left">
                              <span className="text-emerald-900 font-semibold text-[14px] block">Paycheck Detected</span>
                              <span className="text-emerald-700 text-[13px] font-medium block">Estimated: <strong className="text-emerald-800">{analysis.expectedAmount || 'Unknown amount'}</strong>. Add this to your income logs?</span>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button className="px-4 py-2 bg-emerald-500 text-white font-semibold text-[13px] rounded-xl hover:bg-emerald-600 transition-colors shadow-sm">Confirm</button>
                            <button className="px-4 py-2 bg-white text-emerald-700 font-semibold text-[13px] rounded-xl hover:bg-emerald-50 border border-emerald-200 transition-colors shadow-sm">Edit</button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-black/5">
                        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mr-2">Draft AI Reply</span>
                        <button onClick={() => handleDraft(email, 'Professional')} disabled={isDrafting && draftingFor === email.id} className="px-4 py-2 bg-zinc-50 border border-zinc-200 text-zinc-600 text-[12px] font-semibold rounded-full hover:bg-zinc-100 hover:text-black transition-colors disabled:opacity-50">Professional</button>
                        <button onClick={() => handleDraft(email, 'Casual')} disabled={isDrafting && draftingFor === email.id} className="px-4 py-2 bg-zinc-50 border border-zinc-200 text-zinc-600 text-[12px] font-semibold rounded-full hover:bg-zinc-100 hover:text-black transition-colors disabled:opacity-50">Casual</button>
                        <button onClick={() => handleDraft(email, 'Direct/Sales')} disabled={isDrafting && draftingFor === email.id} className="px-4 py-2 bg-zinc-50 border border-zinc-200 text-zinc-600 text-[12px] font-semibold rounded-full hover:bg-zinc-100 hover:text-black transition-colors disabled:opacity-50">Direct / Sales</button>
                        {isDrafting && draftingFor === email.id && <Loader2 className="animate-spin text-zinc-400 ml-2" size={16} />}
                      </div>

                      {draftingFor === email.id && (draftText || isDrafting) && (
                        <div className="mt-4 p-4 border border-blue-100 bg-blue-50/30 rounded-2xl animate-in fade-in slide-in-from-top-2">
                          <h5 className="text-[12px] font-semibold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                            {isDrafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                            {isDrafting ? "Drafting Response..." : `AI Draft (${draftTone})`}
                          </h5>
                          {!isDrafting && (
                            <>
                              <textarea 
                                value={draftText}
                                onChange={(e) => setDraftText(e.target.value)}
                                className="w-full h-32 p-3 bg-white border border-black/10 rounded-xl text-[14px] text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-3"
                              />
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => handleSend(email)}
                                  disabled={isSending || !draftText.trim()}
                                  className="px-5 py-2.5 bg-blue-600 text-white font-semibold text-[13px] rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                  Send Reply
                                </button>
                                <button 
                                  onClick={() => setDraftingFor(null)}
                                  className="px-4 py-2.5 bg-white border border-zinc-200 text-zinc-600 font-semibold text-[13px] rounded-xl hover:bg-zinc-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const AutomationsView = ({ onAction }: { onAction: (msg?: string) => void }) => {
  return (
    <div className="p-4 md:p-8 h-full flex flex-col items-center flex-1 max-w-2xl mx-auto py-12 text-center overflow-y-auto">
      <div className="w-20 h-20 bg-white shadow-sm border border-black/5 rounded-[24px] flex items-center justify-center mb-6 shrink-0">
        <Zap size={36} className="text-purple-500" />
      </div>
      <h2 className="text-3xl font-bold text-zinc-900 tracking-tight mb-3">Automation System</h2>
      <p className="text-zinc-500 font-medium max-w-md mx-auto mb-10 text-[15px] leading-relaxed">
        Set up rule-based triggers like "If invoice, tag as money" or "If new lead, notify and suggest reply." 
      </p>
      <div className="w-full text-left bg-white p-6 rounded-[32px] border border-black/[0.04] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div><span className="text-[15px] font-bold text-zinc-800">Rule: Auto-tag Invoice</span></div>
          <div className="w-12 h-7 bg-emerald-500 rounded-full relative"><div className="w-5 h-5 bg-white rounded-full absolute right-1 top-1"></div></div>
        </div>
        <p className="text-[13px] text-zinc-500 font-medium leading-relaxed">When an email contains "invoice", automatically tag it with <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider mx-1">Money</span>.</p>
        <button onClick={() => onAction("Create a new automation rule")} className="w-full py-4 mt-2 bg-zinc-50 border-2 border-dashed border-zinc-200 text-[14px] font-semibold text-zinc-500 rounded-2xl hover:border-black/20 hover:text-black hover:bg-zinc-100 transition-colors">
          + Ask Agent to Create Rule
        </button>
      </div>
    </div>
  );
};

const NotesMemoryView = ({ onAction }: { onAction: (msg?: string) => void }) => {
  return (
    <div className="p-4 md:p-8 h-full flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 bg-white shadow-sm border border-black/5 rounded-[24px] flex items-center justify-center mb-6">
        <BookMarked size={36} className="text-amber-500" />
      </div>
      <h2 className="text-3xl font-bold text-zinc-900 tracking-tight mb-3">Notes & Memory Database</h2>
      <p className="text-zinc-500 font-medium max-w-md mx-auto mb-10 text-[15px] leading-relaxed">
        The AI stores conversation summaries and client information here so it remembers context across threads and tasks.
      </p>
      <button onClick={() => onAction("What did I say about client X before?")} className="px-8 py-4 bg-zinc-100 text-zinc-800 font-semibold rounded-full hover:bg-zinc-200 transition-colors flex items-center gap-3">
        <Search size={20} /> Test Semantic Search
      </button>
    </div>
  );
};

const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dash', icon: LayoutDashboard },
    { id: 'chat', label: 'Chat', icon: Bot },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'automations', label: 'Rules', icon: Zap },
    { id: 'memory', label: 'Memory', icon: BookMarked },
  ];

  return (
    <div className="md:hidden flex items-center justify-around bg-white border-t border-black/5 px-2 py-3 shrink-0 pb-safe">
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={cn(
            "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
            activeTab === item.id 
              ? "text-black" 
              : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTool, setCurrentTool] = useState<ToolCall | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        setIsGoogleConnected(data.connected);
      } catch (e) {
        console.error("Failed to check Google connection status.");
      }
    };
    checkStatus();

    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsGoogleConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const response = await fetch('/api/auth/url');
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }
      const { url } = await response.json();

      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');

      if (!authWindow) {
        // Fallback for pop-up blocker logic! But we will assume the environment allows window.open here on user action.
        alert('Please allow popups for this site to connect your Google account.');
      }
    } catch (error) {
      console.error('OAuth error:', error);
    }
  };

  const handleSendMessage = async (msg: string) => {
    setIsProcessing(true);
    setStreamingText("");
    setAgentSteps([]);
    try {
      await sendMessageToAgentStream(history, msg, (data) => {
        if (data.isDone) {
          setHistory(data.history);
          setIsProcessing(false);
          setStreamingText("");
        } else {
          setHistory(data.history);
          setAgentSteps(data.steps);
          setStreamingText(data.currentText);
        }
      });
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  const handleAction = (msg?: string) => {
    setActiveTab('chat');
    if (msg) {
      handleSendMessage(msg);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen font-sans text-zinc-900 bg-[#F3F3F3] overflow-hidden selection:bg-black selection:text-white">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center px-6 pt-6 pb-2 shrink-0">
        <button onClick={() => window.location.reload()} className="text-2xl font-bold text-black tracking-tight text-left hover:opacity-70 transition-opacity">
          Saints Assistant
        </button>
      </div>

      <main className="flex-1 flex flex-col overflow-hidden relative px-4 pb-4 pt-2 md:pt-6 md:pb-6 md:pr-6 md:pl-2">
        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden relative">
          {activeTab === 'chat' && (
            <ChatInterface 
              history={history} 
              onSendMessage={handleSendMessage} 
              isProcessing={isProcessing}
              currentTool={currentTool}
              agentSteps={agentSteps}
              streamingText={streamingText}
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === 'dashboard' && <DailyDashboardView onAction={handleAction} isConnected={isGoogleConnected} onConnect={handleConnectGoogle} />}
          {activeTab === 'todos' && <TodoView onAction={handleAction} />}
          {activeTab === 'tasks' && <TodoView onAction={handleAction} />}
          {activeTab === 'email' && <EmailHubView onAction={handleAction} isConnected={isGoogleConnected} onConnect={handleConnectGoogle} />}
          {activeTab === 'automations' && <AutomationsView onAction={handleAction} />}
          {activeTab === 'memory' && <NotesMemoryView onAction={handleAction} />}
        </div>
        
        <div className="mt-4 px-4 text-[11px] text-zinc-400 text-center md:text-right shrink-0">
          Agent Dashboard Platform
        </div>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
