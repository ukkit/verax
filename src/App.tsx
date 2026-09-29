import { useState } from 'preact/hooks';
import { formatInr, getFund, isSchemeCode, NavError, searchFunds, type Fund } from './nav';

export function App() {
  const [query, setQuery] = useState('119551');
  const [funds, setFunds] = useState<Fund[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function lookup(event: Event) {
    event.preventDefault();
    const input = query.trim();
    if (!input) return;
    setStatus('loading');
    setMessage('');
    try {
      const found = isSchemeCode(input) ? [await getFund(Number(input))] : (await searchFunds(input)).results;
      setFunds(found);
      setStatus('idle');
      if (found.length === 0) setMessage('No funds matched.');
    } catch (err) {
      setFunds([]);
      setStatus('error');
      if (err instanceof NavError) setMessage(err.message);
      else {
        console.error('lookup_failed', { query: input, error: err });
        setMessage('Unexpected error during the lookup. Reload the page and try again; if it keeps happening, check the browser console.');
      }
    }
  }

  return (
    <>
      <main>
        <h1>Verax</h1>
        <p class="tagline">The true return on your funds.</p>
        <p class="lede">Milestone 1: live NAV lookup through the same-origin proxy. Statement upload comes next.</p>

        <form onSubmit={lookup} class="search">
          <label for="q">Scheme code, ISIN or fund name</label>
          <div class="row">
            <input id="q" name="q" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} autocomplete="off" spellcheck={false} />
            <button type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? 'Looking up…' : 'Look up'}
            </button>
          </div>
        </form>

        {message && (
          <p class={status === 'error' ? 'msg error' : 'msg'} role="status">
            {message}
          </p>
        )}

        <ul class="funds">
          {funds.map((fund) => (
            <li key={fund.scheme_code}>
              <h2>{fund.scheme_name}</h2>
              <p class="meta">
                {fund.fund_house} · {fund.plan_type} · {fund.option_type} · code {fund.scheme_code}
              </p>
              {fund.latest_nav !== undefined ? (
                <p class="nav">
                  <strong>{formatInr(fund.latest_nav)}</strong>
                  <span> NAV as of {fund.latest_nav_date}</span>
                  {typeof fund.latest_day_change_pct === 'number' && (
                    <span class={fund.latest_day_change_pct >= 0 ? 'chg up' : 'chg down'}> {fund.latest_day_change_pct.toFixed(2)}%</span>
                  )}
                </p>
              ) : (
                <p class="meta">Select by scheme code to see the latest NAV.</p>
              )}
            </li>
          ))}
        </ul>
      </main>
      <footer>
        NAVs from mfnav.in (sourced from AMFI). Figures are informational only and not investment advice. Verify with your AMC or CAS before acting.
      </footer>
    </>
  );
}
