import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractConciseSummary } from './useSpeechSynthesis';

describe('useSpeechSynthesis and extractConciseSummary', () => {
  let mockSpeechSynthesis: any;

  beforeEach(() => {
    class MockSpeechSynthesisUtterance {
      text: string;
      lang: string = 'en-IN';
      rate: number = 1.0;
      pitch: number = 1.0;
      onstart: any = null;
      onend: any = null;
      onerror: any = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    mockSpeechSynthesis = {
      speaking: false,
      paused: false,
      speak: vi.fn((u) => {
        mockSpeechSynthesis.speaking = true;
        if (u.onstart) u.onstart();
      }),
      cancel: vi.fn(() => {
        mockSpeechSynthesis.speaking = false;
      }),
      getVoices: vi.fn(() => [
        { name: 'Google English', lang: 'en-IN' },
        { name: 'Google Hindi', lang: 'hi-IN' },
      ]),
    };

    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.speechSynthesis = mockSpeechSynthesis;
    (globalThis as any).window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  });

  afterEach(() => {
    delete (globalThis as any).window?.speechSynthesis;
    delete (globalThis as any).window?.SpeechSynthesisUtterance;
    vi.restoreAllMocks();
  });

  describe('extractConciseSummary Text Sanitizer', () => {
    it('strips markdown tables completely so TTS does not read column pipes or borders', () => {
      const raw =
        'Here is the current sales overview:\n\n' +
        '| Product | Quantity | Amount |\n' +
        '| --- | --- | --- |\n' +
        '| Steel Rods | 120 | 45000 |\n' +
        '| Iron Sheets | 80 | 32000 |\n\n' +
        'All orders have been dispatched.';

      const summary = extractConciseSummary(raw);
      expect(summary).not.toContain('|');
      expect(summary).not.toContain('Steel Rods');
      expect(summary).toContain('Here is the current sales overview: All orders have been dispatched.');
    });

    it('strips markdown code blocks and inline code', () => {
      const raw = 'Check the result below: ```json\n{"status": "ok"}\n``` and check `invoice_id`.';
      const summary = extractConciseSummary(raw);
      expect(summary).not.toContain('json');
      expect(summary).not.toContain('{');
      expect(summary).toContain('invoice_id');
      expect(summary).not.toContain('`');
    });

    it('strips markdown links and headers', () => {
      const raw = '### Monthly Overview\nPlease review the [Invoices Page](/finance/purchase-invoices) for details.';
      const summary = extractConciseSummary(raw);
      expect(summary).not.toContain('###');
      expect(summary).not.toContain('(/finance/purchase-invoices)');
      expect(summary).toContain('Monthly Overview Please review the Invoices Page for details.');
    });

    it('truncates overly long responses to concise summary within 280 characters', () => {
      const longSentence =
        'We analyzed your outstanding receivables for October. ' +
        'Total pending amount across 14 suppliers is INR 4,500,000. ' +
        'The highest outstanding is with Acme Corp for INR 850,000. ' +
        'Additional 25 invoices are due in the next 14 days. ' +
        'You can view individual ledger reports in the finance module.';

      const summary = extractConciseSummary(longSentence, 150);
      expect(summary.length).toBeLessThanOrEqual(160);
      expect(summary).toContain('We analyzed your outstanding receivables for October.');
    });

    it('handles empty or undefined string safely', () => {
      expect(extractConciseSummary('')).toBe('');
      expect(extractConciseSummary(null as any)).toBe('');
    });
  });

  describe('Speech Synthesis Voice Control', () => {
    it('initiates speech synthesis with sanitized concise text and selected language', () => {
      const textToSpeak = extractConciseSummary('Sales total for today is INR 125,000 across 34 orders.');
      const utterance = new (window as any).SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);

      expect(window.speechSynthesis.speak).toHaveBeenCalledWith(utterance);
      expect(utterance.text).toBe('Sales total for today is INR 125,000 across 34 orders.');
      expect(utterance.lang).toBe('en-IN');
    });

    it('cancels speech playback when stop is triggered', () => {
      window.speechSynthesis.cancel();
      expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(1);
    });

    it('matches available voice matching the selected language', () => {
      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find((v: any) => v.lang === 'hi-IN');
      expect(hindiVoice).toBeDefined();
      expect(hindiVoice?.name).toBe('Google Hindi');
    });
  });
});
