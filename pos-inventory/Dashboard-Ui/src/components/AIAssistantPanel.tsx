import React, { useState, useEffect } from 'react';
import {
  Minus, Maximize2, X, Send, Sparkles, Mic, MicOff, Volume2, Square, Globe, AlertCircle
} from 'lucide-react';
import { financeApi, type FinanceOverviewResponse } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { useAIAssistant, type AIAssistantPageContext } from '../contexts/AIAssistantContext';
import { AIChatRenderer } from './AIChatRenderer';
import { FormattedMessage } from './FormattedMessage';
import { FinanceAIWorkspace } from './finance/FinanceAIWorkspace';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

export type AIAssistantContext = AIAssistantPageContext;

export interface AIAssistantPanelProps {
  pageContext?: AIAssistantPageContext;
  pageFilters?: Record<string, any>;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  pageContext: propsPageContext,
  pageFilters: propsPageFilters,
  isOpen: propsIsOpen,
  onClose: propsOnClose,
  className = '',
}) => {
  const { user } = useAuth();
  const context = useAIAssistant();

  const isOpen = propsIsOpen !== undefined ? propsIsOpen : context.isOpen;
  const onClose = propsOnClose || (() => context.setIsOpen(false));
  const pageContext = propsPageContext || context.pageContext;
  const pageFilters = propsPageFilters || context.pageFilters;

  const {
    isFullscreen,
    setIsFullscreen,
    chatInput,
    setChatInput,
    chatHistory,
    loadingChat,
    handleSendChat,
    chatScrollRef,
  } = context;

  // Voice Recognition & Voice Output Hooks
  const speechRecognition = useSpeechRecognition();
  const speechSynthesis = useSpeechSynthesis();
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Sync speech recognition transcription directly into chatInput for user review & editing
  useEffect(() => {
    if (speechRecognition.isListening) {
      const liveText = (speechRecognition.transcript + ' ' + speechRecognition.interimTranscript).trim();
      if (liveText) {
        setChatInput(liveText);
      }
    }
  }, [speechRecognition.transcript, speechRecognition.interimTranscript, speechRecognition.isListening, setChatInput]);

  // Display speech error notice if permission denied or unsupported
  useEffect(() => {
    if (speechRecognition.error) {
      setVoiceNotice(speechRecognition.error);
    }
  }, [speechRecognition.error]);

  // Stop recording and speech synthesis if panel closes or navigates
  useEffect(() => {
    if (!isOpen) {
      if (speechRecognition.isListening) speechRecognition.stopListening();
      if (speechSynthesis.isSpeaking) speechSynthesis.stop();
    }
  }, [isOpen, speechRecognition, speechSynthesis]);

  // Full-screen Finance Workspace State
  const isFinance = pageContext === 'finance' || pageContext === 'finance_overview' || pageContext.startsWith('finance_');
  const [financeOverviewData, setFinanceOverviewData] = useState<FinanceOverviewResponse | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeRange, setFinanceRange] = useState('monthly');
  const [financeBranch, setFinanceBranch] = useState(pageFilters?.branch || user?.branch_id || 'SH');

  const fetchFinanceOverview = async () => {
    setFinanceLoading(true);
    try {
      const data = await financeApi.getOverview({
        range: financeRange,
        branch: financeBranch === 'All Branches' ? undefined : financeBranch,
      });
      setFinanceOverviewData(data);
    } catch (err) {
      console.error('Failed to load finance overview in Assistant Panel', err);
    } finally {
      setFinanceLoading(false);
    }
  };

  useEffect(() => {
    if (isFullscreen && isFinance && !financeOverviewData) {
      fetchFinanceOverview();
    }
  }, [isFullscreen, isFinance, financeRange, financeBranch]);

  // Suggested questions based on page context (including Smart Email commands)
  const suggestedQuestions = React.useMemo(() => {
    switch (pageContext) {
      case 'products':
        return [
          'Which products have low stock?',
          'Which products have the highest sales?',
          'Show stock for a particular warehouse',
          'Find low stock items in SH',
        ];
      case 'customers':
        return [
          'Which customers generated the most sales?',
          "Summarize this customer's account and draft an email",
          'Draft a payment reminder for this customer',
          'Show top billed customers',
        ];
      case 'analytics':
        return [
          'Compare sales and production this month',
          'Which products have high sales but low stock?',
          'Compare this month with last month',
          'Show sales for 2025',
        ];
      case 'sales_orders':
        return [
          'Summarize pending sales orders',
          'Show open order quantities',
          'Find orders awaiting delivery',
          'Draft an email about this sales order',
        ];
      case 'invoices':
        return [
          'Prepare an email about this invoice',
          'Draft a payment reminder for this customer',
          'Summarize paid and pending invoices',
          'Top billed customers',
        ];
      case 'purchase_orders':
        return [
          'Email the supplier about the pending purchase order',
          'Summarize pending purchase orders',
          'Find orders awaiting receipt',
          'Open quantity by supplier',
        ];
      case 'returns':
        return [
          'Summarize pending return approvals',
          'Find highest value return requests',
          'Breakdown of return reasons',
          'Recent approved credit notes',
        ];
      case 'production':
      case 'production_orders':
      case 'production_item_wise':
      case 'production_rejection':
      case 'production_date_wise':
      case 'production_reports':
        return [
          'How many production orders are pending?',
          'Show rejection trends',
          'Compare planned and completed production',
          'Show item-wise production',
        ];
      case 'reports':
      case 'reports_sales':
      case 'reports_invoice':
      case 'reports_payment':
      case 'reports_inventory':
      case 'reports_customer':
      case 'reports_ai':
        return [
          'Summarize sales today',
          'Compare this month with last month',
          'Show payment summaries',
          'Identify low-stock inventory',
        ];
      case 'finance':
      case 'finance_overview':
      case 'finance_purchase_invoices':
      case 'finance_incoming_payments':
      case 'finance_outgoing_payments':
      case 'finance_customer_analysis':
      case 'finance_supplier_analysis':
      case 'finance_profitability_reports':
        return [
          'Write a professional overdue payment follow-up',
          'Explain the payment issue and prepare an email for the finance team',
          'Outstanding receivables',
          'Incoming payments',
          'Outgoing payments',
        ];
      default:
        return [
          'Draft a payment reminder for this customer',
          'Prepare an email about this invoice',
          'Show sales today',
          'Which products have low stock?',
          'How many sales orders are pending?',
        ];
    }
  }, [pageContext]);

  if (!isOpen) return null;

  if (isFinance && isFullscreen) {
    return (
      <FinanceAIWorkspace
        isOpen={isFullscreen}
        onClose={onClose}
        onMinimize={() => setIsFullscreen(false)}
        chatMessages={chatHistory as any}
        onSendMessage={async (msg) => {
          await handleSendChat(msg);
        }}
        chatLoading={loadingChat}
        range={financeRange}
        setRange={setFinanceRange}
        branch={financeBranch}
        setBranch={setFinanceBranch}
        overviewData={financeOverviewData}
        overviewLoading={financeLoading}
        onRefreshOverview={fetchFinanceOverview}
      />
    );
  }

  return (
    <aside
      className={`flex flex-col rounded-2xl border border-indigo-200/80 bg-white/95 backdrop-blur-md shadow-2xl shadow-indigo-900/15 overflow-hidden transition-all duration-300 ring-1 ring-indigo-500/15 z-50 ${isFullscreen
        ? 'fixed inset-4 shadow-2xl h-[calc(100vh-32px)]'
        : 'fixed right-3 sm:right-5 top-16 sm:top-[70px] bottom-3 sm:bottom-4 w-[calc(100vw-24px)] sm:w-[400px] xl:w-[425px] 2xl:w-[440px]'
        } ${className}`}
    >
      {/* Panel Header - Google Gemini Signature Gradient Style */}
      <div className="flex items-center justify-between border-b border-indigo-100/90 px-4 py-3 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-purple-50/90 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs">
            <Sparkles size={16} className="animate-pulse" />
          </div>
          <div>
            <span className="text-[15px] sm:text-[16px] font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              ATLAS AI Assistant
            </span>
            <div className="text-[10px] sm:text-[11px] font-bold text-indigo-600 tracking-wider uppercase">
              Business Intelligence & Email
            </div>
          </div>
          {isFinance ? (
            <span className="rounded-full bg-purple-50 border border-purple-200/90 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 tracking-wider shadow-2xs">
              FINANCE MODE
            </span>
          ) : (
            <span className="rounded-full bg-white/90 border border-indigo-200/80 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 tracking-wide shadow-2xs">
              READ-ONLY SAP
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={onClose}
            className="p-1.5 hover:text-slate-700 hover:bg-white/80 rounded-lg transition cursor-pointer"
            title="Minimize / Collapse"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:text-slate-700 hover:bg-white/80 rounded-lg transition cursor-pointer"
            title="Fullscreen / Expand"
          >
            <Maximize2 size={15} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:text-slate-700 hover:bg-white/80 rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable Conversation Area with Subtle Ambient Gemini Tint */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-gradient-to-b from-indigo-50/20 via-white to-purple-50/20">
        {/* Top Assistant Greeting */}
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs">
            <Sparkles size={15} />
          </div>
          <div className="rounded-2xl rounded-tl-xs bg-white border border-indigo-100/90 p-3.5 text-[13.5px] sm:text-[14px] text-slate-700 shadow-2xs leading-relaxed max-w-[90%]">
            <span className="font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent text-[14px] sm:text-[14.5px]">
              {isFinance ? "Hello! I'm your ATLAS Finance Assistant." : "Hello! I'm your ATLAS AI Assistant."}
            </span>
            <p className="mt-1.5 text-[13px] sm:text-[13.5px] text-slate-500 font-medium">I can help you with:</p>
            <ul className="mt-1 list-disc list-inside text-[13px] sm:text-[13.5px] text-slate-600 space-y-1">
              {isFinance ? (
                <>
                  <li>Drafting payment reminders & invoice follow-up emails</li>
                  <li>Sales, purchases and payments analysis</li>
                  <li>Customer & supplier balances & overdue amounts</li>
                  <li>Profitability and financial reports</li>
                  <li>Open relevant pages in ATLAS</li>
                </>
              ) : (
                <>
                  <li>Smart email drafts (payment reminders, PO follow-ups, invoices)</li>
                  <li>Voice commands in English & Hindi</li>
                  <li>Production batches, orders & rejection trends</li>
                  <li>Sales, invoices, payments & live stock levels</li>
                  <li>Live authorized data from SAP Business One</li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Date Pill Divider */}
        <div className="flex justify-center my-1">
          <span className="rounded-full bg-indigo-50 border border-indigo-100/80 px-3 py-1 text-[11.5px] sm:text-[12px] font-bold text-indigo-600">
            Today
          </span>
        </div>

        {/* Conversation Flow */}
        {chatHistory.map((msg, i) => (
          <div key={i} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role !== 'user' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs">
                <Sparkles size={15} />
              </div>
            )}
            <div
              className={`rounded-2xl p-3.5 text-[13.5px] sm:text-[14px] leading-relaxed max-w-[88%] shadow-xs ${msg.role === 'user'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-tr-xs font-medium'
                : 'bg-white text-slate-800 border border-indigo-100/90 rounded-tl-xs shadow-2xs font-normal'
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <FormattedMessage content={msg.content} isUser={msg.role === 'user'} />
                </div>
                {/* Voice Output: Play / Stop summary control for assistant responses */}
                {msg.role !== 'user' && speechSynthesis.isSupported && (
                  <button
                    id={`ai-voice-tts-btn-${i}`}
                    data-testid={`ai-voice-tts-btn-${i}`}
                    onClick={() => speechSynthesis.speak(msg.content, i, speechRecognition.language)}
                    className={`p-1.5 rounded-lg shrink-0 transition-colors cursor-pointer ${
                      speechSynthesis.speakingIndex === i && speechSynthesis.isSpeaking
                        ? 'bg-indigo-100 text-indigo-700 animate-pulse'
                        : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                    }`}
                    title={
                      speechSynthesis.speakingIndex === i && speechSynthesis.isSpeaking
                        ? 'Stop reading aloud'
                        : 'Read concise summary aloud'
                    }
                  >
                    {speechSynthesis.speakingIndex === i && speechSynthesis.isSpeaking ? (
                      <Square size={13} className="fill-current" />
                    ) : (
                      <Volume2 size={14} />
                    )}
                  </button>
                )}
              </div>

              <AIChatRenderer structuredData={msg.structured_data} />

              {msg.role !== 'user' && Array.isArray(msg.suggested_follow_ups) && msg.suggested_follow_ups.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-indigo-100/70 flex flex-wrap gap-1">
                  <div className="w-full text-[9px] font-bold text-indigo-600/80 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                    <Sparkles size={10} className="text-indigo-500" />
                    Suggested follow-up:
                  </div>
                  {msg.suggested_follow_ups.map((followUp: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleSendChat(followUp)}
                      className="text-left rounded-lg bg-indigo-50/80 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-indigo-300 text-indigo-900 px-2 py-1 text-[11px] font-medium border border-indigo-200/80 transition-all cursor-pointer shadow-2xs"
                    >
                      {followUp}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white shadow-xs">
                {user?.name ? user.name.split(' ').filter(Boolean).map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() : 'KK'}
              </div>
            )}
          </div>
        ))}

        {loadingChat && (
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs animate-pulse">
              <Sparkles size={15} />
            </div>
            <div className="rounded-2xl rounded-tl-xs bg-white border border-indigo-100/90 p-3 text-[13px] text-indigo-700 font-semibold shadow-2xs flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-ping" />
              ATLAS AI is analyzing business records...
            </div>
          </div>
        )}
      </div>

      {/* Suggested Question Pills - Dynamic follow-ups or context recommendations */}
      <div className="px-3 pt-2 pb-1.5 bg-gradient-to-r from-slate-50 via-indigo-50/25 to-purple-50/25 border-t border-indigo-100/80 flex flex-wrap gap-1.5 shrink-0">
        {(() => {
          const lastAssistant = [...chatHistory].reverse().find((m) => m.role === 'assistant');
          const prompts = (lastAssistant?.suggested_follow_ups && lastAssistant.suggested_follow_ups.length > 0)
            ? lastAssistant.suggested_follow_ups
            : suggestedQuestions;
          return prompts.map((prompt: string, idx: number) => (
            <button
              key={prompt}
              id={`prompt-chip-${idx}`}
              data-prompt={prompt}
              onClick={() => handleSendChat(prompt)}
              className="rounded-xl border border-indigo-200/80 bg-white/95 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-indigo-400 px-3 py-1 text-[12px] sm:text-[12.5px] font-semibold text-slate-700 hover:text-indigo-950 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 group"
            >
              <Sparkles size={12} className="text-indigo-500 group-hover:rotate-12 transition-transform shrink-0" />
              <span>{prompt}</span>
            </button>
          ));
        })()}
      </div>

      {/* Voice Warning or Status Banner */}
      {voiceNotice && (
        <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-200 text-amber-800 text-[11.5px] font-medium flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            <span>{voiceNotice}</span>
          </div>
          <button
            onClick={() => setVoiceNotice(null)}
            className="text-amber-700 hover:text-amber-900 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Active Recording State Banner */}
      {speechRecognition.isListening && (
        <div className="px-3 py-1.5 bg-red-50/90 border-t border-red-200/90 text-red-700 text-[12px] font-semibold flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 inline-block animate-ping" />
            <span>
              Listening ({speechRecognition.language === 'hi-IN' ? 'Hindi' : 'English'})... Speak your command
            </span>
          </div>
          <button
            onClick={speechRecognition.stopListening}
            className="rounded-md bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 text-[11px] font-bold cursor-pointer transition shadow-2xs"
          >
            Done
          </button>
        </div>
      )}

      {/* Bottom Fixed Message Input with Voice Controls */}
      <div className="p-3 bg-white border-t border-indigo-100/90 shrink-0">
        <div className="flex items-center gap-2 rounded-2xl border border-indigo-200/90 bg-slate-50/50 p-2 shadow-xs focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          {/* Voice Language Toggle (English <-> Hindi) */}
          <button
            id="ai-voice-lang-toggle"
            data-testid="ai-voice-lang-toggle"
            type="button"
            onClick={() =>
              speechRecognition.setLanguage(
                speechRecognition.language === 'en-IN' ? 'hi-IN' : 'en-IN'
              )
            }
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition cursor-pointer shrink-0"
            title={`Switch Voice Language (Current: ${
              speechRecognition.language === 'hi-IN' ? 'Hindi' : 'English'
            })`}
          >
            <Globe size={12} className="text-indigo-600" />
            <span>{speechRecognition.language === 'hi-IN' ? 'HI' : 'EN'}</span>
          </button>

          {/* Voice Input Microphone Button */}
          <button
            id="ai-voice-mic-btn"
            data-testid="ai-voice-mic-btn"
            type="button"
            onClick={() => {
              setVoiceNotice(null);
              if (speechRecognition.isListening) {
                speechRecognition.stopListening();
              } else {
                speechRecognition.startListening();
              }
            }}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition cursor-pointer shadow-xs ${
              speechRecognition.isListening
                ? 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-400 ring-offset-1 animate-pulse'
                : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-indigo-200/90'
            }`}
            title={
              speechRecognition.isListening
                ? 'Stop listening'
                : `Voice input (${speechRecognition.language === 'hi-IN' ? 'Hindi' : 'English'})`
            }
          >
            {speechRecognition.isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          {/* Text Input for user questions or reviewing voice transcription */}
          <input
            id="ai-chat-input"
            data-testid="ai-chat-input"
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder={
              speechRecognition.isListening
                ? 'Transcribing your voice...'
                : isFinance
                ? 'Ask about finance or request an email...'
                : 'Ask anything or say "Draft an email"...'
            }
            className="flex-1 min-w-0 bg-transparent px-2 py-1 text-[14px] sm:text-[14.5px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
          />

          {/* Send Message Button */}
          <button
            id="ai-chat-send-btn"
            data-testid="ai-chat-send-btn"
            onClick={() => handleSendChat()}
            disabled={loadingChat || !chatInput.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white disabled:opacity-40 transition cursor-pointer shadow-xs"
            title="Send message"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
};
