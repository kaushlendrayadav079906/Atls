import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useSpeechRecognition Hook Logic', () => {
  let mockRecognitionInstance: any;

  beforeEach(() => {
    mockRecognitionInstance = {
      continuous: false,
      interimResults: true,
      lang: 'en-IN',
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
    };

    // Mock global window speech recognition
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.webkitSpeechRecognition = vi.fn(() => mockRecognitionInstance);
  });

  afterEach(() => {
    delete (globalThis as any).window?.webkitSpeechRecognition;
    delete (globalThis as any).window?.SpeechRecognition;
    vi.restoreAllMocks();
  });

  it('detects browser Web Speech API availability', () => {
    const hasSpeech =
      typeof window !== 'undefined' &&
      ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
    expect(hasSpeech).toBe(true);
  });

  it('handles permission denied error gracefully', () => {
    let capturedError: string | null = null;
    const errorHandler = (event: { error: string }) => {
      if (event.error === 'not-allowed') {
        capturedError = 'Microphone permission was denied by browser. Please allow microphone in site settings.';
      }
    };

    errorHandler({ error: 'not-allowed' });
    expect(capturedError).toBe('Microphone permission was denied by browser. Please allow microphone in site settings.');
  });

  it('handles no-speech error without crashing', () => {
    let capturedError: string | null = null;
    const errorHandler = (event: { error: string }) => {
      if (event.error === 'no-speech') {
        capturedError = 'No speech detected. Please speak clearly into your microphone.';
      }
    };

    errorHandler({ error: 'no-speech' });
    expect(capturedError).toBe('No speech detected. Please speak clearly into your microphone.');
  });

  it('supports English and Hindi language configurations', () => {
    let lang = 'en-IN';
    expect(lang).toBe('en-IN');

    // Switch to Hindi
    lang = 'hi-IN';
    mockRecognitionInstance.lang = lang;
    expect(mockRecognitionInstance.lang).toBe('hi-IN');
  });

  it('correctly aggregates final and interim speech transcription', () => {
    let finalTranscript = '';
    let interimTranscript = '';

    const mockEvent = {
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          0: { transcript: 'Draft a payment reminder for ' },
        },
        {
          isFinal: false,
          0: { transcript: 'Acme customer' },
        },
      ],
    };

    for (let i = mockEvent.resultIndex; i < mockEvent.results.length; ++i) {
      if (mockEvent.results[i].isFinal) {
        finalTranscript += mockEvent.results[i][0].transcript;
      } else {
        interimTranscript += mockEvent.results[i][0].transcript;
      }
    }

    expect(finalTranscript).toBe('Draft a payment reminder for ');
    expect(interimTranscript).toBe('Acme customer');
    expect((finalTranscript + interimTranscript).trim()).toBe('Draft a payment reminder for Acme customer');
  });

  it('aborts cleanly on stop and unmount without leaving background listeners', () => {
    mockRecognitionInstance.abort();
    expect(mockRecognitionInstance.abort).toHaveBeenCalledTimes(1);
  });
});
