import { AvisoCorreo } from '@/components/AvisoCorreo'
import { redirect } from 'next/navigation'
import { guardarConfiguracion } from '@/app/(frontend)/portal/acciones'
import { FilasPlantilla } from '@/components/FilasPlantilla'
import { SelectorColor } from '@/components/SelectorColor'
import { FormAccion } from '@/components/FormAccion'
import { leerConfiguracion } from '@/lib/configuracion'
import { contexto } from '@/lib/payload'
import { PLANTILLAS, type ClavePlantilla } from '@/lib/plantillas'

export const metadata = { title: 'Configuración' }

export default async function ConfiguracionPage() {
  const { cmc } = await contexto('/portal/configuracion')
  if (!cmc) redirect('/portal')
  const cfg = await leerConfiguracion()
  const logo = cfg.logoUrl ? { id: cfg.logoId, url: cfg.logoUrl, alt: 'Logotipo de CMC' } : null
  const categorias = cfg.plantillaCategorias.map((c) => ({
    nombre: c.nombre,
    antelacionMeses: c.antelacionMeses == null ? '' : String(c.antelacionMeses),
    gestion: c.gestion ?? '',
    descripcion: c.descripcion ?? '',
  }))

  return (
    <>
      <AvisoCorreo />
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">CMC</p>
        <h1>Configuración</h1>
        <p className="muted">Valores de la plataforma. Una empresa, una instalación o un documento pueden cambiar la antelación; manda el nivel más concreto.</p>
      </div>

      <FormAccion accion={guardarConfiguracion} className="stack">
        <input type="hidden" name="logoId" value={logo?.id ?? ''} />

        <section className="card stack">
          <h2 style={{ fontSize: 22, lineHeight: '28px', margin: 0 }}>Avisos de caducidad</h2>
          <div className="row" style={{ alignItems: 'start', gap: 12 }}>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label htmlFor="antelacionMeses">Antelación por defecto (meses)</label>
              <input id="antelacionMeses" name="antelacionMeses" type="number" min={0} max={120} required defaultValue={cfg.antelacionMeses} />
              <span className="hint">Si la empresa y la instalación no indican otra.</span>
            </div>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label htmlFor="recordatorioDiasAntes">Recordatorio previo (días)</label>
              <input id="recordatorioDiasAntes" name="recordatorioDiasAntes" type="number" min={0} max={365} required defaultValue={cfg.recordatorioDiasAntes} />
            </div>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label htmlFor="frecuenciaCaducado">Mientras siga caducado</label>
              <select id="frecuenciaCaducado" name="frecuenciaCaducado" defaultValue={cfg.frecuenciaCaducado}>
                <option value="semanal">Cada semana</option>
                <option value="mensual">Cada mes</option>
              </select>
            </div>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label htmlFor="maxRecordatoriosCaducado">Máximo de recordatorios</label>
              <input id="maxRecordatoriosCaducado" name="maxRecordatoriosCaducado" type="number" min={0} max={100} required defaultValue={cfg.maxRecordatoriosCaducado} />
              <span className="hint">En documentos gestionados, el cliente recibe el aviso inicial, el de caducidad y la renovación. El resto va al técnico.</span>
            </div>
          </div>
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: 22, lineHeight: '28px', margin: 0 }}>Correo</h2>
          <div className="row" style={{ alignItems: 'end', gap: 12 }}>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label htmlFor="remitenteNombre">Nombre del remitente</label>
              <input id="remitenteNombre" name="remitenteNombre" defaultValue={cfg.remitenteNombre} />
            </div>
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="remitenteEmail">Dirección del remitente</label>
              <input id="remitenteEmail" name="remitenteEmail" type="email" defaultValue={cfg.remitenteEmail} placeholder="Vacío = EMAIL_FROM" />
            </div>
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="responderA">Dirección de respuesta</label>
              <input id="responderA" name="responderA" type="email" defaultValue={cfg.responderA ?? ''} />
            </div>
          </div>
          <div className="row correo-pie" style={{ alignItems: 'start', gap: 12 }}>
            <SelectorColor valor={cfg.colorPrimario} />
            <div className="field" style={{ flex: '1 1 280px', minWidth: 0 }}>
              <label htmlFor="firma">Firma</label>
              <textarea id="firma" name="firma" rows={2} defaultValue={cfg.firma} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="logo">Logotipo de los correos</label>
            {logo?.url && (
              // eslint-disable-next-line @next/next/no-img-element -- el logotipo puede venir de S3
              <img src={logo.url} alt={logo.alt || 'Logotipo de CMC'} style={{ maxHeight: 48, maxWidth: 200 }} />
            )}
            <input id="logo" name="logo" type="file" accept="image/*" />
            <span className="hint">Una imagen nueva sustituye a la actual. Si no elige ninguna, se conserva.</span>
            {logo && (
              <label className="row" style={{ gap: 8, fontWeight: 400 }}>
                <input type="checkbox" name="quitarLogo" /> Quitar el logotipo
              </label>
            )}
          </div>
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: 22, lineHeight: '28px', margin: 0 }}>Imágenes que se suben</h2>
          <p className="muted" style={{ margin: 0 }}>Los PDF y los documentos de Office no se comprimen.</p>
          <div className="row" style={{ alignItems: 'end', gap: 12 }}>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label htmlFor="ladoMaximo">Lado mayor (px)</label>
              <input id="ladoMaximo" name="ladoMaximo" type="number" min={500} max={8000} required defaultValue={cfg.ladoMaximo} />
            </div>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label htmlFor="calidad">Calidad (40-100)</label>
              <input id="calidad" name="calidad" type="number" min={40} max={100} required defaultValue={cfg.calidad} />
            </div>
            <label className="row" style={{ gap: 8, minHeight: 44, fontWeight: 600 }}>
              <input type="checkbox" name="conservarOriginal" defaultChecked={cfg.conservarOriginal} /> Conservar también el original
            </label>
          </div>
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: 22, lineHeight: '28px', margin: 0 }}>Plantilla al dar de alta una empresa</h2>
          <p className="muted" style={{ margin: 0 }}>Estas instalaciones se crean con la empresa. Después se pueden adaptar en cada cliente.</p>
          <FilasPlantilla inicial={categorias} />
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: 22, lineHeight: '28px', margin: 0 }}>Plantillas de correo</h2>
          <p className="muted" style={{ margin: 0 }}>
            Variables: {'{{empresa}} {{documento}} {{caducidad}} {{dias}} {{nombre}} {{tecnico}} {{motivo}} {{asunto}} {{mensaje}} {{resumen}} {{uso}} {{limite}}'}.
            Un campo vacío vuelve al texto por defecto.
          </p>
          {(Object.keys(PLANTILLAS) as ClavePlantilla[]).map((clave) => {
            const t = cfg.plantilla(clave)
            return (
              <details key={clave} className="config-plantilla">
                <summary>{t.etiqueta}</summary>
                <div className="stack" style={{ gap: 12, paddingBottom: 16 }}>
                  <div className="field">
                    <label htmlFor={`p_${clave}_asunto`}>Asunto</label>
                    <input id={`p_${clave}_asunto`} name={`p_${clave}_asunto`} defaultValue={t.asunto} />
                  </div>
                  <div className="field">
                    <label htmlFor={`p_${clave}_cuerpo`}>Cuerpo</label>
                    <textarea id={`p_${clave}_cuerpo`} name={`p_${clave}_cuerpo`} rows={4} defaultValue={t.cuerpo} />
                  </div>
                  <div className="field">
                    <label htmlFor={`p_${clave}_boton`}>Texto del botón</label>
                    <input id={`p_${clave}_boton`} name={`p_${clave}_boton`} defaultValue={t.boton ?? ''} />
                  </div>
                </div>
              </details>
            )
          })}
        </section>

        <button className="btn btn--primary" type="submit">Guardar configuración</button>
      </FormAccion>
    </>
  )
}
