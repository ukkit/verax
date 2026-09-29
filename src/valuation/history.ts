import { getHistory, type NavPoint } from '../nav';
import { memoised } from './memo';

const load = memoised(([code, start]: readonly [number, string]) => getHistory(code, start), ([code, start]) => `${code}|${start}`);

/** NAV history of a scheme from `start`, cached for the session by scheme code and start date. */
export const history = (schemeCode: number, start: string): Promise<NavPoint[]> => load([schemeCode, start]);
