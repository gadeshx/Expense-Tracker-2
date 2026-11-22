CREATE TABLE expenses (
id SERIAL PRIMARY KEY,
amount NUMERIC(10,2) NOT NULL,
category text NOT NULL,
description text,
date DATE,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);