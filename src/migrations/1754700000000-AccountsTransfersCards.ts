import { MigrationInterface, QueryRunner } from 'typeorm'

export class AccountsTransfersCards1754700000000 implements MigrationInterface {
  name = 'AccountsTransfersCards1754700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "account_number" character varying(10) NOT NULL,
        "name" character varying(60) NOT NULL,
        "type" character varying(20) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "balance" numeric(18,2) NOT NULL DEFAULT 0,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "is_primary" boolean NOT NULL DEFAULT false,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "fk_accounts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_accounts_number" ON "accounts" ("account_number")`,
    )
    await queryRunner.query(`CREATE INDEX "idx_accounts_user" ON "accounts" ("user_id")`)

    await queryRunner.query(`
      CREATE TABLE "cards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" character varying(60) NOT NULL,
        "brand" character varying(20) NOT NULL DEFAULT 'VISA',
        "type" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "number_encrypted" text NOT NULL,
        "cvv_encrypted" text NOT NULL,
        "last4" character varying(4) NOT NULL,
        "expiry_month" smallint NOT NULL,
        "expiry_year" smallint NOT NULL,
        "holder_name" character varying(120) NOT NULL,
        "spending_limit" numeric(18,2) NOT NULL DEFAULT 0,
        "online_payments_enabled" boolean NOT NULL DEFAULT true,
        "international_enabled" boolean NOT NULL DEFAULT false,
        "user_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_cards" PRIMARY KEY ("id"),
        CONSTRAINT "fk_cards_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_cards_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(`CREATE INDEX "idx_cards_user" ON "cards" ("user_id")`)

    await queryRunner.query(`
      CREATE TABLE "transfers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" character varying(40) NOT NULL,
        "user_id" uuid NOT NULL,
        "source_account_id" uuid NOT NULL,
        "destination_account_id" uuid,
        "kind" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "amount" numeric(18,2) NOT NULL,
        "fee" numeric(18,2) NOT NULL DEFAULT 0,
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "recipient_name" character varying(120) NOT NULL,
        "recipient_account_number" character varying(40) NOT NULL,
        "recipient_bank_name" character varying(120),
        "swift_code" character varying(20),
        "description" character varying(255),
        "failure_reason" character varying(255),
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_transfers" PRIMARY KEY ("id"),
        CONSTRAINT "fk_transfers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_transfers_source_account" FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_transfers_reference" ON "transfers" ("reference")`,
    )
    await queryRunner.query(`CREATE INDEX "idx_transfers_user" ON "transfers" ("user_id")`)

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "account_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "direction" character varying(10) NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "balance_after" numeric(18,2) NOT NULL,
        "category" character varying(40) NOT NULL DEFAULT 'transfer',
        "description" character varying(180) NOT NULL,
        "reference" character varying(40),
        "transfer_id" uuid,
        "card_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "fk_transactions_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_transactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_transactions_card" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE SET NULL
      )
    `)
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_account" ON "transactions" ("account_id")`,
    )
    await queryRunner.query(`CREATE INDEX "idx_transactions_user" ON "transactions" ("user_id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transactions"`)
    await queryRunner.query(`DROP TABLE "transfers"`)
    await queryRunner.query(`DROP TABLE "cards"`)
    await queryRunner.query(`DROP TABLE "accounts"`)
  }
}
