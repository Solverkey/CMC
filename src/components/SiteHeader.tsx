import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="wordmark">
          <b>CMC</b>
          <span>Consultoría de calidad y medio ambiente</span>
        </Link>
        <nav className="nav" aria-label="Principal">
          <Link href="/#servicios">Servicios</Link>
          <Link href="/#clientes">Clientes</Link>
          <Link href="/#contacto">Contacto</Link>
          <Link href="/portal" className="btn btn--primary btn--sm" style={{ marginLeft: 8 }}>
            Acceso clientes
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container" style={{ paddingBlock: 48, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 24 }}>
        <div className="stack" style={{ gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, letterSpacing: '.04em', color: 'var(--surface)' }}>CMC</span>
          <span>Consultoría de calidad y medio ambiente desde 2000</span>
        </div>
        <nav aria-label="Pie" className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
          <a href="/#servicios">Servicios</a>
          <a href="/#contacto">Contacto</a>
          <a href="/aviso-legal">Aviso legal</a>
          <a href="/privacidad">Privacidad</a>
          <a href="/cookies">Cookies</a>
        </nav>
        <span style={{ width: '100%', paddingTop: 24, borderTop: '1px solid var(--slate)', color: '#a4afab' }}>© {new Date().getFullYear()} CMC · Logroño y Burgos</span>
      </div>
    </footer>
  )
}
