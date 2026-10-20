import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const registerSchema = z.object({
  name: z.string().min(2, 'O nome é obrigatório').openapi({ example: 'Davi Belmont' }),
  email: z.string().email('Email inválido').openapi({ example: 'davi@unipe.br' }),
  password: z.string().min(6, 'A palavra-passe deve ter pelo menos 6 caracteres').openapi({ example: 'senha123' }),
}).openapi('Register');

export const loginSchema = z.object({
  email: z.string().email('Email inválido').openapi({ example: 'davi@unipe.br' }),
  password: z.string().min(1, 'A palavra-passe é obrigatória').openapi({ example: 'senha123' }),
}).openapi('Login');

export type RegisterDTO = z.infer<typeof registerSchema>;
export type LoginDTO = z.infer<typeof loginSchema>;