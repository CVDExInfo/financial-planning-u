describe('math basics', () => {
  it('pro-rata forward split', () => {
    const exceso = 1000000;
    const mesesRestantes = 10;
    const cuota = exceso / mesesRestantes;
    expect(cuota).toBe(100000);
  });

  it('pro-rata 3-month split with rounding', () => {
    const exceso = 1000000;
    const meses = 3;
    const cuotaBase = Math.floor(exceso / meses * 100) / 100; // 333333.33
    const cuota1 = cuotaBase;
    const cuota2 = cuotaBase;
    const cuota3 = Math.round((exceso - cuota1 - cuota2) * 100) / 100; // 333333.34 (remainder, rounded)
    
    expect(cuota1).toBe(333333.33);
    expect(cuota2).toBe(333333.33);
    expect(cuota3).toBe(333333.34);
    expect(cuota1 + cuota2 + cuota3).toBe(exceso);
  });

  it('coverage vs payroll', () => {
    const cobertura = 65600000;
    const nomina = 70000000;
    const gap = nomina - cobertura; // déficit
    expect(gap).toBe(4400000);
  });

  it('coverage percentage calculation', () => {
    const ingresos = 65600000;
    const nomina = 70000000;
    const coveragePercent = (ingresos / nomina) * 100;
    
    expect(coveragePercent).toBeCloseTo(93.71, 2);
    expect(coveragePercent).toBeLessThan(100); // undercoverage
  });
});
