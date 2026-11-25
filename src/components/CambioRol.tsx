'use client'

import { FormAccion } from './FormAccion'
import type { Resultado } from '@/app/(frontend)/portal/acciones'

export function CambioRol({
  accion,
  empresa,
  usuario,
  rol,
  nombre,
  bloqueado,
}: {
  accion: (prev: Resultado, f: FormData) => Promise<Resultado>
  empresa: number | string
  usuario: number | string
  rol: string
  nombre: string
  bloqueado?: boolean
}) {
  return (
    <FormAccion accion={accion} discreto className="cambio-rol">
      <input type="hidden" name="empresa" value={empresa} />
      <input type="hidden" name="usuario" value={usuario} />
      <select
        name="rol"
        defaultValue={rol}
        aria-label={`Rol de ${nombre}`}
        className="input"
        disabled={bloqueado}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="usuario">Usuario</option>
        <option value="admin">Administrador</option>
      </select>
    </FormAccion>
  )
}
