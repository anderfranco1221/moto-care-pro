import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) { }

  async singIn(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);

    if (!user || user.password !== pass) {
      throw new UnauthorizedException();
    }
    const { password: _, ...result } = user;
    return result;
  }
}
