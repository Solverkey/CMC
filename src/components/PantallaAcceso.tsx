import Link from 'next/link'

/** Marco común de las pantallas de acceso (login, recuperar, invitación, autorizar). */
export function PantallaAcceso({ titulo, texto, children }: { titulo: string; texto?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card stack" style={{ width: '100%', maxWidth: 440, gap: 24, padding: 32 }}>
        <Link href="/" className="wordmark" aria-label="CMC, inicio"><img src="/marca/cmc.png" alt="" width={408} height={112} /></Link>
        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ fontSize: 30, lineHeight: '36px' }}>{titulo}</h1>
          {texto && <p className="muted">{texto}</p>}
        </div>
        {children}
      </div>
    </main>
  )
}
