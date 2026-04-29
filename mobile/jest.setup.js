// Opcional: silenciar warnings de act() de @expo/vector-icons en tests.
// Si molesta en CI, descomenta el bloque siguiente:
/*
const originalError = console.error;
console.error = (...args) => {
  const first = args[0];
  if (typeof first === "string" && first.includes("Icon inside a test")) return;
  originalError.apply(console, args);
};
*/
