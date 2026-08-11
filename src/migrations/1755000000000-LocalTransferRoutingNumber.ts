import type { MigrationInterface, QueryRunner } from 'typeorm'

export class LocalTransferRoutingNumber1755000000000 implements MigrationInterface {
  name = 'LocalTransferRoutingNumber1755000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transfers"
        ADD COLUMN "routing_number" character varying(20)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transfers"
        DROP COLUMN "routing_number"
    `)
  }
}
