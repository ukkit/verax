import { createNavSource } from './navSource';

/** One NAV source for the whole session, so a lookup made for one profile or chart is not repeated for another. */
export const navSource = createNavSource();
