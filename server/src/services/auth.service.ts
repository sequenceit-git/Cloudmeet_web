import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/prisma';
import { inMemoryStore } from '../database/store';
import { ENV } from '../config/env';
import { AuthUserPayload } from '../middleware/auth.middleware';

export class AuthService {
  /**
   * Creates or updates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
   * A restart after editing the root .env applies the new login.
   */
  async syncEnvAdmin() {
    const email = ENV.ADMIN_EMAIL.toLowerCase();
    const password = ENV.ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
    }

    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      const same = await bcrypt.compare(password, existing.passwordHash);
      if (same && existing.isActive) return;
      await prisma.admin.update({
        where: { email },
        data: {
          passwordHash: await bcrypt.hash(password, 10),
          isActive: true,
        },
      });
      console.log(`[AuthService] Updated admin login for ${email} from env.`);
      return;
    }

    await prisma.admin.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        name: 'Administrator',
        isActive: true,
      },
    });
    console.log(`[AuthService] Created admin login for ${email} from env.`);
  }

  /**
   * Admin Login
   */
  async loginAdmin(email: string, password: string) {
    let admin: any = null;

    try {
      admin = await prisma.admin.findUnique({ where: { email } });
    } catch (e) {
      console.warn('[AuthService] PostgreSQL unavailable, falling back to memory store.');
    }

    if (admin) {
      if (!admin.isActive) {
        throw new Error('Admin account is deactivated');
      }

      const isValid = await bcrypt.compare(password, admin.passwordHash);
      if (!isValid) {
        throw new Error('Invalid email or password');
      }

      const payload: AuthUserPayload = {
        id: admin.id,
        email: admin.email,
        role: 'ADMIN',
        displayName: admin.name,
      };

      const token = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '7d' });

      return {
        token,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: 'ADMIN',
        },
      };
    }

    const envEmail = ENV.ADMIN_EMAIL.toLowerCase();
    if (envEmail && ENV.ADMIN_PASSWORD && email.toLowerCase() === envEmail && password === ENV.ADMIN_PASSWORD) {
      const payload: AuthUserPayload = {
        id: 'env-admin',
        email: envEmail,
        role: 'ADMIN',
        displayName: 'Administrator',
      };
      const token = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '7d' });
      return {
        token,
        user: { id: payload.id, email: envEmail, name: payload.displayName, role: 'ADMIN' },
      };
    }

    throw new Error('Invalid email or password');
  }

  /**
   * Host Login
   */
  async loginHost(username: string, password: string) {
    const normalized = username.trim().toLowerCase();
    let host: any = null;

    try {
      host = await prisma.host.findUnique({ where: { username: normalized } });
    } catch (e) {
      // Fallback
    }

    if (!host) {
      host = inMemoryStore.hosts.find((h) => h.username.toLowerCase() === normalized);
    }

    if (!host) {
      throw new Error('Invalid username or password');
    }

    if (host.isDisabled) {
      throw new Error('This host account has been suspended by the administrator');
    }

    const isValid = await bcrypt.compare(password, host.passwordHash);
    if (!isValid) {
      throw new Error('Invalid username or password');
    }

    const loginName = host.username as string;
    const payload: AuthUserPayload = {
      id: host.id,
      email: loginName,
      role: 'HOST',
      displayName: host.displayName,
    };

    const token = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '7d' });

    return {
      token,
      host: {
        id: host.id,
        username: loginName,
        email: loginName,
        displayName: host.displayName,
        avatarUrl: host.avatarUrl,
        role: 'HOST',
      },
    };
  }
}

export const authService = new AuthService();
