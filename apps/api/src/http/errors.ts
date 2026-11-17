import {ArgumentsHost, Catch, HttpException, HttpStatus, type ExceptionFilter} from '@nestjs/common';
import type {Request, Response} from 'express';
import {DomainError} from '@vilazuni/domain';

/**
 * Erro de API com código estável (a tela traduz pelo código). Mensagem curta, sem detalhe interno.
 * "Não existe" e "sem acesso" respondem IGUAL (404 `nao_encontrado`) onde a diferença revelaria dado de outra
 * casa ou condomínio (T54).
 */
export class ApiError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
  ) {
    super({error: code, message}, status);
  }
}

export const notFound = () => new ApiError(404, 'nao_encontrado', 'Não encontrado.');
export const forbidden = (code = 'sem_permissao', message = 'Você não tem permissão para esta ação.') =>
  new ApiError(403, code, message);
export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);
export const gone = (code: string, message: string) => new ApiError(410, code, message);
export const unauthorized = (code = 'nao_autenticado', message = 'Entre para continuar.') =>
  new ApiError(401, code, message);

const DOMAIN_STATUS: Record<string, number> = {
  periodo_invalido: 400,
  numero_invalido: 400,
  medida_invalida: 400,
};

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request & {correlationId?: string}>();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const status = exception.getStatus();
      if (typeof body === 'object' && body && 'error' in body) return res.status(status).json(body);
      return res.status(status).json({error: status === 404 ? 'nao_encontrado' : 'requisicao_invalida'});
    }
    if (exception instanceof DomainError)
      return res
        .status(DOMAIN_STATUS[exception.code] ?? 400)
        .json({error: exception.code, message: exception.message});
    // Erro inesperado: registro local com o id de correlação; ao usuário, nada interno.
    console.error(
      JSON.stringify({
        nivel: 'erro',
        correlationId: req.correlationId,
        rota: req.path,
        erro: exception instanceof Error ? exception.message : String(exception),
      }),
    );
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'erro_interno',
      message: 'Algo deu errado. Tente de novo.',
      correlationId: req.correlationId,
    });
  }
}
