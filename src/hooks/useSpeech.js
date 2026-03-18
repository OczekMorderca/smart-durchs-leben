import { useState, useRef, useCallback } from 'react';

export function useSpeech(lang = 'pl-PL') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const finalTextRef = useRef('');

  const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const start = useCallback(() => {
    if (!isSupported) {
      setError('Twoja przeglądarka nie obsługuje rozpoznawania mowy.');
      return;
    }
    finalTextRef.current = '';

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
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTextRef.current += result[0].transcript;
        } else {
          interimText += result[0].transcript;
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
    setTranscript('');
    setError(null);
  }, []);

  return { isListening, transcript, error, isSupported, start, stop, reset };
}
