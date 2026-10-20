import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Estende o Zod para habilitar o método .openapi()
extendZodWithOpenApi(z);

import { OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { goalRegistry } from './goalSwagger.js';
import { transactionRegistry } from './transactionSwagger.js';
import { stockRegistry } from './stockSwagger.js';
import { billRegistry } from './billSwagger.js';

// Importa os registos das novas funcionalidades
import { dividendRegistry } from './dividendSwagger.js';
import { budgetRegistry } from './budgetSwagger.js';
import { categoryRegistry } from './categorySwagger.js';
import { priceAlertRegistry } from './priceAlertSwagger.js';
import { stockOperationRegistry } from './stockOperationSwagger.js';
import { extraRegistry } from './extraSwagger.js';

export const registry = new OpenAPIRegistry([
  goalRegistry,
  transactionRegistry,
  stockRegistry,
  billRegistry,
  dividendRegistry,
  budgetRegistry,
  categoryRegistry,
  priceAlertRegistry,
  stockOperationRegistry,
  extraRegistry,
]);

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  const document = generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'API do B3 - Gestão Financeira & Investimentos',
      version: '1.0.0',
      description: 'Documentação interativa da API do projeto Caixa desenvolvida em Programação Avançada para Web.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor Local de Desenvolvimento',
      },
    ],
  });

  document.components = {
    ...document.components,
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Insere o token JWT obtido no login no formato: Bearer <token>',
      },
    },
  };

  return document;
}