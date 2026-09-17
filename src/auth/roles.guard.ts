import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import type { UsuarioToken } from './token.guard.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos =
      this.reflector.getAllAndOverride<string[]>(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (
      !rolesRequeridos ||
      rolesRequeridos.length === 0
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuario = request.user as
      | UsuarioToken
      | undefined;

    const autorizado = rolesRequeridos.some((rol) =>
      usuario?.grupos.includes(rol),
    );

    if (!autorizado) {
      throw new ForbiddenException(
        'El usuario no pertenece a un grupo autorizado',
      );
    }

    return true;
  }
}
