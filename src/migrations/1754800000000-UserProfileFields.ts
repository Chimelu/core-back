import type { MigrationInterface, QueryRunner } from 'typeorm'

export class UserProfileFields1754800000000 implements MigrationInterface {
  name = 'UserProfileFields1754800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "address" character varying(180),
        ADD COLUMN "city" character varying(90),
        ADD COLUMN "country" character varying(90)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "country",
        DROP COLUMN "city",
        DROP COLUMN "address"
    `)
  }
}
