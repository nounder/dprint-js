// This file demonstrates the formatting capabilities of dprint-js
// It intentionally has poor formatting

const badly = "formatted";
let code = { a: 1, b: 2, c: 3 };

function poorlyFormatted(x, y) {
  const result = x + y;
  return result;
}

// Single quotes instead of double quotes
const message = "hello world";

// Inconsistent spacing
if (badly === "formatted") {
  console.log(message);
}

export { code, message, poorlyFormatted };
