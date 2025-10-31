describe('math basics', () => {
  it('pro-rata forward split', () => {
    const exceso = 1000000;
    const mesesRestantes = 10;
    const cuota = exceso / mesesRestantes;
    expect(cuota).toBe(100000);
  });

  it('coverage vs payroll', () => {
    const cobertura = 65600000;
    const nomina = 70000000;
    const gap = nomina - cobertura; // déficit
    expect(gap).toBe(4400000);
  });
});
