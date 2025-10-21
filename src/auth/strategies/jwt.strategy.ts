import { Inject, Injectable } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';

import { ConfigType } from '@nestjs/config';
import envConfig from 'src/config/environment/env.config';
import { TokenPayload } from '../types/token.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(envConfig.KEY) configService: ConfigType<typeof envConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.jwt.secret,
    });
  }

  async validate(payload: TokenPayload) {
    return payload;
  }
}
