import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { aiAssistantApi } from '../api/endpoints';
import { useAuth } from './AuthContext';

export interface ChatMessage {
  role: string;
  content: string;
  structured_data?: any;
  isInitialDemo?: boolean;
}

export type AIAssistantPageContext =
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

export function getPageContextFromPathname(pathname: string): AIAssistantPageContext {
  if (pathname === '/product' || pathname === '/products' || pathname.startsWith('/products/')) return 'products';
  if (pathname === '/solutions') return 'production';
  if (pathname === '/customers') return 'customers';
  if (pathname === '/pos') return 'pos';
  if (pathname === '/sales-orders') return 'sales_orders';
  if (pathname === '/purchase-orders') return 'purchase_orders';
  if (pathname === '/sales' || pathname.startsWith('/sales/')) return 'invoices';
  if (pathname === '/returns') return 'returns';
  if (pathname === '/analytics') return 'analytics';
  if (pathname === '/contact') return 'dashboard';
  if (pathname === '/settings') return 'settings';

  if (pathname === '/production/orders') return 'production_orders';
  if (pathname === '/production/item-wise') return 'production_item_wise';
  if (pathname === '/production/rejection') return 'production_rejection';
  if (pathname === '/production/date-wise') return 'production_date_wise';
  if (pathname === '/production/reports') return 'production_reports';
  if (pathname.startsWith('/production')) return 'production';

  if (pathname === '/reports/sales') return 'reports_sales';
  if (pathname === '/reports/invoice') return 'reports_invoice';
  if (pathname === '/reports/payment') return 'reports_payment';
  if (pathname === '/reports/inventory') return 'reports_inventory';
  if (pathname === '/reports/customer') return 'reports_customer';
  if (pathname === '/reports/ai') return 'reports_ai';
  if (pathname.startsWith('/reports')) return 'reports';

  if (pathname === '/finance' || pathname === '/finance/overview') return 'finance_overview';
  if (pathname === '/finance/purchase-invoices') return 'finance_purchase_invoices';
  if (pathname === '/finance/incoming-payments') return 'finance_incoming_payments';
  if (pathname === '/finance/outgoing-payments') return 'finance_outgoing_payments';
  if (pathname === '/finance/customer-analysis') return 'finance_customer_analysis';
  if (pathname === '/finance/supplier-analysis') return 'finance_supplier_analysis';
  if (pathname === '/finance/profitability-reports') return 'finance_profitability_reports';
  if (pathname.startsWith('/finance')) return 'finance';

  return 'dashboard';
}

interface AIAssistantContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleOpen: () => void;
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  conversationId: string | null;
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  loadingChat: boolean;
  pageContext: AIAssistantPageContext;
  pageFilters: Record<string, any>;
  setPageFilters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  handleSendChat: (overridePrompt?: string) => Promise<void>;
  chatScrollRef: React.RefObject<HTMLDivElement | null>;
}

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

export const AIAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [pageFilters, setPageFilters] = useState<Record<string, any>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const pageContext = getPageContextFromPathname(location.pathname);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I am ATLAS AI Assistant. How can I help you analyze your business, sales, inventory, or operations today?",
    },
  ]);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  // Scroll to bottom on updates
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, isOpen]);

  // Listen for global custom events
  useEffect(() => {
    const handleToggle = (e: any) => {
      if (e.detail?.open !== undefined) {
        setIsOpen(Boolean(e.detail.open));
      } else {
        setIsOpen((prev) => !prev);
      }
    };

    const handlePrompt = (e: any) => {
      const prompt = e.detail;
      if (prompt) {
        setIsOpen(true);
        handleSendChat(prompt);
      }
    };

    window.addEventListener('atls-toggle-ai', handleToggle);
    window.addEventListener('atls-ai-prompt', handlePrompt);
    return () => {
      window.removeEventListener('atls-toggle-ai', handleToggle);
      window.removeEventListener('atls-ai-prompt', handlePrompt);
    };
  }, []);

  const handleSendChat = async (overridePrompt?: string) => {
    const msgToSend = (overridePrompt || chatInput).trim();
    if (!msgToSend || loadingChat) return;

    setChatInput('');
    setChatHistory((prev) => [...prev, { role: 'user', content: msgToSend }]);
    setLoadingChat(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const data = await aiAssistantApi.chat(
        {
          message: msgToSend,
          branch_id: pageFilters?.branch || user?.branch_id || 'SH',
          conversation_id: conversationId || undefined,
          history: chatHistory.map((m) => ({ role: m.role, content: m.content })),
          context: {
            page: pageContext,
            pathname: location.pathname,
            ...pageFilters,
          },
        },
        {
          signal: controller.signal,
          timeout: 45000,
        }
      );
      clearTimeout(timeoutId);

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      setChatHistory((prev) => [
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

      if (
        err.name === 'CanceledError' ||
        err.name === 'AbortError' ||
        err.code === 'ECONNABORTED' ||
        (err.message && err.message.includes('timeout'))
      ) {
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

      setChatHistory((prev) => [
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

  return (
    <AIAssistantContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggleOpen,
        isFullscreen,
        setIsFullscreen,
        chatInput,
        setChatInput,
        chatHistory,
        setChatHistory,
        conversationId,
        setConversationId,
        loadingChat,
        pageContext,
        pageFilters,
        setPageFilters,
        handleSendChat,
        chatScrollRef,
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
};

export const useAIAssistant = (): AIAssistantContextType => {
  const context = useContext(AIAssistantContext);
  if (!context) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
};
