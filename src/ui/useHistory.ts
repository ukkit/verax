import { useEffect, useState } from 'preact/hooks';
import { NavError, type NavPoint } from '../nav';
import { history } from '../valuation/history';

export type HistoryState = { phase: 'loading' } | { phase: 'ready'; points: NavPoint[] } | { phase: 'error'; message: string };

/** NAV history for a scheme from `start`; reloads when either changes. */
export function useHistory(schemeCode: number, start: string): HistoryState {
  const [state, setState] = useState<HistoryState>({ phase: 'loading' });
  useEffect(() => {
    let current = true;
    setState({ phase: 'loading' });
    history(schemeCode, start).then(
      (points) => current && setState({ phase: 'ready', points }),
      (error) => {
        if (!(error instanceof NavError)) console.error('history_failed', { error });
        if (current) setState({ phase: 'error', message: error instanceof NavError ? error.message : 'Loading the NAV history failed unexpectedly. Reload the page and try again.' });
      },
    );
    return () => {
      current = false;
    };
  }, [schemeCode, start]);
  return state;
}
