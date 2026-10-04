import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './foundation/tokens.css';
import './ui/ui.css';
import './screens/screens.css';
import './hud.css';
import './tasks/tasks.css';
import './screens/overlays.css';
import './screens/menus.css';
import './mobile.css';
import './compact.css';

// /?tasks and /?screens open developer preview pages instead of the game.
const q = new URLSearchParams(window.location.search);
if (q.has('tasks')) {
  import('./tasks/Gallery.jsx').then(({ default: Gallery }) => createRoot(document.getElementById('root')).render(<Gallery />));
} else if (q.has('screens')) {
  import('./screens/Preview.jsx').then(({ default: Preview }) => createRoot(document.getElementById('root')).render(<Preview />));
} else {
  createRoot(document.getElementById('root')).render(<App />);
}
