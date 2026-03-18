import { useState, useRef, useCallback } from 'react';

export function useSpeech(lang = 'pl-PL') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const finalTextRef = useRef('');
  const shouldListenRef = useRef(false);

  const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  function createAndStart() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTextRef.current += event.results[i][0].transcript + ' ';
        } else {
          interimText += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTextRef.current + interimText);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      shouldListenRef.current = false;
      setError(`Błąd: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        // Auto-restart after each phrase
        try { recognition.start(); } catch {}
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  const start = useCallback(() => {
    if (!isSupported) {
      setError('Twoja przeglądarka nie obsługuje rozpoznawania mowy.');
      return;
    }
    finalTextRef.current = '';
    shouldListenRef.current = true;
    setTranscript('');
    createAndStart();
  }, [lang, isSupported]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  }, []);

  const reset = useCallback(() => {
    finalTextRef.current = '';
    setTranscript('');
    setError(null);
  }, []);

  return { isListening, transcript, error, isSupported, start, stop, reset };
}
