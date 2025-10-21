import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { ROLE_KEY } from '../decorators/role.decorator';
import { TokenPayload } from 'src/auth/types/token.type';

@Injectable()
export class RolesGuardGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles) return true;

    const request = context.switchToHttp().getRequest();

    const user: TokenPayload = request.user;

    if (!user) return false;

    const isAuth = roles.some((role) => role === user.role);

    if (!isAuth) {
      throw new ForbiddenException("You don't have permission (Roles).");
    }

    return isAuth;
  }
}
