import { ConfigurationPage } from './pages/ConfigurationPage'

/**
 * Application shell: a 48 px header, the page, a 28 px footer — and nothing else.
 *
 * No routing library and no state management library: the three work areas live in
 * <ConfigurationPage />, which owns the single instrument and the single evaluation they all work
 * on, so the report can only ever describe the instrument and the observation that were tested.
 *
 * The header is one row and carries three facts — the name of the tool, what it is, and how far this
 * build goes. The footer is one line and carries the one disclaimer that has to travel with every
 * screen: this is a prototype evaluation record, and the application does not issue legal
 * certificates. The clauses the rules were transcribed from are listed in the document itself
 * (section F) and in docs/r76-verified-extracts.md, not in the chrome.
 */
export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <p className="brand">NIYAM</p>
        <span className="topbar-divider" aria-hidden="true" />
        <p className="topbar-title">Range-Aware R-76 Test Engine</p>

        <span className="topbar-spacer" />

        <span className="topbar-chip">OIML R 76-1:2006</span>
        <span className="topbar-chip">Prototype</span>
      </header>

      <main className="app-main">
        <ConfigurationPage />
      </main>

      <footer className="app-footer">
        Prototype evaluation record · this application does not issue legal certificates.
      </footer>
    </div>
  )
}
