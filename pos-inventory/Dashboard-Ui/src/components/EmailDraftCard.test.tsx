import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmailDraftCard } from './EmailDraftCard';
import type { EmailDraftResponse } from '../api/endpoints';

describe('EmailDraftCard Component', () => {
  const mockDraft: EmailDraftResponse = {
    draft_id: 'draft-test-123',
    purpose: 'payment_reminder',
    recipient_email: 'accounts@acmecorp.com',
    recipient_name: 'Acme Corporation',
    cc: ['finance@atlas.local'],
    subject: 'Payment Reminder — Invoice INV-2026-0089',
    body: 'Dear Acme Corporation,\n\nWe are following up regarding invoice INV-2026-0089 with an outstanding amount of INR 45,000.00 due on 2026-11-01.\n\nThank you,\nFinance Department',
    verified_context: {
      customer: 'Acme Corporation',
      invoice: 'INV-2026-0089',
      outstanding_amount: 'INR 45,000.00',
      due_date: '2026-11-01',
      suggested_next_action: 'Send friendly payment follow-up',
    },
    suggested_follow_ups: [
      'Did customer reply?',
      'Show payment history',
    ],
    validation_warnings: [],
  };

  it('renders verified business context pills properly', () => {
    const html = renderToStaticMarkup(
      <EmailDraftCard draft={mockDraft} />
    );

    expect(html).toContain('Acme Corporation');
    expect(html).toContain('INV-2026-0089');
    expect(html).toContain('INR 45,000.00');
    expect(html).toContain('2026-11-01');
    expect(html).toContain('Payment Reminder');
    expect(html).toContain('Verified from live SAP business records');
  });

  it('renders recipient, subject, and body input fields', () => {
    const html = renderToStaticMarkup(
      <EmailDraftCard draft={mockDraft} />
    );

    expect(html).toContain('accounts@acmecorp.com');
    expect(html).toContain('Payment Reminder — Invoice INV-2026-0089');
    expect(html).toContain('We are following up regarding invoice INV-2026-0089');
    expect(html).toContain('Add CC/BCC');
  });

  it('renders action buttons: Confirm & Send Email, Regenerate, Cancel', () => {
    const html = renderToStaticMarkup(
      <EmailDraftCard draft={mockDraft} onRegenerate={vi.fn()} onCancel={vi.fn()} />
    );

    expect(html).toContain('Confirm &amp; Send Email');
    expect(html).toContain('Regenerate');
    expect(html).toContain('Cancel');
  });

  it('renders validation warnings when recipient email is missing or unverified', () => {
    const draftWithWarning: EmailDraftResponse = {
      ...mockDraft,
      recipient_email: '',
      validation_warnings: [
        'Recipient email address is missing or unverified. Please enter a valid recipient email before sending.',
      ],
    };

    const html = renderToStaticMarkup(
      <EmailDraftCard draft={draftWithWarning} />
    );

    expect(html).toContain('Recipient email address is missing or unverified');
    expect(html).toContain('border-amber-200');
  });

  it('renders cancel action properly', () => {
    const html = renderToStaticMarkup(
      <EmailDraftCard draft={mockDraft} onCancel={vi.fn()} />
    );

    expect(html).toContain('Cancel');
    expect(html).toContain('Dismiss / Cancel Draft');
  });

  it('renders suggested follow-up chips when provided', () => {
    const html = renderToStaticMarkup(
      <EmailDraftCard draft={mockDraft} />
    );

    expect(html).toContain('Did customer reply?');
    expect(html).toContain('Show payment history');
  });
});
