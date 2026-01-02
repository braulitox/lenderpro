import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, HelpCircle, Lightbulb, Code2, Database } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: '¡Hola Braulio! Bienvenido a tu rincón de aprendizaje de LenderPro. 🚀\n\nSoy tu Mentor de Arquitectura. Mi trabajo es explicarte cómo funciona esta aplicación de forma que hasta un niño de 10 años lo entienda. \n\n¿Por dónde quieres empezar hoy?' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickQuestions = [
    { label: "¿Qué es una base de datos?", icon: Database },
    { label: "¿Cómo calculo intereses?", icon: Lightbulb },
    { label: "¿Qué es el código fuente?", icon: Code2 },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e?: React.FormEvent, text?: string) => {
    if (e) e.preventDefault();
    const messageToSend = text || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage = messageToSend.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Usamos Gemini 3 Pro para máxima calidad en las explicaciones arquitectónicas
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: newMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction: `Actúa como un Arquitecto de Software Senior y Mentor extremadamente paciente. Tu misión es guiar a Braulio en el desarrollo y entendimiento de LenderPro. 
          REGLAS DE ORO:
          1. Braulio es principiante absoluto. 
          2. Usa analogías de la vida real (ej. "Una API es como un camarero en un restaurante").
          3. Sé breve pero muy claro.
          4. Siempre termina con una palabra de aliento.
          5. Si te pregunta algo técnico complejo, divídelo en 3 pasos simples.`,
          temperature: 0.8,
        },
      });

      const aiText = response.text || 'Vaya, mi cerebro se tomó un descanso. ¿Podrías repetirme eso?';
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Parece que mi conexión con la "llave" falló. ¿Configuraste la API_KEY en Vercel como te enseñé?' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-500 p-2.5 rounded-2xl shadow-lg shadow-emerald-500/20">
            <HelpCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-tight">Mentor LenderPro</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Architect Mode</span>
            </div>
          </div>
        </div>
        <Sparkles className="w-5 h-5 text-emerald-400 opacity-60" />
      </div>

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50 custom-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                m.role === 'user' ? 'bg-emerald-600' : 'bg-slate-800'
              }`}>
                {m.role === 'user' ? <User className="w-6 h-6 text-white" /> : <Bot className="w-6 h-6 text-white" />}
              </div>
              <div className={`p-5 rounded-3xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                m.role === 'user' 
                  ? 'bg-emerald-600 text-white rounded-tr-none font-medium' 
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
              }`}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center shadow-lg">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
              <div className="bg-white p-5 rounded-3xl rounded-tl-none border border-slate-200 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer & Quick Questions */}
      <div className="p-6 bg-white border-t border-slate-100">
        {!isLoading && messages.length < 4 && (
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(undefined, q.label)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-full text-xs font-bold transition-all border border-transparent hover:border-emerald-200"
              >
                <q.icon className="w-3.5 h-3.5" />
                {q.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Dime Braulio, ¿qué concepto técnico te gustaría que te explicara?"
            className="w-full pl-6 pr-14 py-5 bg-slate-100 border-2 border-transparent rounded-2xl focus:border-emerald-500 focus:bg-white transition-all text-sm outline-none shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-30 transition-all shadow-lg shadow-emerald-600/20"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <div className="flex justify-center items-center gap-2 mt-4">
           <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Powered by Gemini 3 Pro & Braulio's Vision</span>
        </div>
      </div>
    </div>
  );
};

export default AIChat;