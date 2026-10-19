import React, { useState } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  X,
  ShieldAlert,
  Building,
  Calendar,
  FileText,
  DollarSign,
  Loader2,
  Check,
} from 'lucide-react';
import { emailApi, type EmailSendResponse } from '../api/endpoints';

export interface EmailDraftCardProps {
  card?: {
    draft_id?: string;
    purpose?: string;
    recipient_email?: string;
    recipient_name?: string;
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
    business_context?: Record<string, any>;
    verified_context?: Record<string, any>;
    is_ready_to_send?: boolean;
    validation_warnings?: string[];
    suggested_follow_ups?: string[];
    company_signature?: string;
    meta?: Record<string, any>;
  };
  draft?: any;
  onSend?: (payload: any) => Promise<any>;
  onCancel?: () => void;
  onRegenerate?: (prompt?: string) => void;
}

export const EmailDraftCard: React.FC<EmailDraftCardProps> = ({ card, draft, onCancel, onRegenerate }) => {
  const c = card || draft || {};
  const [recipientEmail, setRecipientEmail] = useState(c.recipient_email || '');
  const [recipientName] = useState(c.recipient_name || '');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [ccInput, setCcInput] = useState((c.cc || []).join(', '));
  const [bccInput, setBccInput] = useState((c.bcc || []).join(', '));
  const [subject, setSubject] = useState(c.subject || '');
  const [body, setBody] = useState(c.body || '');

  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<EmailSendResponse | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  const bContext = c.verified_context || c.business_context || {};
  const docRef = bContext.document_reference || bContext.invoice_number || bContext.order_number || bContext.invoice;
  const custName = bContext.customer_name || bContext.customer || recipientName;
  const totalAmt = bContext.outstanding_amount || bContext.total_amount;
  const dueDate = bContext.due_date;

  const purposeLabels: Record<string, string> = {
    payment_reminder: 'Payment Reminder',
    invoice_followup: 'Invoice Follow-Up',
    sales_order_update: 'Sales Order Update',
    purchase_order: 'Purchase Order Inquiry',
    supplier_communication: 'Supplier Communication',
    customer_support: 'Customer Support',
    overdue_payment: 'Overdue Payment Notice',
    finance_team: 'Finance Team Notice',
    general: 'Business Communication',
  };

  const purposeTitle = purposeLabels[c.purpose || 'general'] || 'Business Communication';

  const validateEmail = (email: string) => {
    return /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(email.trim());
  };

  const handleSend = async () => {
    setSendError(null);
    const targetEmail = recipientEmail.trim();

    if (!targetEmail) {
      setSendError('Please enter a recipient email address.');
      return;
    }

    if (!validateEmail(targetEmail)) {
      setSendError(`'${targetEmail}' is not a valid email address.`);
      return;
    }

    if (!subject.trim()) {
      setSendError('Email subject cannot be empty.');
      return;
    }

    if (!body.trim()) {
      setSendError('Email body cannot be empty.');
      return;
    }

    setIsSending(true);

    const ccList = ccInput
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const bccList = bccInput
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    try {
      const res = await emailApi.sendEmail({
        draft_id: c.draft_id,
        recipient_email: targetEmail,
        recipient_name: recipientName.trim() || undefined,
        cc: ccList.length > 0 ? ccList : undefined,
        bcc: bccList.length > 0 ? bccList : undefined,
        subject: subject.trim(),
        body: body.trim(),
        purpose: c.purpose || 'general',
        record_type: c.meta?.record_type,
        record_id: c.meta?.record_id,
        business_context: bContext,
        confirmed: true, // Explicit confirmation as mandated
      });
      setSendResult(res);
    } catch (err: any) {
      console.error('Email send failed:', err);
      const detail = err.response?.data?.detail || err.message || 'Failed to dispatch email via provider.';
      setSendError(detail);
    } finally {
      setIsSending(false);
    }
  };

  if (isCancelled) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-500 italic flex items-center justify-between">
        <span>Email draft was cancelled.</span>
        <button
          onClick={() => setIsCancelled(false)}
          className="text-indigo-600 font-semibold hover:underline text-[11px] cursor-pointer"
        >
          Restore Draft
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-200/90 bg-white shadow-xs overflow-hidden mt-2 text-slate-800 transition-all">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-3.5 py-2.5 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-xs">
            <Mail size={15} />
          </div>
          <div>
            <div className="text-[12.5px] font-bold leading-tight flex items-center gap-1.5">
              <span>{purposeTitle}</span>
              <span className="rounded-full bg-white/25 px-2 py-0.2 text-[9.5px] font-semibold text-white/95">
                Draft
              </span>
            </div>
            <div className="text-[10px] text-indigo-100/90">
              Verified from live SAP business records
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setIsCancelled(true);
            onCancel?.();
          }}
          className="p-1 hover:bg-white/20 rounded-md transition text-white/80 hover:text-white cursor-pointer"
          title="Dismiss / Cancel Draft"
        >
          <X size={15} />
        </button>
      </div>

      {/* Verified Business Context Summary Pill */}
      {(custName || docRef || totalAmt || dueDate) && (
        <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50/70 border-b border-indigo-100/80 px-3.5 py-2">
          <div className="text-[9.5px] font-bold text-indigo-900 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Sparkles size={11} className="text-indigo-600" />
            Verified Record Context:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {custName && (
              <div className="flex items-start gap-1">
                <Building size={12} className="text-indigo-500 mt-0.5 shrink-0" />
                <div className="truncate">
                  <span className="text-slate-400 text-[9px] block">Customer / Vendor</span>
                  <span className="font-semibold text-slate-800 truncate block" title={custName}>
                    {custName}
                  </span>
                </div>
              </div>
            )}
            {docRef && (
              <div className="flex items-start gap-1">
                <FileText size={12} className="text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 text-[9px] block">Document Ref</span>
                  <span className="font-bold text-blue-900 font-mono text-[11px] block">{docRef}</span>
                </div>
              </div>
            )}
            {totalAmt && (
              <div className="flex items-start gap-1">
                <DollarSign size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 text-[9px] block">Outstanding</span>
                  <span className="font-bold text-emerald-800 text-[11px] block">{totalAmt}</span>
                </div>
              </div>
            )}
            {dueDate && (
              <div className="flex items-start gap-1">
                <Calendar size={12} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 text-[9px] block">Due Date</span>
                  <span className="font-semibold text-slate-800 text-[11px] block">{dueDate}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {Array.isArray(c.validation_warnings) && c.validation_warnings.length > 0 && (
        <div className="mx-3.5 mt-2.5 rounded-xl border border-amber-200 bg-amber-50/90 p-2.5 text-[11px] text-amber-900 flex items-start gap-2 shadow-2xs">
          <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {c.validation_warnings.map((w: string, idx: number) => (
              <div key={idx} className="font-medium">
                {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Follow-Ups */}
      {Array.isArray(c.suggested_follow_ups) && c.suggested_follow_ups.length > 0 && (
        <div className="mx-3.5 mt-2 flex flex-wrap gap-1">
          {c.suggested_follow_ups.map((f: string, idx: number) => (
            <span
              key={idx}
              className="rounded-lg bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 text-[10.5px] font-medium text-indigo-800"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Form Fields */}
      <div className="p-3.5 space-y-2.5 text-[12px]">
        {/* Recipient To: */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-slate-600 font-semibold text-[11px]">
            <label htmlFor={`to-${c.draft_id}`}>To (Recipient Email):</label>
            <button
              type="button"
              onClick={() => setShowCcBcc(!showCcBcc)}
              className="text-indigo-600 hover:text-indigo-800 font-medium text-[10.5px] flex items-center gap-0.5 cursor-pointer"
            >
              <span>{showCcBcc ? 'Hide CC/BCC' : 'Add CC/BCC'}</span>
              {showCcBcc ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          <div className="relative">
            <input
              id={`to-${c.draft_id}`}
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="e.g. accounts@customer.com"
              className={`w-full rounded-xl border px-3 py-1.5 text-[12.5px] outline-none transition focus:ring-2 ${
                recipientEmail && !validateEmail(recipientEmail)
                  ? 'border-rose-300 bg-rose-50/40 focus:ring-rose-200'
                  : 'border-slate-200 bg-slate-50/60 focus:border-indigo-400 focus:bg-white focus:ring-indigo-100'
              }`}
            />
            {recipientEmail && validateEmail(recipientEmail) && (
              <span className="absolute right-2.5 top-2 text-emerald-600" title="Valid email format">
                <Check size={14} />
              </span>
            )}
          </div>
        </div>

        {/* Collapsible CC / BCC */}
        {showCcBcc && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div>
              <label className="text-slate-500 font-semibold text-[10.5px] block mb-0.5">
                CC (comma separated):
              </label>
              <input
                type="text"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                placeholder="finance@atlas.local, accounts@partner.com"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1 text-[11.5px] outline-none focus:border-indigo-400 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-slate-500 font-semibold text-[10.5px] block mb-0.5">
                BCC (comma separated):
              </label>
              <input
                type="text"
                value={bccInput}
                onChange={(e) => setBccInput(e.target.value)}
                placeholder="audit-trail@atlas.local"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1 text-[11.5px] outline-none focus:border-indigo-400 focus:bg-white"
              />
            </div>
          </div>
        )}

        {/* Subject */}
        <div>
          <label htmlFor={`subject-${c.draft_id}`} className="text-slate-600 font-semibold text-[11px] block mb-1">
            Subject:
          </label>
          <input
            id={`subject-${c.draft_id}`}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[12.5px] font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Body Textarea */}
        <div>
          <label htmlFor={`body-${c.draft_id}`} className="text-slate-600 font-semibold text-[11px] block mb-1">
            Email Body (Editable):
          </label>
          <textarea
            id={`body-${c.draft_id}`}
            rows={7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[12px] font-normal leading-relaxed text-slate-800 outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 resize-y"
          />
        </div>
      </div>

      {/* Result / Error Banner */}
      {sendError && (
        <div className="mx-3.5 mb-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-900 flex items-start gap-2 shadow-2xs">
          <ShieldAlert size={15} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Delivery Notice: </span>
            <span>{sendError}</span>
          </div>
        </div>
      )}

      {sendResult && (
        <div className="mx-3.5 mb-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-[11px] text-emerald-950 space-y-1 shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold text-emerald-800">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>Email Accepted by Delivery Provider</span>
          </div>
          <div className="text-[10.5px] text-emerald-800/90 space-y-0.5 pt-0.5">
            <div>
              Provider: <span className="font-semibold uppercase">{sendResult.provider}</span> ({sendResult.status})
            </div>
            {sendResult.message_id && (
              <div className="truncate font-mono text-[9.5px]">
                Message ID: <span className="font-semibold">{sendResult.message_id}</span>
              </div>
            )}
            <div className="text-[9.5px] text-emerald-700">
              Audit log saved to PostgreSQL system registry ({new Date(sendResult.sent_at).toLocaleTimeString()}).
            </div>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="bg-slate-50/90 border-t border-slate-100 px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCancelled(true)}
            disabled={isSending || !!sendResult}
            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-3 py-1.5 text-[11.5px] font-semibold text-slate-600 transition cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          {onRegenerate && !sendResult && (
            <button
              type="button"
              onClick={() => onRegenerate('Please regenerate with a firmer and more concise tone')}
              disabled={isSending}
              className="rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 disabled:opacity-40"
              title="Ask AI to regenerate draft"
            >
              <RotateCcw size={12} />
              <span>Regenerate</span>
            </button>
          )}
        </div>

        <div>
          {sendResult ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[11.5px] font-bold">
              <CheckCircle2 size={13} />
              Sent Successfully
            </span>
          ) : (
            <button
              id="confirm-send-email-btn"
              data-testid="confirm-send-email-btn"
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold px-4 py-1.5 text-[12px] shadow-xs hover:shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sending via Provider...</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Confirm & Send Email</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
