import { useEffect, useState } from 'react';
import AsciiRain from './components/originkit/ui/ascii-rain';

export default function App() {
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  if (reducedMotion) return null;
  return (
    <AsciiRain
      headColor="#675580"
      trailColor="#9b95b4"
      glyphSize={12}
      density={23}
      speed={3.1}
      trail={12}
      glyphs="0123456789ABCDEF:."
      shuffle={false}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
