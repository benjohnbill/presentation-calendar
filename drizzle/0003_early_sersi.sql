CREATE TABLE "programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"host_id" integer NOT NULL,
	"label" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_host_id_members_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;