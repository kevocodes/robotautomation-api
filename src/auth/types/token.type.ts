import { Role } from '@prisma/client';

export type TokenPayload = {
  sub: string;
  email: string;
  role: Role;
  fullname: string;
};
