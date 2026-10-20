import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { prisma } from '../config/prisma.js';
import { registerSchema, loginSchema } from '../schemas/authSchema.js';
import { getJwtSecret } from '../config/env.js';
import { createDefaultCategoriesForUser } from '../services/categoryService.js';


export class AuthController {
  // Registo de novo utilizador (com criação atómica de categorias padrão e configs)
  async register(req: Request, res: Response) {
    try {
      const data = registerSchema.parse(req.body);

      const userExists = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (userExists) {
        return res.status(400).json({ error: 'Este email já está registado.' });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Transação atómica: Regista o utilizador, cria as categorias e inicializa as configs
      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            password: hashedPassword,
          },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        });

        // 1. Cria as categorias padrão com grupos 50/30/20
        await createDefaultCategoriesForUser(newUser.id, tx);

        // 2. Inicializa as configurações do utilizador (receita prevista = 0)
        await tx.userConfig.create({
          data: {
            userId: newUser.id,
            expectedIncome: 0,
          },
        });

        return newUser;
      });

      return res.status(201).json({
        message: 'Utilizador registado com sucesso! 🚀',
        user,
      });
    } catch (error: any) {
      // Zod 4: os problemas de validação ficam em `issues` (`errors` não existe mais)
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: error.issues.map((i) => ({ campo: i.path.join('.'), message: i.message })),
        });
      }
      console.error('ERRO NO REGISTO:', error);
      return res.status(500).json({ error: 'Erro interno ao registar utilizador.' });
    }
  }

  // Login do utilizador
  async login(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        return res.status(400).json({ error: 'Credenciais inválidas (email ou palavra-passe incorretos).' });
      }

      const passwordMatch = await bcrypt.compare(data.password, user.password);

      if (!passwordMatch) {
        return res.status(400).json({ error: 'Credenciais inválidas (email ou palavra-passe incorretos).' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        getJwtSecret(),
        { expiresIn: '7d' } // Token válido por 7 dias
      );

      return res.status(200).json({
        message: 'Login efetuado com sucesso! 🚀',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error: any) {
      // Zod 4: os problemas de validação ficam em `issues` (`errors` não existe mais)
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: error.issues.map((i) => ({ campo: i.path.join('.'), message: i.message })),
        });
      }
      return res.status(500).json({ error: 'Erro interno ao efetuar login.' });
    }
  }

  async me(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, createdAt: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'Utilizador não encontrado.' });
      }

      return res.json(user);
    } catch (error) {
      console.error('ERRO AO BUSCAR PERFIL:', error);
      return res.status(500).json({ error: 'Erro interno ao buscar perfil.' });
    }
  }
}