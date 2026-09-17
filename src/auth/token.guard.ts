import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

export type UsuarioToken = {
  sub: string;
  grupos: string[];
  scope: string;
};

@Injectable()
export class TokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers?.authorization;

    if (typeof authorization !== 'string') {
      throw new UnauthorizedException(
        'Se requiere un bearer token',
      );
    }

    const resultado = /^Bearer\s+(\S+)$/i.exec(
      authorization,
    );

    if (!resultado) {
      throw new UnauthorizedException(
        'La cabecera Authorization no es válida',
      );
    }

    const payload = this.decodificarPayload(resultado[1]);

    if (
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      payload.token_use !== 'access'
    ) {
      throw new UnauthorizedException(
        'El token no permite establecer al usuario',
      );
    }

    const grupos = payload['cognito:groups'];

    request.user = {
      sub: payload.sub,
      grupos: Array.isArray(grupos)
        ? grupos.filter(
            (grupo): grupo is string =>
              typeof grupo === 'string',
          )
        : [],
      scope:
        typeof payload.scope === 'string'
          ? payload.scope
          : '',
    } satisfies UsuarioToken;

    return true;
  }

  private decodificarPayload(
    token: string,
  ): Record<string, unknown> {
    const partes = token.split('.');

    if (
      partes.length !== 3 ||
      partes.some((parte) => parte.length === 0)
    ) {
      throw new UnauthorizedException(
        'El bearer token no tiene formato JWT',
      );
    }

    try {
      const payload: unknown = JSON.parse(
        Buffer.from(
          partes[1],
          'base64url',
        ).toString('utf8'),
      );

      if (
        typeof payload !== 'object' ||
        payload === null ||
        Array.isArray(payload)
      ) {
        throw new Error('Payload inválido');
      }

      return payload as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException(
        'No fue posible leer los claims del token',
      );
    }
  }
}
