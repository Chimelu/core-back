import type { MigrationInterface, QueryRunner } from 'typeorm'

export class TransactionPin1755100000000 implements MigrationInterface {
  name = 'TransactionPin1755100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable: existing customers set their PIN from Settings before they can
    // send money again.
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "transaction_pin_hash" character varying
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "transaction_pin_hash"
    `)
  }
}
