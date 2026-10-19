import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  defaultLanguage?: string;
}

export const useSpeechRecognition = (options: UseSpeechRecognitionOptions = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [language, setLanguage] = useState(options.defaultLanguage || 'en-IN');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Check browser support for Web Speech API
  const isSupported = typeof window !== 'undefined' && Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setInterimTranscript('');
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      options.onError?.('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            currentFinal += item[0].transcript;
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (currentFinal) {
          setTranscript((prev) => (prev ? prev + ' ' + currentFinal : currentFinal));
          setInterimTranscript('');
        } else {
          setInterimTranscript(currentInterim);
        }
        options.onResult?.(currentFinal || currentInterim, Boolean(currentFinal));
      };

      recognition.onerror = (event: any) => {
        let errMsg = 'Speech recognition encountered an issue.';
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          errMsg = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
        } else if (event.error === 'no-speech') {
          errMsg = 'No speech was detected. Please try speaking into your microphone.';
        } else if (event.error === 'network') {
          errMsg = 'Network communication error during speech recognition.';
        } else if (event.error === 'audio-capture') {
          errMsg = 'No microphone was found. Please ensure a microphone is connected.';
        }

        setError(errMsg);
        options.onError?.(errMsg);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      const msg = err.message || 'Failed to start speech recognition.';
      setError(msg);
      options.onError?.(msg);
      setIsListening(false);
    }
  }, [isSupported, language, options]);

  // Clean up on unmount or navigation
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    language,
    setLanguage,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
};
