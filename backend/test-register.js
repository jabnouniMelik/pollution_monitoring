const express = require("express");
const app = express();
app.use(express.json());

const { register } = require("./controllers/authController");

// Test register endpoint
app.post("/test/register", register);

// Simple error handler
app.use((err, req, res, next) => {
  console.error("Error caught:", err.message);
  console.error("Stack:", err.stack);
  res.status(500).json({
    success: false,
    message: err.message,
    stack: err.stack.split("\n").slice(0, 5),
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server on port ${PORT}`);
});
