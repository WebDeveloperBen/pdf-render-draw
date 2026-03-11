CREATE TABLE public.annotations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_url text NOT NULL,
  content jsonb,
  author_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  type text NOT NULL,
  page_num integer NOT NULL,
  CONSTRAINT annotations_pkey PRIMARY KEY (id),
  CONSTRAINT annotations_authorId_fkey FOREIGN KEY (author_id) REFERENCES public.users (user_id)
);

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.clients (
  client_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone character varying,
  email character varying UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (client_id)
);

CREATE TABLE public.faq_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT faq_articles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feature_flags_pkey PRIMARY KEY (id)
);

CREATE TABLE public.project_clients (
  project_clients_id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  client_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_clients_pkey PRIMARY KEY (project_clients_id)
);

CREATE TABLE public.project_documents (
  document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_url text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  owner_id uuid NOT NULL,
  name text,
  type text,
  size bigint,
  num_pages smallint,
  project_id uuid,
  CONSTRAINT project_documents_pkey PRIMARY KEY (document_id),
  CONSTRAINT project_documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users (user_id),
  CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects (project_id)
);

CREATE TABLE public.project_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  content text,
  color text,
  CONSTRAINT project_tags_pkey PRIMARY KEY (id)
);

CREATE TABLE public.project_users (
  project_users_id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_users_pkey PRIMARY KEY (project_users_id),
  CONSTRAINT project_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (user_id),
  CONSTRAINT project_users_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects (project_id)
);

CREATE TABLE public.project_users_roles (
  project_users_roles_id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_users_roles_pkey PRIMARY KEY (project_users_roles_id)
);

CREATE TABLE public.projects (
  project_id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  project_description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  project_image text,
  client_name text,
  owner_id uuid,
  CONSTRAINT projects_pkey PRIMARY KEY (project_id),
  CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users (user_id)
);

CREATE TABLE public.roles (
  role_id integer NOT NULL DEFAULT nextval('roles_role_id_seq'::regclass),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (role_id)
);

CREATE TABLE public.support (
  support_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  message text NOT NULL,
  contact boolean,
  date timestamp with time zone DEFAULT now(),
  completed boolean DEFAULT false,
  read boolean DEFAULT false,
  CONSTRAINT support_pkey PRIMARY KEY (support_id),
  CONSTRAINT public_support_email_fkey FOREIGN KEY (email) REFERENCES public.users (email)
);

CREATE TABLE public.system_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (key)
);

CREATE TABLE public.testimonials (
  testimonial_id uuid NOT NULL DEFAULT gen_random_uuid(),
  testimonialContent text NOT NULL,
  author character varying NOT NULL,
  approved boolean DEFAULT false,
  CONSTRAINT testimonials_pkey PRIMARY KEY (testimonial_id)
);

CREATE TABLE public.users (
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  stripe_customer_id character varying,
  gender text,
  profession text,
  profile_url text,
  bio text,
  active boolean DEFAULT false,
  subscription_ends bigint,
  subscription_status text,
  accepted_terms boolean NOT NULL DEFAULT false,
  company text,
  phone text,
  default_unit text DEFAULT 'mm'::text,
  default_scale text DEFAULT '1:100'::text,
  date_format text DEFAULT 'DD/MM/YYYY'::text,
  role text NOT NULL DEFAULT 'user'::text,
  country text,
  country_code text,
  signup_ip text,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);
