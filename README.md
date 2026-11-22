# Expense Tracker

A server-rendered web app for tracking personal expenses. Add, edit and delete expenses, organize them by category, filter by category and month, and see the total for whatever you are viewing.

Built with plain JavaScript (no TypeScript) and no authentication: everyone who opens the app sees the same list.

## Features

- Add, edit and delete expenses (amount, category, date, optional description)
- Four categories: Food, Utilities, Emergency, Others
- Filter the list by category, by month, or both
- Total amount and expense count for the current filter
- Server-side validation with clear error messages
- Responsive layout with automatic dark mode

## Tech Stack

- **Runtime:** Node.js
- **Server:** Express
- **Database:** PostgreSQL (via the `pg` package)
- **Templating:** EJS
- **Config:** dotenv
- **Styling:** plain CSS

## Getting Started

### Prerequisites

- Node.js 18 or newer
- PostgreSQL installed and running
- Git

### 1. Clone the repository

```bash
git clone https://github.com/gadeshx/Expense-Tracker-2.git
cd Expense-Tracker-2
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the database and table

Create an empty database in PostgreSQL (for example `expense_tracker`), then run:

```sql
CREATE TABLE expenses (
id SERIAL PRIMARY KEY,
amount NUMERIC(10,2) NOT NULL,
category text NOT NULL,
description text,
date DATE NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=expense_tracker
```

Never commit this file. It should be listed in `.gitignore`.

### 5. Run the app

```bash
node index.js
```

Then open http://localhost:3000 in your browser.

## Routes

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | `/` | Home page |
| GET | `/expenses` | List of all expenses, with the total and count |
| GET | `/expenses/new` | Form to add a new expense |
| GET | `/expenses/:id/edit` | Form to edit the expense with the given id |
| POST | `/expenses/new` | Handles the add form: validates and saves the expense |
| POST | `/expenses/:id/edit` | Handles the edit form: validates and updates the expense |
| POST | `/expenses/:id/delete` | Deletes the expense with the given id |

### Query parameters for `GET /expenses`

| Parameter | Example | Description |
| --------- | ------- | ----------- |
| `category` | `?category=Food` | Show only one category |
| `month` | `?month=2026-11` | Show only one month (format `YYYY-MM`) |
| `msg` | `?msg=added` | Success message shown after an add, edit or delete |

Parameters can be combined, for example `/expenses?category=Food&month=2026-11`. Invalid values are ignored.

## Validation Rules

- Amount: a number greater than 0 and at most 99,999,999
- Category: must be one of the four allowed categories
- Date: a real date in `YYYY-MM-DD` format
- Description: optional, maximum 50 characters

Validation runs on the server, so it still applies if the browser checks are bypassed. All database queries are parameterized.

## Project Structure

```
.
├── index.js            # Express app, routes and validation
├── views/              # EJS templates and partials
├── public/
│   └── style/
│       └── main.css    # Styles
├── .env                # Database settings (not committed)
└── package.json
```

## Limitations

- No user accounts: all expenses are shared by anyone who opens the app
- No pagination, so very long lists load all at once
- No automated tests

## Possible Improvements

- User registration and login, with expenses private to each user
- Pagination and sorting options
- A React frontend over a JSON API