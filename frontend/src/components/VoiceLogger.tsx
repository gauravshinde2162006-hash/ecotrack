/**
 * VoiceLogger — browser-native Web Speech API voice command handler
 * No API key needed. Works in Chrome, Edge, Safari.
 *
 * Supported voice commands (examples):
 *   "log 30 km car petrol"
 *   "log 2 kWh electricity"
 *   "log vegetarian diet"
 *   "log 0.5 cylinder lpg"
 *   "log 3 kg landfill waste"
 *   "what is my footprint" → opens dashboard
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, X, Volume2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { submitLog, computeCO2e } from '../api';

/* ── Type declaration for Web Speech API (not in TS lib by default) ── */
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

/* ── Voice command pattern matchers ── */
interface ParsedCommand {
  category: string;
  subtype: string;
  quantity: number;
  unit: string;
}

const COMMAND_PATTERNS: Array<{
  pattern: RegExp;
  category: string;
  subtype: (m: RegExpMatchArray) => string;
  quantity: (m: RegExpMatchArray) => number;
  unit: string;
}> = [
  // Transport: "log 30 km car petrol" / "30 kilometres motorcycle"
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:km|kilometers?|kilometres?|k)\s+(?:by\s+)?(car\s*petrol|petrol\s*car|car)/i,
    category: 'transport', subtype: () => 'car_petrol', quantity: m => parseFloat(m[1]), unit: 'km',
  },
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:km|kilometers?|kilometres?|k)\s+(?:by\s+)?(car\s*diesel|diesel\s*car)/i,
    category: 'transport', subtype: () => 'car_diesel', quantity: m => parseFloat(m[1]), unit: 'km',
  },
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:km|kilometers?|kilometres?|k)\s+(?:by\s+)?bus/i,
    category: 'transport', subtype: () => 'bus', quantity: m => parseFloat(m[1]), unit: 'km',
  },
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:km|kilometers?|kilometres?|k)\s+(?:by\s+)?train/i,
    category: 'transport', subtype: () => 'train', quantity: m => parseFloat(m[1]), unit: 'km',
  },
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:km|kilometers?|kilometres?|k)\s+(?:by\s+)?(?:motorcycle|bike\s*motor|moto)/i,
    category: 'transport', subtype: () => 'motorcycle', quantity: m => parseFloat(m[1]), unit: 'km',
  },
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:km|kilometers?|kilometres?|k)\s+(?:by\s+)?(?:bicycle|cycling|cycle|bike)/i,
    category: 'transport', subtype: () => 'bike', quantity: m => parseFloat(m[1]), unit: 'km',
  },
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:km|kilometers?|kilometres?|k)\s+(?:by\s+)?(?:walk(?:ing)?|foot)/i,
    category: 'transport', subtype: () => 'walk', quantity: m => parseFloat(m[1]), unit: 'km',
  },
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:km|kilometers?|kilometres?|k)\s+(?:by\s+)?(?:flight|fly|airplane|plane)/i,
    category: 'transport', subtype: () => 'flight_short', quantity: m => parseFloat(m[1]), unit: 'km',
  },
  // Electricity: "log 2 kWh electricity" / "5 units power"
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:kwh|kilo\s*watt|units?|kw)\s+(?:electricity|power|electric)/i,
    category: 'electricity', subtype: () => 'india_grid', quantity: m => parseFloat(m[1]), unit: 'kWh',
  },
  // Diet: "log vegetarian diet" / "ate non-vegetarian today" / "vegan day"
  {
    pattern: /(?:log\s+)?(?:(\d+\.?\d*)\s+)?(?:days?\s+)?(?:ate\s+|had\s+|eating\s+)?non[\s-]?veg(?:etarian)?(?:\s+diet|\s+food|\s+meal|\s+day)?/i,
    category: 'diet', subtype: () => 'non_vegetarian', quantity: () => 1, unit: 'days',
  },
  {
    pattern: /(?:log\s+)?(?:(\d+\.?\d*)\s+)?(?:days?\s+)?(?:ate\s+|had\s+|eating\s+)?vegetarian(?:\s+diet|\s+food|\s+meal|\s+day)?/i,
    category: 'diet', subtype: () => 'vegetarian', quantity: m => parseFloat(m[1] ?? '1') || 1, unit: 'days',
  },
  {
    pattern: /(?:log\s+)?(?:(\d+\.?\d*)\s+)?(?:days?\s+)?(?:ate\s+|had\s+|eating\s+)?vegan(?:\s+diet|\s+food|\s+meal|\s+day)?/i,
    category: 'diet', subtype: () => 'vegan', quantity: m => parseFloat(m[1] ?? '1') || 1, unit: 'days',
  },
  // LPG: "log 0.5 cylinder lpg" / "half cylinder gas"
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:cylinder|cylinders?|lpg|gas\s*cylinder)/i,
    category: 'lpg', subtype: () => 'cylinder', quantity: m => parseFloat(m[1]), unit: 'cylinders',
  },
  // Waste: "log 2 kg landfill waste" / "3 kg recycled"
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:kg|kilograms?)\s+(?:of\s+)?(?:landfill|garbage|trash)/i,
    category: 'waste', subtype: () => 'landfill', quantity: m => parseFloat(m[1]), unit: 'kg',
  },
  {
    pattern: /(?:log\s+)?(\d+\.?\d*)\s*(?:kg|kilograms?)\s+(?:of\s+)?recycl(?:ed|ing)/i,
    category: 'waste', subtype: () => 'recycled', quantity: m => parseFloat(m[1]), unit: 'kg',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  transport: '🚗 Transport', diet: '🍽️ Diet', electricity: '⚡ Electricity',
  lpg: '🔥 LPG', waste: '🗑️ Waste',
};

