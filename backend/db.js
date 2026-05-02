const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://batt_resolve_t1_user:5CWEy1RyelUk6gAgI9ACquLTZMxX1iN5@dpg-d7qmvrvlk1mc73cl72j0-a.oregon-postgres.render.com/batt_resolve_t1",
  ssl: false // local
});

module.exports = pool;