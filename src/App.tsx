import { NavLookup } from './ui/NavLookup';
import { StatementSection } from './ui/StatementSection';

export function App() {
  return (
    <>
      <main>
        <h1>Verax</h1>
        <p class="tagline">The true return on your funds.</p>
        <p class="lede">Open your CAS to see what it holds. Your statement is read in this browser and never leaves your device.</p>
        <StatementSection />
        <NavLookup />
      </main>
      <footer>
        NAVs from mfnav.in (sourced from AMFI). Figures are informational only and not investment advice. Verify with your AMC or CAS before acting.
      </footer>
    </>
  );
}
