import React, { useState, useRef, useEffect } from 'react';
import {
  Minus, Maximize2, X, Send, Sparkles
} from 'lucide-react';
import { aiAssistantApi, financeApi, type FinanceOverviewResponse } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { AIChatRenderer } from './AIChatRenderer';
import { FormattedMessage } from './FormattedMessage';
import { FinanceAIWorkspace } from './finance/FinanceAIWorkspace';

export type AIAssistantContext =
  | 'dashboard'
  | 'products'
  | 'customers'
  | 'pos'
  | 'analytics'
  | 'settings'
  | 'sales_orders'
  | 'invoices'
  | 'purchase_orders'
  | 'returns'
  | 'production'
  | 'production_orders'
  | 'production_item_wise'
  | 'production_rejection'
  | 'production_date_wise'
  | 'production_reports'
  | 'reports'
  | 'reports_sales'
  | 'reports_invoice'
  | 'reports_payment'
  | 'reports_inventory'
  | 'reports_customer'
  | 'reports_ai'

  | 'finance'
  | 'finance_overview'
  | 'finance_purchase_invoices'
  | 'finance_incoming_payments'
  | 'finance_outgoing_payments'
  | 'finance_customer_analysis'
  | 'finance_supplier_analysis'
  | 'finance_profitability_reports';


