/** Error de negocio con código HTTP. Sustituye al APIError de Payload. */
export class AppError extends Error {
  status: number
  data?: unknown

  constructor(message: string, status = 400, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

export const errorJson = (e: unknown) => {
  const err = e as AppError
  return Response.json({ errors: [{ message: err.message || 'Error', ...(err.data ? { data: err.data } : {}) }] }, { status: err.status ?? 500 })
}
