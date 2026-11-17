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
      headColor="#7463a7"
      trailColor="#a39ac1"
      glyphSize={13}
      density={27}
      speed={4.5}
      trail={14}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
