import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { normalizeCategoryType, normalizeGroup } from '../services/categoryService.js';

const GROUP_ERROR = 'Grupo inválido. Use NECESSITY, WANTS ou FUTURE (ou nec, des, fut).';

export class CategoryController {
  // Listar categorias do usuário
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const categories = await prisma.category.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      });
      return res.json(categories);
    } catch (error) {
      console.error('ERRO AO LISTAR CATEGORIAS:', error);
      return res.status(500).json({ error: 'Erro interno ao listar categorias' });
    }
  }

  // Criar categoria. `type` é opcional (padrão 'out'); `group` aceita NECESSITY/WANTS/FUTURE ou nec/des/fut.
  async create(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { name, icon, color, type, group } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'O nome da categoria é obrigatório' });
      }

      const normalizedGroup = group === undefined ? null : normalizeGroup(group);
      if (normalizedGroup === undefined) return res.status(400).json({ error: GROUP_ERROR });

      const cleanName = String(name).trim();
      const duplicate = await prisma.category.findFirst({ where: { userId, name: cleanName } });
      if (duplicate) return res.status(409).json({ error: 'Já existe uma categoria com esse nome' });

      const category = await prisma.category.create({
        data: {
          name: cleanName,
          icon,
          color,
          type: normalizeCategoryType(type),
          group: normalizedGroup,
          userId,
        },
      });

      return res.status(201).json(category);
    } catch (error) {
      console.error('ERRO AO CRIAR CATEGORIA:', error);
      return res.status(500).json({ error: 'Erro interno ao criar categoria' });
    }
  }

  // Atualizar categoria (nome, ícone, cor, tipo e grupo). Enviar group: null remove o grupo.
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { name, icon, color, type, group } = req.body;

      const categoryExists = await prisma.category.findFirst({ where: { id: String(id), userId } });
      if (!categoryExists) return res.status(404).json({ error: 'Categoria não encontrada' });

      let normalizedGroup: ReturnType<typeof normalizeGroup> | 'keep' = 'keep';
      if (group !== undefined) {
        normalizedGroup = normalizeGroup(group);
        if (normalizedGroup === undefined) return res.status(400).json({ error: GROUP_ERROR });
      }

      let cleanName: string | undefined;
      if (name !== undefined) {
        cleanName = String(name).trim();
        if (!cleanName) return res.status(400).json({ error: 'O nome da categoria não pode ficar vazio' });
        if (cleanName !== categoryExists.name) {
          const duplicate = await prisma.category.findFirst({ where: { userId, name: cleanName } });
          if (duplicate) return res.status(409).json({ error: 'Já existe uma categoria com esse nome' });
        }
      }

      const updatedCategory = await prisma.category.update({
        where: { id: String(id) },
        data: {
          ...(cleanName !== undefined && { name: cleanName }),
          ...(icon !== undefined && { icon }),
          ...(color !== undefined && { color }),
          ...(type !== undefined && { type: normalizeCategoryType(type) }),
          ...(normalizedGroup !== 'keep' && { group: normalizedGroup }),
        },
      });

      return res.json({
        message: 'Categoria atualizada com sucesso! 🏷️',
        category: updatedCategory,
      });
    } catch (error) {
      console.error('ERRO AO ATUALIZAR CATEGORIA:', error);
      return res.status(500).json({ error: 'Erro interno ao atualizar categoria' });
    }
  }

  // Remover categoria
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const category = await prisma.category.findFirst({ where: { id: String(id), userId } });
      if (!category) return res.status(404).json({ error: 'Categoria não encontrada' });

      await prisma.category.delete({ where: { id: String(id) } });
      return res.status(204).send();
    } catch (error) {
      console.error('ERRO AO REMOVER CATEGORIA:', error);
      return res.status(500).json({ error: 'Erro interno ao remover categoria' });
    }
  }
}
