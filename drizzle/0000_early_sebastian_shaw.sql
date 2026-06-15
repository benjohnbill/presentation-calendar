CREATE TABLE "availabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "availabilities_member_id_date_unique" UNIQUE("member_id","date")
);
--> statement-breakpoint
CREATE TABLE "commits" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"date" date NOT NULL,
	"time_start" time,
	"time_end" time,
	CONSTRAINT "commits_member_id_date_unique" UNIQUE("member_id","date")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"discord_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"event_type" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_date_event_type_unique" UNIQUE("date","event_type")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"presenter_id" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commits" ADD CONSTRAINT "commits_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_presenter_id_members_id_fk" FOREIGN KEY ("presenter_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;