import { useState, useCallback, useRef } from 'react';

const VOICE_CONFIGS = {
  'en-US': { lang: 'en-US', rate: 0.95, pitch: 1.0 },
  'ta-IN': { lang: 'ta-IN', rate: 0.9, pitch: 1.0 },
  'hi-IN': { lang: 'hi-IN', rate: 0.9, pitch: 1.0 },
  'ja-JP': { lang: 'ja-JP', rate: 0.85, pitch: 1.0 }
};

export const useMultiLanguageTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const activeAudioRef = useRef(null);

  const speak = useCallback((text, language = 'en-US') => {
    const synth = window.speechSynthesis;
    if (!synth) {
      console.warn("Speech synthesis not supported in this browser.");
      return;
    }

    // Stop any currently playing audio fallback or speech synthesis
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
      } catch (err) {
        console.error(err);
      }
      activeAudioRef.current = null;
    }
    synth.cancel();

    const config = VOICE_CONFIGS[language] || VOICE_CONFIGS['en-US'];
    const voices = synth.getVoices();
    const hasLocalVoice = voices.some(v => v.lang.toLowerCase().startsWith(config.lang.split('-')[0]) || v.lang.toLowerCase().includes(config.lang.split('-')[0]));

    if (hasLocalVoice) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = config.lang;
      utterance.rate = config.rate;
      utterance.pitch = config.pitch;
      utterance.volume = 0.9;

      const matchingVoice = voices.find(v => v.lang.startsWith(config.lang) || v.lang.includes(config.lang.split('-')[0]));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synth.speak(utterance);
    } else {
      const langCode = config.lang.split('-')[0];
      const encodedText = encodeURIComponent(text);
      const ttsUrl = `/api/tts?lang=${langCode}&text=${encodedText}`;
      
      const audio = new Audio(ttsUrl);

      activeAudioRef.current = audio;
      
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        activeAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        activeAudioRef.current = null;
      };
      
      audio.play().catch(err => {
        console.error("Audio Play Error:", err);
        setIsSpeaking(false);
      });
    }
  }, []);

  return { speak, isSpeaking };
};

