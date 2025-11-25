import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Upload,
  Download,
  PencilSimple,
  TrashSimple,
  MagnifyingGlass,
} from "@phosphor-icons/react";

export function CostCatalog() {
  const [searchTerm, setSearchTerm] = useState("");

  // Mock data para demostración (no se usa en producción aún)
  const mockLineItems = [
    {
      id: "support_1",
      category: "Soporte",
      subtype: "Servicios Premium",
      description: "Ikusi Platinum – 12 meses",
      unit_cost: 8500,
      currency: "USD",
      recurring: true,
    },
    {
      id: "support_2",
      category: "Soporte",
      subtype: "Servicios Estándar",
      description: "Ikusi Gold – 12 meses",
      unit_cost: 4200,
      currency: "USD",
      recurring: true,
    },
    {
      id: "support_3",
      category: "Soporte",
      subtype: "Servicios Básicos",
      description: "Ikusi Go – Setup de licencias",
      unit_cost: 1200,
      currency: "USD",
      recurring: false,
    },
  ];

  const filteredItems = mockLineItems.filter(
    (item) =>
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Catálogo de Costos
        </h1>
        <p className="text-muted-foreground">
          Diseña y organiza partidas de costo para la estimación y el
          seguimiento financiero de tus proyectos.
        </p>
      </div>

      {/* Búsqueda y acciones */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Buscar partidas de costo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex space-x-2">
          <Button className="flex items-center space-x-2">
            <Plus size={16} />
            <span>Agregar partida</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Upload size={16} />
            <span>Importar CSV</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download size={16} />
            <span>Exportar</span>
          </Button>
        </div>
      </div>

      {/* Grid de partidas */}
      <div className="grid gap-4">
        {filteredItems.map((item) => (
          <Card
            key={item.id}
            className="glass-card transition-shadow hover:shadow-md"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center space-x-3">
                    <Badge variant="secondary">{item.category}</Badge>
                    <Badge variant="outline">{item.subtype}</Badge>
                    {item.recurring && (
                      <Badge
                        variant="outline"
                        className="text-primary"
                      >
                        Recurrente
                      </Badge>
                    )}
                  </div>

                  <h3 className="mb-1 text-lg font-semibold text-foreground">
                    {item.description}
                  </h3>

                  <div className="text-2xl font-bold text-primary">
                    ${item.unit_cost.toLocaleString()} {item.currency}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-primary/10"
                  >
                    <PencilSimple size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <TrashSimple size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">
              {searchTerm
                ? "Ninguna partida coincide con tu búsqueda."
                : "Aún no hay partidas de costo. Comienza agregando la primera."}
            </div>
            <Button className="mt-4" onClick={() => setSearchTerm("")}>
              {searchTerm ? "Limpiar búsqueda" : "Agregar primera partida"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
