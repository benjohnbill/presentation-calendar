CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"presenter_id" integer NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "final_time" time;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_presenter_id_members_id_fk" FOREIGN KEY ("presenter_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;