import { useState, useRef, useCallback } from 'react';

export function useSpeech(lang = 'pl-PL') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const finalTextRef = useRef('');
  const finalCountRef = useRef(0);

  const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const start = useCallback(() => {
    if (!isSupported) {
      setError('Twoja przeglądarka nie obsługuje rozpoznawania mowy.');
      return;
    }
    finalTextRef.current = '';
    finalCountRef.current = 0;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      // Only add results that haven't been finalized yet
      for (let i = finalCountRef.current; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTextRef.current += event.results[i][0].transcript + ' ';
          finalCountRef.current = i + 1;
        }
      }

      // Show current interim text (everything after last final)
      let interimText = '';
      for (let i = finalCountRef.current; i < event.results.length; i++) {
        if (!event.results[i].isFinal) {
          interimText += event.results[i][0].transcript;
        }
      }

      setTranscript(finalTextRef.current + interimText);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        setError(`Błąd: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [lang, isSupported]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    finalTextRef.current = '';
    finalCountRef.current = 0;
    setTranscript('');
    setError(null);
  }, []);

  return { isListening, transcript, error, isSupported, start, stop, reset };
}