function parseVoiceCommand(text: string): ParsedCommand | null {
  for (const p of COMMAND_PATTERNS) {
    const match = text.match(p.pattern);
    if (match) {
      return {
        category: p.category,
        subtype: p.subtype(match),
        quantity: p.quantity(match),
        unit: p.unit,
      };
    }
  }
  return null;
}

/* ── Main component ── */
export default function VoiceLogger() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [show, setShow] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-IN'; // India English for better accent recognition

    rec.onresult = (event: any) => {
      const current = Array.from(event.results as any[])
        .map((r: any) => r[0].transcript)
        .join('');
      setTranscript(current);

      // Only process final results
      if (event.results[event.results.length - 1].isFinal) {
        handleFinalTranscript(current);
      }
    };

    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      console.warn('[Voice] Error:', e.error);
      setListening(false);
      if (e.error !== 'no-speech') {
        toast.error(`Voice error: ${e.error}`, { id: 'voice-error' });
      }
    };

    recognitionRef.current = rec;
  }, []);

  const handleFinalTranscript = useCallback(async (text: string) => {
    const parsed = parseVoiceCommand(text);
    if (!parsed) {
      toast.error(`Didn't understand: "${text}"\nTry: "log 30km car petrol"`, {
        id: 'voice-parse-error', duration: 4000,
      });
      return;
    }

    const { category, subtype, quantity, unit } = parsed;
    const co2e = computeCO2e(category, subtype, quantity);
    const today = new Date().toISOString().split('T')[0];

    const loadingToast = toast.loading(
      `🎙️ Logging ${quantity} ${unit} ${category}...`, { id: 'voice-logging' }
    );

    try {
      await submitLog({ date: today, category, subtype, quantity });
      toast.success(
        `${CATEGORY_LABELS[category]}\n${quantity} ${unit} → ${co2e.toFixed(3)} kg CO₂e logged ✅`,
        { id: loadingToast, duration: 5000 }
      );
      setTranscript('');
    } catch (err: any) {
      toast.error(`Failed to log: ${err.message}`, { id: loadingToast });
    }
  }, []);

  const startListening = () => {
    if (!recognitionRef.current || listening) return;
    setTranscript('');
    setListening(true);
    recognitionRef.current.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  if (!supported) return null;

  return (
    <>
      {/* Toast container */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(24,24,27,0.95)',
            color: '#f4f4f5',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            backdropFilter: 'blur(16px)',
            fontSize: '13px',
            maxWidth: '320px',
            whiteSpace: 'pre-line',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#f43f5e', secondary: '#fff' } },
        }}
      />

      {/* Floating voice button */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
        {/* Transcript bubble */}
        {(listening || transcript) && (
          <div className="glass-card px-4 py-3 max-w-[260px] animate-slide-up">
            <div className="flex items-center gap-2 mb-1">
              <Volume2 size={12} className="text-eco-400 animate-pulse" />
              <span className="text-[11px] text-carbon-400 font-medium">Listening…</span>
            </div>
            <p className="text-xs text-carbon-200 italic min-h-[16px]">
              {transcript || '...'}
            </p>
            <p className="text-[10px] text-carbon-500 mt-1">
              Try: "log 30km car petrol"
            </p>
          </div>
        )}

        {/* Help panel */}
        {show && !listening && (
          <div className="glass-card p-4 w-64 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-carbon-200">🎙️ Voice Commands</span>
              <button onClick={() => setShow(false)} className="text-carbon-500 hover:text-carbon-300">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 text-[11px] text-carbon-400">
              {[
                ['Transport', '"log 30km car petrol"'],
                ['Transport', '"15km by train"'],
                ['Electricity', '"log 5 kWh electricity"'],
                ['Diet', '"ate vegetarian today"'],
                ['LPG', '"log 0.5 cylinder lpg"'],
                ['Waste', '"2 kg landfill waste"'],
              ].map(([cat, ex]) => (
                <div key={ex} className="flex gap-2">
                  <span className="text-carbon-600 shrink-0">{cat}:</span>
                  <span className="text-eco-400 font-mono">{ex}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main mic button */}
        <div className="flex items-center gap-2">
          {!listening && (
            <button
              onClick={() => setShow(s => !s)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-carbon-500 hover:text-carbon-300 transition-colors"
              style={{ background: 'rgba(39,39,42,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
              title="Voice commands help"
            >
              <span className="text-xs">?</span>
            </button>
          )}

          <button
            onClick={listening ? stopListening : startListening}
            title={listening ? 'Stop listening' : 'Start voice logging'}
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: listening
                ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                : 'linear-gradient(135deg, #16a34a, #15803d)',
              border: 'none',
              boxShadow: listening
                ? '0 0 0 0 rgba(220,38,38,0.4), 0 0 24px rgba(220,38,38,0.5)'
                : '0 0 24px rgba(34,197,94,0.4)',
              animation: listening ? 'mic-pulse 1.2s ease-out infinite' : undefined,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            {listening
              ? <MicOff size={22} color="white" />
              : <Mic size={22} color="white" />
            }
          </button>
        </div>
      </div>

      {/* Mic pulse keyframe */}
      <style>{`
        @keyframes mic-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0.5), 0 0 24px rgba(220,38,38,0.4); }
          70%  { box-shadow: 0 0 0 20px rgba(220,38,38,0), 0 0 24px rgba(220,38,38,0.2); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0), 0 0 24px rgba(220,38,38,0.4); }
        }
      `}</style>
    </>
  );
}
