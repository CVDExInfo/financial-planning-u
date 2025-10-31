export const handler = async () => {
  const rubros = [
    { id: 'R001', nombre: 'Honorarios Profesionales', categoria: 'Servicios' },
    { id: 'R002', nombre: 'Nómina', categoria: 'Personal' },
    { id: 'R003', nombre: 'Infraestructura', categoria: 'Tecnología' },
    { id: 'R004', nombre: 'Licencias y Software', categoria: 'Tecnología' },
    { id: 'R005', nombre: 'Capacitación', categoria: 'Personal' }
  ];

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rubros })
  };
};
