import dotenv from "dotenv";
import express from "express";
import pg from "pg";

dotenv.config();
const app = express();
const db = new pg.Pool({
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
db.on("error", (err) => console.error("DB pool error:", err.message));
pg.types.setTypeParser(1082, (value) => value);

const categoryOptions = ["Food", "Utilities", "Emergency", "Others"];
function validateExpense(data) {
    const amount = typeof data.amount === "string" ? Number(data.amount) : NaN;
    const category = typeof data.category === "string" ? data.category : "";
    const date = typeof data.date === "string" ? data.date : "";
    const description = typeof data.description === "string" ? data.description.trim() || null : null;
    const values = { amount, category, date, description };

    if (!amount || !category || !date) {
        return { ...values, error: "Please fill out all the fields" }
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999) {
        return { ...values, error: "Please enter a valid amount" }
    }
    if (!categoryOptions.includes(category)) {
        return { ...values, error: "Please enter a valid category" }
    }
    if (description && description.length > 50) {
        return { ...values, error: "Description must be 50 characters or less" }
    }
    const parsed = new Date(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(parsed) || parsed.toISOString().slice(0, 10) !== date) {
        return { ...values, error: "Please enter a valid date" }
    }
    return { ...values, error: null }
}

function getFilter(filterInput) {
    const category = typeof filterInput === "string" ? filterInput : "";
    return categoryOptions.includes(category) ? category : null;

}

function getMonth(monthInput) {
    const month = typeof monthInput === "string" ? monthInput : "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return null
    }
    return month
}

function getMonthRange(checkedMonth) {
    if (!checkedMonth) {
        return null
    }
    const separatedMonth = checkedMonth.split("-")
    let month = Number(separatedMonth[1]) + 1
    let year = Number(separatedMonth[0])
    if (month === 13) {
        month = 1;
        year += 1;
    }
    return { start: checkedMonth + "-01", end: `${year}-${String(month).padStart(2, "0")}-01` };
}

app.get("/", (req, res) => {
    res.render("index.ejs")
});

app.get("/expenses", async (req, res) => {
    try {
        const messages = new Map([["deleted", "Expense deleted"], ["added", "Expense added"], ["edited", "Expense edited"]]);
        const message = messages.get(req.query.msg);
        const filter = getFilter(req.query.category);
        const checkedMonth = getMonth(req.query.month);
        const monthRange = getMonthRange(checkedMonth)
        const conditions = [];
        const params = [];
        if (filter) {
            params.push(filter)
            conditions.push(`category = $${params.length}`);
        }
        if (monthRange) {
            params.push(monthRange.start);
            conditions.push(`date >= $${params.length}`)
            params.push(monthRange.end);
            conditions.push(`date < $${params.length}`)
        }
        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
        const result = await db.query(`SELECT * FROM expenses ${where} ORDER BY date DESC, id DESC`, params);
        const totalResult = await db.query(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses ${where}`, params)
        const total = Number(totalResult.rows[0].total).toFixed(2)
        const count = Number(totalResult.rows[0].count)
        const data = result.rows
        res.render("expenses.ejs", { expenses: data, message: message, categoryOptions, filter, monthRange, month: checkedMonth, total, count })
    } catch (err) {
        console.error(err)
        res.status(500).render("index.ejs", { error: "Unexpected error, Please try again", categoryOptions })
    }
});

app.get("/expenses/new", (req, res) => {
    res.render("newexpense.ejs", { categoryOptions: categoryOptions, values: null })
});

app.get("/expenses/:id/edit", async (req, res) => {
    const id = req.params.id
    const filter = getFilter(req.query.category);
    const month = getMonth(req.query.month);
    try {
        if (!/^\d+$/.test(id) || Number(id) > 2147483647) {
            return res.status(400).render("index.ejs", { error: "Invalid expense id" })
        }
        const result = await db.query("SELECT * FROM expenses WHERE id=$1", [id])
        if (result.rowCount === 0) {
            return res.status(404).render("index.ejs", { error: "The expense you are trying to edit is not found." })
        }
        const data = result.rows[0]
        res.render("editexpense.ejs", { id, values: data, categoryOptions, filter, month })
    }
    catch (err) {
        console.error(err)
        res.status(500).render("index.ejs", { error: "Unexpected error, Please try again" })
    }
});

app.post("/expenses/new", async (req, res) => {
    const amount = req.body.amount;
    const category = req.body.category;
    const date = req.body.date;
    const description = req.body.description;
    let validation = null;
    try {
        validation = validateExpense({ amount, category, description, date })
        if (validation.error) {
            return res.status(400).render("newexpense.ejs", { categoryOptions, values: validation, error: validation.error })
        }
        await db.query("INSERT INTO expenses (amount, category, description, date) VALUES ($1, $2, $3, $4)", [
            validation.amount,
            validation.category,
            validation.description,
            validation.date]);
        res.redirect("/expenses?msg=added");
    }
    catch (err) {
        console.error(err)
        res.status(500).render("newexpense.ejs", { error: "Unexpected error, Please try again", categoryOptions: categoryOptions, values: validation ?? {} })
    }
});

app.post("/expenses/:id/edit", async (req, res) => {
    const id = req.params.id
    const amount = req.body.amount;
    const category = req.body.category;
    const date = req.body.date;
    const description = req.body.description;
    let validation = null;
    const filter = getFilter(req.query.category);
    const month = getMonth(req.query.month);
    try {
        const params = new URLSearchParams({ msg: "edited" });
        if (!/^\d+$/.test(id) || Number(id) > 2147483647) {
            return res.status(400).render("index.ejs", { error: "Invalid expense id" })
        }
        validation = validateExpense({ amount, category, description, date })
        if (validation.error) {
            return res.status(400).render("editexpense.ejs", { categoryOptions, values: validation, error: validation.error, id, filter, month })
        }
        const result = await db.query("UPDATE expenses SET amount = $1, category = $2, description = $3, date = $4 WHERE id = $5", [
            validation.amount,
            validation.category,
            validation.description,
            validation.date,
            id])
        if (result.rowCount === 0) {
            return res.status(404).render("index.ejs", { error: "The expense you are trying to edit is not found." })
        }
        if (filter) params.set("category", filter);
        if (month) params.set("month", month);
        res.redirect("/expenses?" + params.toString())
    }
    catch (err) {
        console.error(err);
        res.status(500).render("editexpense.ejs", { error: "Unexpected error, Please try again", categoryOptions: categoryOptions, values: validation ?? {}, id, filter, month })
    }
});

app.post("/expenses/:id/delete", async (req, res) => {
    try {
        const id = req.params.id
        const filter = getFilter(req.query.category);
        const params = new URLSearchParams({ msg: "deleted" });
        const month = getMonth(req.query.month);
        if (!/^\d+$/.test(id) || Number(id) > 2147483647) {
            return res.status(400).render("index.ejs", { error: "Invalid expense id" })
        }
        const result = await db.query("DELETE FROM expenses WHERE id=$1", [id])
        if (result.rowCount === 0) {
            return res.status(404).render("index.ejs", { error: "The expense you are trying to delete is not found." })
        }
        if (filter) params.set("category", filter);
        if (month) params.set("month", month);
        res.redirect("/expenses?" + params.toString())
    }
    catch (err) {
        console.error(err)
        res.status(500).render("index.ejs", { error: "Unexpected error, Please try again" })
    }
});

app.listen(3000, () => { console.log("Server running on port 3000") })