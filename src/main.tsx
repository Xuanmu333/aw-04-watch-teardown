import { createRoot } from 'react-dom/client';
import CursorRingField from './components/tpm/CursorRingField';
import './index.css';
import '../AW-04/main.js';

createRoot(document.getElementById('tpm-background')!).render(<CursorRingField />);
