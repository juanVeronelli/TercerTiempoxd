const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.test") });
if (!process.env.DATABASE_URL) {
  require("dotenv").config();
}
process.env.NODE_ENV = "test";
