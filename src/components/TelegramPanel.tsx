import React, { useState, useRef, useEffect } from 'react';
import { ToggleLeft, Send, ShieldAlert, Cpu, CheckCircle, RefreshCw, MessageSquare, AlertCircle } from 'lucide-react';

interface TelegramPanelProps {
  onSimulateMessage: (text: string) => Promise<{ reply: string; buttons?: { text: string; callback_data: string }[] }>;
  hasBotToken: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  buttons?: { text: string; callback_data: string }[];
}

export default function TelegramPanel({
  onSimulateMessage,
  hasBotToken
}: TelegramPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `⚔️ <b>Epsilon War AP Tracker Bot</b> ⚔️\n\nWelcome, fighter! I will help you track <b>Ability Points (AP)</b> automatically from your combat logs.\n\n<b>Commands:</b>\n🔹 /points - View point pools for everyone in battle.\n🔹 /status - Show current active Turn and player conditions.\n🔹 /reset - Reset all point pools and Turn logs.\n🔹 /help - Show help menu.\n\n👉 <b>How to track:</b>\nJust forward or paste the combat log directly into this chat!\nThe bot will:\n1️⃣ Update active combat pools with living fighters (starting at exactly 0 points).\n2️⃣ Capture point gains (🗡 🛡 🥊 ⚡️ 🤺 🌬) dynamically from combat hits, block triggers, or counter/evasion actions in the log.\n3️⃣ Deduct points for used abilities (e.g., использует комбинацию ...).\n4️⃣ Provide an elegant real-time summary of each fighter's balance and passive perks.`,
      timestamp: new Date(),
      buttons: [
        { text: "🇷🇺 Русский", callback_data: "/setlang_ru" }
      ]
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendDirectText = async (textToSend: string) => {
    if (!textToSend.trim() || sending) return;
    setSending(true);

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const replyData = await onSimulateMessage(textToSend);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: replyData.reply,
        buttons: replyData.buttons,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'bot',
        text: `❌ <i>Failed to fetch response from simulated backend. Please check connection.</i>`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const userText = inputText;
    setInputText('');
    await sendDirectText(userText);
  };

  const insertCommand = (cmd: string) => {
    sendDirectText(cmd);
  };

  const formatMessageText = (text: string): string => {
    let html = text.replace(/\n/g, '<br/>');
    // Regex matches /points, /status, /reset, /help, /start and wraps them in an interactive span
    html = html.replace(/(\/(?:points|status|reset|help|start))\b/gi, (match) => {
      return `<span class="text-indigo-400 hover:text-indigo-300 font-mono font-bold cursor-pointer underline hover:no-underline px-1 py-0.5 rounded bg-zinc-950/40 border border-zinc-850/10" data-command="${match}">${match}</span>`;
    });
    return html;
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const command = target.getAttribute('data-command') || target.closest('[data-command]')?.getAttribute('data-command');
    if (command) {
      sendDirectText(command);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Bot Setup Instructions */}
      <div className="lg:col-span-5 space-y-6">
        {/* Connection Status Card */}
        <div className="bg-zinc-900/90 rounded-2xl p-5 border border-zinc-800 shadow-md">
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 mb-3 uppercase tracking-wider">
            <Cpu className="h-4 w-4 text-indigo-400" /> Telegram Integration Node
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-xl border border-zinc-900">
              <span className="text-xs text-zinc-400 font-medium">Real Long Polling Status:</span>
              <div className="flex items-center gap-2">
                {hasBotToken ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-bold text-emerald-400">ONLINE</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-650"></span>
                    </span>
                    <span className="text-xs font-bold text-zinc-500">STANDBY Sandbox</span>
                  </>
                )}
              </div>
            </div>

            {!hasBotToken && (
              <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4 flex gap-2.5 text-xs text-amber-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
                <p className="leading-snug">
                  To connect your real Telegram channel or chat: Create a bot with <b>@BotFather</b>, and declare <code>TELEGRAM_BOT_TOKEN="your_token"</code> in your environment secrets.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Command Guide Card */}
        <div className="bg-zinc-900/90 rounded-2xl p-5 border border-zinc-800 shadow-md">
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 mb-3 uppercase tracking-wider">
            <MessageSquare className="h-4 w-4 text-indigo-400" /> Commands Quick trigger
          </h2>
          <p className="text-xs text-zinc-400 mb-4">Click commands below to execute them in the simulator instantly:</p>

          <div className="space-y-2">
            {[
              { cmd: '/points', desc: 'Lists full emoji balance sheet for all active players.' },
              { cmd: '/status', desc: 'Displays current active turn state, processed turn logs.' },
              { cmd: '/reset', desc: 'Triggers atomic database purges of pools.' },
              { cmd: '/help', desc: 'Renders help overview.' }
            ].map(item => (
              <button
                key={item.cmd}
                onClick={() => insertCommand(item.cmd)}
                className="w-full flex justify-between items-center p-3 rounded-lg border border-zinc-850 bg-zinc-950/25 hover:bg-zinc-90 hover:border-zinc-700 transition-all font-mono text-left cursor-pointer"
              >
                <span className="text-xs font-bold text-indigo-400 font-mono">{item.cmd}</span>
                <span className="text-[10px] text-zinc-500 font-sans italic">{item.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Bot Simulator (Right Side / Chat) */}
      <div className="lg:col-span-7 bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-md flex flex-col h-[520px] overflow-hidden">
        {/* Chat Title / Header */}
        <div className="bg-zinc-950/80 px-5 py-3 border-b border-zinc-850 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-indigo-650 flex items-center justify-center text-xs font-bold text-white uppercase font-mono">
              EW
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100">EpsilonWarAPBot (Simulator Sandbox)</h3>
              <p className="text-[10px] text-zinc-500">Replies as Bot automatically</p>
            </div>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 font-mono tracking-wider">MOCK BOT API</span>
        </div>

        {/* Message scroll container */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-zinc-950/50"
          onClick={handleContainerClick}
        >
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end animate-fade-in-right' : 'mr-auto items-start animate-fade-in-left'}`}
            >
              <div 
                className={`p-3 rounded-2xl text-xs leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow' 
                    : 'bg-zinc-900 text-zinc-200 border border-zinc-850 rounded-tl-none pr-3 shadow-md'
                }`}
                dangerouslySetInnerHTML={{ 
                  __html: msg.sender === 'user' 
                    ? msg.text.replace(/\n/g, '<br/>') 
                    : formatMessageText(msg.text) 
                }}
              />
              {msg.buttons && msg.buttons.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2 w-full">
                  {msg.buttons.map((btn, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendDirectText(btn.callback_data)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-900/30 hover:border-indigo-800/60 transition-all cursor-pointer shadow-sm text-center flex-1 min-w-[120px] active:scale-95"
                    >
                      {btn.text}
                    </button>
                  ))}
                </div>
              )}
              <span className="text-[9px] text-zinc-600 mt-1 font-mono">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {sending && (
            <div className="mr-auto max-w-[85%] flex items-start">
              <div className="px-4 py-2.5 rounded-2xl bg-zinc-90 rounded-tl-none border border-zinc-850 flex items-center gap-2">
                <span className="animate-pulse text-zinc-400 font-mono text-[10px]">Processing Combat Log...</span>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zinc-500"></span>
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="p-3 bg-zinc-950/80 border-t border-zinc-850 flex gap-2 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type bot commands like /points, or paste test strings..."
            className="flex-1 bg-zinc-900 border border-zinc-850 rounded-xl px-4 py-2 text-xs text-zinc-200 placeholder:text-zinc-550 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
          />
          <button
            id="btn-send-simulated"
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              !inputText.trim() || sending
                ? 'bg-zinc-900 text-zinc-650 border border-zinc-800 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-501 text-white shadow hover:shadow-lg'
            }`}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
