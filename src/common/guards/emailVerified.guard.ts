import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenPayload } from 'src/auth/types/token.type';
import { PrismaService } from 'src/config/prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prismaServie: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const requestUser: TokenPayload = request.user;

    if (!requestUser) return false;

    const user = await this.prismaServie.user.findUnique({
      where: {
        id: requestUser.sub,
      },
    });

    if (!user) return false;

    if (!user.emailVerified) {
      throw new ForbiddenException('You need to verify your account first');
    }

    return true;
  }
}
