// R1: Return static rubros catalog. Shape normalized to { data: [...] }
// so CI pipeline smoke step `jq '.data|length'` succeeds and frontend
// can consume without adapter mapping. Future: load from DynamoDB.
export const handler = async () => {
  const data = [
    { id: "R001", nombre: "Honorarios Profesionales", categoria: "Servicios" },
    { id: "R002", nombre: "Nómina", categoria: "Personal" },
    { id: "R003", nombre: "Infraestructura", categoria: "Tecnología" },
    { id: "R004", nombre: "Licencias y Software", categoria: "Tecnología" },
    { id: "R005", nombre: "Capacitación", categoria: "Personal" },
  ];

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  };
};
