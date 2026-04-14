import { IS_PREVIEW } from './config.js';
import AppDefault from './AppDefault.jsx';
import AppPreview from './AppPreview.jsx';

export default function App() {
  return IS_PREVIEW ? <AppPreview /> : <AppDefault />;
}
