import Link from 'next/link'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Acceso clientes' }

export default function LoginPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card stack" style={{ width: '100%', maxWidth: 420, gap: 24, padding: 32 }}>
        <Link href="/" className="wordmark"><b>CMC</b><span>Portal documental</span></Link>
        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ fontSize: 30, lineHeight: '36px' }}>Acceso clientes</h1>
          <p className="muted">Consulte su documentación y envíe renovaciones a CMC.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
