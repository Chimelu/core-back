import type { MigrationInterface, QueryRunner } from 'typeorm'

export class InternationalTransferDetails1754900000000 implements MigrationInterface {
  name = 'InternationalTransferDetails1754900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transfers"
        ADD COLUMN "bank_country" character varying(90),
        ADD COLUMN "bank_address" character varying(255),
        ADD COLUMN "recipient_address" character varying(255)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transfers"
        DROP COLUMN "recipient_address",
        DROP COLUMN "bank_address",
        DROP COLUMN "bank_country"
    `)
  }
}
