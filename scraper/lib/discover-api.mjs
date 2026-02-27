import { getSession } from './api.mjs';
import { logProgress } from './progress.mjs';

export async function discoverApi(state) {
  if (state.discoveredApi && state.sessionId) {
    logProgress(1, 'API session already exists, skipping discovery.');
    return state.discoveredApi;
  }

  logProgress(1, 'Connecting to BookManager API...');
  const sessionId = await getSession();
  logProgress(1, `Session acquired: ${sessionId.substring(0, 10)}...`);

  state.sessionId = sessionId;

  const config = {
    apiBase: 'https://api.bookmanager.com/customer',
    storeId: '168749',
    cb: '7603827',
    sessionId,
  };

  logProgress(1, 'API discovery complete.');
  return config;
}
