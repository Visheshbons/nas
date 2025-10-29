import express from "express";
import chalk from "chalk";

const app = express();
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is up and running on port ${chalk.green(port)}!`);
});
