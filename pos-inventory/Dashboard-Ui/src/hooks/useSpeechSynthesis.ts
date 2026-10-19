import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Strips markdown tables, code blocks, raw JSON, and formats text
 * into a concise conversational summary suitable for text-to-speech.
 */
export function extractConciseSummary(rawText: string, maxLength: number = 280): string {
  if (!rawText) return '';

  let cleaned = rawText
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove markdown inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown tables (| cell | cell |)
    .replace(/\|[^\n]+\|/g, '')
    // Remove markdown headers (# Title)
    .replace(/^#+\s+/gm, '')
    // Remove markdown bold/italic
    .replace(/(\*\*|\*|__|_)(.*?)\1/g, '$2')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Replace multiple newlines or tabs with a single space
    .replace(/\s+/g, ' ')
    .trim();

  // If text is still long, speak the first 2-3 sentences within maxLength
  if (cleaned.length > maxLength) {
    const sentences = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g);
    if (sentences && sentences.length > 0) {
      let accum = '';
      for (const s of sentences) {
        if ((accum + s).length <= maxLength) {
          accum += s;
        } else {
          break;
        }
      }
      cleaned = accum.trim() || cleaned.slice(0, maxLength) + '...';
    } else {
      cleaned = cleaned.slice(0, maxLength) + '...';
    }
  }

  return cleaned;
}

export interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  speakingIndex: number | null;
  speak: (text: string, index?: number, lang?: string) => void;
  stop: () => void;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      setIsSupported(true);
    }
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore synthesis cancel errors
      }
    }
    setIsSpeaking(false);
    setSpeakingIndex(null);
  }, []);

  // Stop synthesis on component unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const speak = useCallback(
    (rawText: string, index?: number, lang: string = 'en-IN') => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      // If already speaking this message index, clicking again acts as pause/stop
      if (isSpeaking && speakingIndex !== null && speakingIndex === index) {
        stop();
        return;
      }

      stop();

      const summary = extractConciseSummary(rawText);
      if (!summary) return;

      try {
        const utterance = new SpeechSynthesisUtterance(summary);
        utterance.lang = lang;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to pick a matching language voice if available
        const voices = window.speechSynthesis.getVoices?.() || [];
        const matchedVoice = voices.find((v) => v.lang === lang || v.lang.startsWith(lang.split('-')[0]));
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
          setSpeakingIndex(index !== undefined ? index : null);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          setSpeakingIndex(null);
        };

        utterance.onerror = (e) => {
          // If canceled deliberately, ignore error
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            console.warn('Speech synthesis error:', e);
          }
          setIsSpeaking(false);
          setSpeakingIndex(null);
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Failed to start speech synthesis:', err);
        setIsSpeaking(false);
        setSpeakingIndex(null);
      }
    },
    [isSpeaking, speakingIndex, stop]
  );

  return {
    isSupported,
    isSpeaking,
    speakingIndex,
    speak,
    stop,
  };
}
