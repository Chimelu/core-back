import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitAuth1754600000000 implements MigrationInterface {
  name = 'InitAuth1754600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "first_name" character varying(60) NOT NULL,
        "last_name" character varying(60) NOT NULL,
        "email" character varying(180) NOT NULL,
        "phone" character varying(25),
        "password_hash" character varying NOT NULL,
        "role" character varying(20) NOT NULL DEFAULT 'user',
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "email_verified" boolean NOT NULL DEFAULT false,
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email")`)

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token_hash" character varying(64) NOT NULL,
        "user_id" uuid NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "user_agent" character varying(255),
        "ip_address" character varying(60),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")`,
    )
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD CONSTRAINT "fk_refresh_tokens_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "fk_refresh_tokens_user"`,
    )
    await queryRunner.query(`DROP INDEX "idx_refresh_tokens_token_hash"`)
    await queryRunner.query(`DROP TABLE "refresh_tokens"`)
    await queryRunner.query(`DROP INDEX "idx_users_email"`)
    await queryRunner.query(`DROP TABLE "users"`)
  }
}