export interface AIAssistantPanelProps {
  pageContext?: AIAssistantContext;
  pageFilters?: Record<string, any>;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  pageContext = 'dashboard',
  pageFilters = {},
  isOpen,
  onClose,
  className = '',
}) => {
  const { user } = useAuth();
  const [aiFullscreen, setAiFullscreen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
    if (aiFullscreen && isFinance && !financeOverviewData) {
      fetchFinanceOverview();
    }
  }, [aiFullscreen, isFinance, financeRange, financeBranch]);

  // Chat message history (seeded with reference demo on dashboard or tailored greeting)
  const [chatHistory, setChatHistory] = useState<Array<{
    role: string;
    content: string;
    structured_data?: any;
    isInitialDemo?: boolean;
  }>>(() => {
    if (pageContext === 'products') {
      return [
        {
          role: 'assistant',
          content: 'Hello! I can help you check stock levels, minimal thresholds, and item details across all warehouses.',
        }
      ];
    }
    if (pageContext === 'customers') {
      return [
        {
          role: 'assistant',
          content: 'Hello! I can help you search customers by name or mobile number, review purchase histories, and check balances.',
        }
      ];
    }
    if (pageContext === 'analytics') {
      return [
        {
          role: 'assistant',
          content: 'Hello! I can help you analyze branch performance, product velocity, and multi-period revenue trends.',
        }
      ];
    }
    if (pageContext === 'sales_orders') {
      return [
        {
          role: 'assistant',
          content: 'Hello! I can help you search, filter, and analyze Sales Orders from SAP Business One.',
        }
      ];
    }
    if (pageContext === 'invoices') {
      return [
        {
          role: 'assistant',
          content: 'Hello! I can help you inspect customer invoices, payment breakdowns, and GST totals.',
        }
      ];
    }
    if (pageContext === 'purchase_orders') {
      return [
        {
          role: 'assistant',
          content: 'Hello! I can help you monitor supplier purchase orders, open quantities, and receipt status.',
        }
      ];
    }
    if (pageContext === 'returns') {
      return [
        {
          role: 'assistant',
          content: 'Hello! I can help you analyze customer returns, pending manager approvals, and credit notes.',
        }
      ];
    }
    if (pageContext.startsWith('production')) {
      const messages: Record<string, string> = {
        production_orders: 'Hello! I can help you analyze production order statuses, planned vs completed quantities, and due dates.',
        production_item_wise: 'Hello! I can help you review item-wise production metrics, batch completions, and outputs.',
        production_rejection: 'Hello! I can help you inspect rejection rates, scrap quantities, and item-wise defect logs.',
        production_date_wise: 'Hello! I can help you track daily and weekly production trends, planned targets, and outputs.',
        production_reports: 'Hello! I can help you generate and explain production summaries, scrap ratios, and efficiency reports.',
      };
      return [
        {
          role: 'assistant',
          content: messages[pageContext] || 'Hello! I can help you monitor production batches, output volumes, and operational performance from SAP.',
        }
      ];
    }
    if (pageContext.startsWith('reports')) {
      const messages: Record<string, string> = {
        reports_sales: 'Hello! I can help you analyze sales trends, top-performing products, customer volumes, and periods.',
        reports_invoice: 'Hello! I can help you review invoice totals, pending receivables, and tax summaries.',
        reports_payment: 'Hello! I can help you summarize payment collection channels, cash flow, and bank settlements.',
        reports_inventory: 'Hello! I can help you track inventory levels, low-stock warnings, and warehouse movements.',
        reports_customer: 'Hello! I can help you analyze customer spending patterns, order frequencies, and outstanding balances.',
        reports_ai: 'Hello! I can synthesize automated cross-module insights, anomaly alerts, and performance summaries.',
      };
      return [
        {
          role: 'assistant',
          content: messages[pageContext] || 'Hello! I can help you review and interpret all business and financial reports.',
        }
      ];
    }
    if (pageContext === 'finance' || pageContext === 'finance_overview' || pageContext.startsWith('finance_')) {
      return [
        {
          role: 'assistant',
          content: "Hello! I'm your ATLAS Finance Assistant.\n\nI can help you with:\n• Sales, purchases and payments\n• Invoice and payment details\n• Customer & supplier analysis\n• Outstanding receivables and payables\n• Profitability and financial reports\n• Open relevant pages in ATLAS",
        }
      ];
    }
    // Default dashboard welcome thread
    return [
      {
        role: 'assistant',
        content: "Hello! I'm your ATLAS AI Assistant. Ask me anything about monthly revenue, weekly branch sales, payment channels, or inventory.",
      }
    ];
  });


  // Suggested questions based on page context
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
          'Find customer Amazon',
          'Search customer by mobile',
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
          'Top customers by sales order',
          'Recent sales orders',
        ];
      case 'invoices':
        return [
          'Summarize paid and pending invoices',
          'Show invoice totals for current period',
          'Find recent cash sales',
          'Invoices with UPI payment',
          'Top billed customers',
        ];
      case 'purchase_orders':
        return [
          'Summarize pending purchase orders',
          'Find orders awaiting receipt',
          'Open quantity by supplier',
          'Recent purchase orders',
          'List low stock items',
        ];
      case 'returns':
        return [
          'Summarize pending return approvals',
          'Find highest value return requests',
          'Breakdown of return reasons',
          'Recent approved credit notes',
          'Returns by branch',
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
          'Open production reports',
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
          'Summarize customer activity',
          'Summarize the reports available to me',
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
          'Incoming payments',
          'Outgoing payments',
          'Top customers',
          'Outstanding receivables',
          'Show revenue per month for the past 6 months',
          'Top suppliers by purchase',
        ];
      default:
        return [
          'Show sales today',
          'How many sales orders are pending?',
          'Which products have low stock?',
          'Show pending purchase orders',
          'Show rejection trends',
          'Open the inventory page',
        ];
    }
  }, [pageContext]);


  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, isOpen]);

  // Listen for AI prompt requests dispatched from Global Search Modal
  useEffect(() => {
    const handleAIPrompt = (e: any) => {
      const prompt = e.detail;
      if (prompt && isOpen) {
        handleSendChat(prompt);
      }
    };
    window.addEventListener('atls-ai-prompt', handleAIPrompt);
    return () => window.removeEventListener('atls-ai-prompt', handleAIPrompt);
  }, [isOpen]);

  // Send AI Chat Message
  const handleSendChat = async (overridePrompt?: string) => {
    const msgToSend = (overridePrompt || chatInput).trim();
    if (!msgToSend || loadingChat) return;

    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: msgToSend }]);
    setLoadingChat(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const data = await aiAssistantApi.chat({
        message: msgToSend,
        branch_id: pageFilters?.branch || user?.branch_id || 'SH',
        conversation_id: conversationId || undefined,
        history: chatHistory.map(m => ({ role: m.role, content: m.content })),
        context: {
          page: pageContext,
          ...pageFilters
        }
      }, {
        signal: controller.signal,
        timeout: 45000
      });
      clearTimeout(timeoutId);

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          structured_data: data.structured_data,
        },
      ]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      let errMsg = 'Failed to communicate with AI Assistant. Please try again.';

      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ECONNABORTED' || (err.message && err.message.includes('timeout'))) {
        errMsg = 'The AI Assistant request timed out after 45 seconds. Please try again or refine your query.';
      } else if (err?.response?.status === 402) {
        errMsg = 'AI Provider quota exhausted: Your OpenAI/Gemini account credit balance has run out. Please check your billing at platform.openai.com.';
      } else if (err?.response?.status === 504) {
        errMsg = err?.response?.data?.detail || 'Request timed out on the backend server while contacting the AI service.';
      } else if (err?.response?.data?.detail) {
        errMsg = err.response.data.detail;
      } else if (err.message) {
        errMsg = err.message;
      }

      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: errMsg,
        },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  if (!isOpen) return null;

  if (isFinance && aiFullscreen) {
    return (
      <FinanceAIWorkspace
        isOpen={aiFullscreen}
        onClose={onClose}
        onMinimize={() => setAiFullscreen(false)}
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
      className={`flex flex-col rounded-2xl border border-indigo-200/80 bg-white shadow-lg shadow-indigo-500/5 overflow-hidden transition-all duration-300 ring-1 ring-indigo-500/10 ${aiFullscreen
        ? 'fixed inset-4 z-50 shadow-2xl h-[calc(100vh-32px)]'
        : 'w-full lg:w-[390px] xl:w-[410px] 2xl:w-[425px] shrink-0 h-[calc(100vh-100px)] sticky top-0'
        } ${className}`}
    >
      {/* Panel Header - Google Gemini Signature Gradient Style */}
      <div className="flex items-center justify-between border-b border-indigo-100/90 px-4 py-2.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-purple-50/90 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs">
            <Sparkles size={14} className="animate-pulse" />
          </div>
          <div>
            <span className="text-[13.5px] font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              ATLAS AI Assistant
            </span>
            <div className="text-[8.5px] font-bold text-indigo-500 tracking-wider uppercase">
              Business Intelligence
            </div>
          </div>
          {isFinance ? (
            <span className="rounded-full bg-purple-50 border border-purple-200/90 px-2.5 py-0.5 text-[9px] font-black text-purple-700 tracking-wider shadow-2xs">
              FINANCE MODE
            </span>
          ) : (
            <span className="rounded-full bg-white/90 border border-indigo-200/80 px-2 py-0.5 text-[9px] font-bold text-indigo-700 tracking-wide shadow-2xs">
              READ-ONLY SAP
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={onClose}
            className="p-1 hover:text-slate-700 hover:bg-white/80 rounded-lg transition cursor-pointer"
            title="Minimize / Collapse"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => setAiFullscreen(!aiFullscreen)}
            className="p-1 hover:text-slate-700 hover:bg-white/80 rounded-lg transition cursor-pointer"
            title="Fullscreen / Expand"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:text-slate-700 hover:bg-white/80 rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable Conversation Area with Subtle Ambient Gemini Tint */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-gradient-to-b from-indigo-50/20 via-white to-purple-50/20">
        {/* Top Assistant Greeting */}
        <div className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs">
            <Sparkles size={13} />
          </div>
          <div className="rounded-2xl rounded-tl-xs bg-white border border-indigo-100/90 p-3 text-[12px] text-slate-700 shadow-2xs leading-relaxed max-w-[90%]">
            <span className="font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {isFinance ? "Hello! I'm your ATLAS Finance Assistant." : "Hello! I'm your ATLAS AI Assistant."}
            </span>
            <p className="mt-1 text-[11.5px] text-slate-500">I can help you with:</p>
            <ul className="mt-1 list-disc list-inside text-[11.5px] text-slate-600 space-y-0.5">
              {isFinance ? (
                <>
                  <li>Sales, purchases and payments</li>
                  <li>Invoice and payment details</li>
                  <li>Customer & supplier analysis</li>
                  <li>Outstanding receivables and payables</li>
                  <li>Profitability and financial reports</li>
                  <li>Open relevant pages in ATLAS</li>
                </>
              ) : (
                <>
                  <li>Production batches, orders & rejection trends</li>
                  <li>Sales, invoices, payments & stock levels</li>
                  <li>Live authorized data from SAP Business One</li>
                </>
              )}
            </ul>
          </div>
        </div>


        {/* Date Pill Divider */}
        <div className="flex justify-center my-1">
          <span className="rounded-full bg-indigo-50 border border-indigo-100/80 px-3 py-0.5 text-[10px] font-bold text-indigo-600">
            Today
          </span>
        </div>

        {/* Conversation Flow */}
        {chatHistory.map((msg, i) => (
          <div key={i} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role !== 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs">
                <Sparkles size={13} />
              </div>
            )}
            <div
              className={`rounded-2xl p-3 text-[12px] leading-relaxed max-w-[88%] shadow-xs ${msg.role === 'user'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-tr-xs'
                : 'bg-white text-slate-800 border border-indigo-100/90 rounded-tl-xs shadow-2xs'
                }`}
            >
              <FormattedMessage content={msg.content} isUser={msg.role === 'user'} />
              <AIChatRenderer structuredData={msg.structured_data} />
            </div>
            {msg.role === 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white shadow-xs">
                {user?.name ? user.name.split(' ').filter(Boolean).map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() : 'KK'}
              </div>
            )}
          </div>
        ))}

        {loadingChat && (
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs animate-pulse">
              <Sparkles size={13} />
            </div>
            <div className="rounded-2xl rounded-tl-xs bg-white border border-indigo-100/90 p-2.5 text-[11px] text-indigo-700 font-medium shadow-2xs flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-ping" />
              ATLAS AI is analyzing business records...
            </div>
          </div>
        )}
      </div>

      {/* Suggested Question Pills - Gemini Modern Gradient Pills */}
      <div className="px-3 pt-2.5 pb-2 bg-gradient-to-r from-slate-50 via-indigo-50/25 to-purple-50/25 border-t border-indigo-100/80 flex flex-wrap gap-1.5 shrink-0">
        {suggestedQuestions.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSendChat(prompt)}
            className="rounded-xl border border-indigo-200/80 bg-white/95 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-indigo-400 px-2.5 py-1 text-[10.5px] font-medium text-slate-700 hover:text-indigo-950 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 group"
          >
            <Sparkles size={10} className="text-indigo-500 group-hover:rotate-12 transition-transform shrink-0" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* Bottom Fixed Message Input */}
      <div className="p-3 bg-white border-t border-indigo-100/90 shrink-0">
        <div className="flex items-center gap-2 rounded-2xl border border-indigo-200/90 bg-slate-50/50 p-1.5 shadow-xs focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder={isFinance ? "Ask anything about your finance data..." : "Ask anything about your business..."}
            className="flex-1 bg-transparent px-2.5 text-[12px] text-slate-800 outline-none placeholder:text-slate-400"

          />
          <button
            onClick={() => handleSendChat()}
            disabled={loadingChat || !chatInput.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white disabled:opacity-40 transition cursor-pointer shadow-xs"
            title="Send message"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
};
