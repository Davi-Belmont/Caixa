-- Vincula a venda de ação à transação (receita) que ela gerou.
-- Só adiciona uma coluna opcional: nada é apagado e as operações antigas continuam válidas (sem transação).

-- AlterTable
ALTER TABLE "stock_operations" ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stock_operations_transactionId_key" ON "stock_operations"("transactionId");

-- AddForeignKey
ALTER TABLE "stock_operations" ADD CONSTRAINT "stock_operations_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
