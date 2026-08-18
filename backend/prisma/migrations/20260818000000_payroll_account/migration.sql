-- CreateEnum
CREATE TYPE "PayType" AS ENUM ('HOURLY', 'SALARY');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PayrollAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "payroll_account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pay_type" "PayType" NOT NULL,
    "hourly_rate" DOUBLE PRECISION,
    "annual_salary" DOUBLE PRECISION,
    "pay_frequency" "PayFrequency" NOT NULL,
    "status" "PayrollAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_account_user_id_key" ON "payroll_account"("user_id");

-- AddForeignKey
ALTER TABLE "payroll_account" ADD CONSTRAINT "payroll_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

