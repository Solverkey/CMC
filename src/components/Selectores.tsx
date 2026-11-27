'use client'

import {
  selectorCrear,
  selectorCrearInstalacion,
  selectorDocumentosDeInstalacion,
  selectorOpciones,
  selectorQuitar,
  selectorQuitarInstalacion,
  selectorRenombrar,
  selectorRenombrarInstalacion,
  selectorUsos,
} from '@/app/(frontend)/portal/acciones'
import { SelectorEditable, type OpcionEditable } from './SelectorEditable'

type Base = { id?: string; name: string; valor?: string; required?: boolean; placeholder?: string; alCambiar?: (v: string) => void }

/**
 * Instalación de una empresa. CMC la elige, crea una nueva (o recupera una del catálogo), la renombra
 * o la quita sin salir del formulario. Quitar borra si no tiene documentos; si los tiene, la archiva.
 */
export function SelectorInstalacion({ empresaId, instalaciones, ...base }: Base & { empresaId: string; instalaciones: { id: string; nombre: string }[] }) {
  return (
    <SelectorEditable
      {...base}
      etiqueta="Instalación"
      placeholder={base.placeholder ?? 'Elegir o escribir para crear'}
      opciones={instalaciones.map((c) => ({ valor: c.id, texto: c.nombre }))}
      sugerencias={{
        titulo: 'Del catálogo · se añade a esta empresa',
        cargar: async () => {
          const r = await selectorOpciones('categoria')
          return r.ok ? { ok: true, dato: r.dato.map((o) => ({ valor: `catalogo:${o.texto}`, texto: o.texto })) } : r
        },
      }}
      textoCrear={(n) => `Crear la instalación «${n}»`}
      crear={(nombre) => selectorCrearInstalacion(empresaId, nombre)}
      renombrar={(o, nombre) => selectorRenombrarInstalacion(o.valor, nombre)}
      quitar={(o) => selectorQuitarInstalacion(o.valor)}
      aviso={async (o, modo) => {
        const r = await selectorDocumentosDeInstalacion(o.valor)
        const n = r.ok ? r.dato : 0
        if (modo === 'renombrar') return n ? `Cambia el nombre en esta empresa; sus ${n} documento${n === 1 ? '' : 's'} siguen en ella.` : null
        return n ? `Tiene ${n} documento${n === 1 ? '' : 's'}: se archivará (deja de salir) y se conservan.` : 'No tiene documentos: se borrará.'
      }}
    />
  )
}

const NOMBRES = { documento: 'documentos', relacion: 'archivos' } as const

/** Nombre de un catálogo (nombre de documento o tipo de relación del archivo), editable por CMC. */
export function SelectorCatalogo({ tipo, etiqueta, libre = true, ...base }: Base & { tipo: 'documento' | 'relacion'; etiqueta: string; libre?: boolean }) {
  return (
    <SelectorEditable
      {...base}
      etiqueta={etiqueta}
      libre={libre}
      cargar={() => selectorOpciones(tipo)}
      textoCrear={(n) => (tipo === 'relacion' ? `Crear el tipo «${n}»` : `Añadir «${n}» al selector`)}
      conEfectos={tipo === 'relacion'}
      crear={(nombre, efectos) => selectorCrear(tipo, nombre, efectos)}
      renombrar={(o: OpcionEditable, nombre) => selectorRenombrar(tipo, o.valor, nombre)}
      quitar={(o) => selectorQuitar(tipo, o.valor)}
      aviso={async (o, modo) => {
        const r = await selectorUsos(tipo, o.valor)
        const n = r.ok ? r.dato : 0
        if (modo === 'renombrar') return n ? `También se cambiará en los ${n} ${NOMBRES[tipo]} que ya lo usan.` : null
        return `Deja de salir en el selector.${n ? ` Los ${n} ${NOMBRES[tipo]} que lo usan no cambian.` : ''}`
      }}
    />
  )
}
