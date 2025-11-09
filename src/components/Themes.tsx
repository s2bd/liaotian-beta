// src/components/Themes.tsx
import { CheckCircle } from 'lucide-react';
import { Profile } from '../lib/supabase';

interface ThemePreset {
  value: string;
  name: string;
  desc: string;
}

const presets: ThemePreset[] = [
  { value: 'lt-classic', name: 'LT Classic', desc: 'Fiery orange and reds (default)' },
  { value: 'lt-dark', name: 'LT Dark', desc: 'Dark mode with inverted colors' },
  { value: 'muxday', name: 'MuxDay', desc: 'Blue analogous shades' },
  { value: 'amrella', name: 'Amrella', desc: 'Green analogous shades' },
];

interface ThemesProps {
  currentTheme: string;
  onChange: (theme: string) => void;
  loading?: boolean;
}

export const Themes = ({ currentTheme, onChange, loading }: ThemesProps) => {
  return (
    <div className="space-y-2">
      {presets.map((preset) => (
        <div
          key={preset.value}
          className={`p-3 rounded-lg cursor-pointer transition-all border ${
            currentTheme === preset.value
              ? 'bg-blue-50 border-blue-200'
              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
          }`}
          onClick={() => !loading && onChange(preset.value)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{preset.name}</h4>
              <p className="text-sm text-gray-600">{preset.desc}</p>
            </div>
            {currentTheme === preset.value && <CheckCircle size={16} className="text-blue-500" />}
          </div>
        </div>
      ))}
    </div>
  );
};
