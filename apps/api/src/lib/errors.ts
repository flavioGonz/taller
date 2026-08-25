export class AppError extends Error {
  constructor(
    public override readonly message: string,
    public readonly statusCode = 400,
    public readonly code = 'BAD_REQUEST',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (m: string, d?: unknown) => new AppError(m, 400, 'BAD_REQUEST', d);
export const unauthorized = (m = 'No autenticado') => new AppError(m, 401, 'UNAUTHORIZED');
export const forbidden = (m = 'Permiso denegado') => new AppError(m, 403, 'FORBIDDEN');
export const notFound = (m = 'Recurso no encontrado') => new AppError(m, 404, 'NOT_FOUND');
export const conflict = (m: string, d?: unknown) => new AppError(m, 409, 'CONFLICT', d);
export const unprocessable = (m: string, d?: unknown) => new AppError(m, 422, 'UNPROCESSABLE', d);
