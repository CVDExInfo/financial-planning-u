/**
 * Unified Rubro Form Modal
 * 
 * Shared component for adding/editing rubros in:
 * - Catálogo de Rubros → "Agregar Rubro a Proyecto"
 * - Estructura de Costos → "Agregar Nuevo Rubro"
 * 
 * Features:
 * - Taxonomy-driven categoria + línea de gasto selectors
 * - Auto-fills descripción from taxonomy
 * - RBAC-aware project selection
 * - Consistent validation and error handling
 */

import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRubrosTaxonomy } from '@/hooks/useRubrosTaxonomy';
import type { RubroFormData } from '@/types/rubros';

export interface RubroFormModalProps {
  /** Whether the modal is open */
  open: boolean;
  
  /** Callback when modal should close */
  onOpenChange: (open: boolean) => void;
  
  /** Callback when form is submitted with valid data */
  onSubmit: (data: RubroFormData & { projectId: string }) => Promise<void>;
  
  /** Modal context - affects title and behavior */
  context: 'catalog' | 'estructura';
  
  /** Project ID when in project context (estructura) - makes field read-only */
  projectId?: string;
  
  /** Project display info for read-only chip */
  projectDisplay?: {
    code: string;
    name: string;
    client?: string;
  };
  
  /** Available projects for selection (catalog context) */
  availableProjects?: Array<{
    projectId: string;
    code: string;
    name: string;
    client?: string;
  }>;
  
  /** Whether form is submitting */
  isSubmitting?: boolean;
  
  /** Pre-selected rubro (optional, for edit mode) */
  initialRubro?: Partial<RubroFormData>;
}

export default function RubroFormModal({
  open,
  onOpenChange,
  onSubmit,
  context,
  projectId: contextProjectId,
  projectDisplay,
  availableProjects = [],
  isSubmitting = false,
  initialRubro,
}: RubroFormModalProps) {
  const { categories, getRubrosByCategory, getRubroById } = useRubrosTaxonomy();
  
  // Form state
  const [projectId, setProjectId] = useState(contextProjectId || '');
  const [categoriaCodig, setCategoriaCodig] = useState(initialRubro?.categoria_codigo || '');
  const [rubroId, setRubroId] = useState(initialRubro?.rubroId || '');
  const [tipo, setTipo] = useState<'una_vez' | 'recurrente'>(initialRubro?.tipo || 'recurrente');
  const [mesInicio, setMesInicio] = useState(initialRubro?.mes_inicio?.toString() || '1');
  const [plazoMeses, setPlazoMeses] = useState(initialRubro?.plazo_meses?.toString() || '12');
  const [cantidad, setCantidad] = useState(initialRubro?.cantidad?.toString() || '1');
  const [costoUnitario, setCostoUnitario] = useState(initialRubro?.costo_unitario?.toString() || '0');
  const [moneda, setMoneda] = useState<'USD' | 'EUR' | 'MXN' | 'COP'>(initialRubro?.moneda || 'USD');
  const [notas, setNotas] = useState(initialRubro?.notas || '');
  
  // Get rubros for selected category
  const availableRubros = useMemo(() => {
    if (!categoriaCodig) return [];
    return getRubrosByCategory(categoriaCodig);
  }, [categoriaCodig, getRubrosByCategory]);
  
  // Get taxonomy entry for selected rubro
  const selectedTaxonomy = useMemo(() => {
    if (!rubroId) return null;
    return getRubroById(rubroId);
  }, [rubroId, getRubroById]);
  
  // Reset rubro when category changes
  useEffect(() => {
    if (categoriaCodig && rubroId) {
      const currentRubro = getRubroById(rubroId);
      if (!currentRubro || currentRubro.categoria_codigo !== categoriaCodig) {
        setRubroId('');
      }
    }
  }, [categoriaCodig, rubroId, getRubroById]);
  
  // Update projectId when context changes
  useEffect(() => {
    if (contextProjectId) {
      setProjectId(contextProjectId);
    }
  }, [contextProjectId]);
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!projectId) {
      return; // Should be caught by required attribute
    }
    
    if (!categoriaCodig || !rubroId) {
      return; // Should be caught by required attributes
    }
    
    const parsedMesInicio = parseInt(mesInicio, 10);
    const parsedPlazoMeses = parseInt(plazoMeses, 10);
    const parsedCantidad = parseFloat(cantidad);
    const parsedCostoUnitario = parseFloat(costoUnitario);
    
    if (
      !Number.isFinite(parsedMesInicio) ||
      !Number.isFinite(parsedPlazoMeses) ||
      !Number.isFinite(parsedCantidad) ||
      !Number.isFinite(parsedCostoUnitario)
    ) {
      return;
    }
    
    const formData: RubroFormData & { projectId: string } = {
      projectId,
      categoria_codigo: categoriaCodig,
      rubroId,
      descripcion: selectedTaxonomy?.descripcion,
      tipo,
      mes_inicio: parsedMesInicio,
      plazo_meses: parsedPlazoMeses,
      cantidad: parsedCantidad,
      costo_unitario: parsedCostoUnitario,
      moneda,
      notas: notas || undefined,
    };
    
    await onSubmit(formData);
  };
  
  const modalTitle = context === 'catalog' 
    ? 'Agregar Rubro a Proyecto'
    : 'Agregar Nuevo Rubro';
  
  const modalDescription = context === 'catalog'
    ? 'Asocia este rubro del catálogo a un proyecto específico'
    : 'Agrega un nuevo rubro al proyecto desde la taxonomía canónica';
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Project Selection */}
            <div className="grid gap-2">
              <Label htmlFor="project">Proyecto *</Label>
              {contextProjectId && projectDisplay ? (
                // Read-only project chip when in project context
                <div className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/30">
                  <Badge variant="secondary">{projectDisplay.code}</Badge>
                  <span className="text-sm font-medium">{projectDisplay.name}</span>
                  {projectDisplay.client && (
                    <span className="text-sm text-muted-foreground">· {projectDisplay.client}</span>
                  )}
                </div>
              ) : (
                // Searchable dropdown when in catalog context
                <Select value={projectId} onValueChange={setProjectId} required>
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Selecciona un proyecto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProjects.map((proj) => (
                      <SelectItem key={proj.projectId} value={proj.projectId}>
                        <span className="font-medium">{proj.code}</span>
                        {' · '}
                        {proj.name}
                        {proj.client && (
                          <span className="text-muted-foreground"> · {proj.client}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            {/* Category Selection */}
            <div className="grid gap-2">
              <Label htmlFor="categoria">Categoría *</Label>
              <Select value={categoriaCodig} onValueChange={setCategoriaCodig} required>
                <SelectTrigger id="categoria">
                  <SelectValue placeholder="Selecciona una categoría..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.codigo} value={cat.codigo}>
                      <span className="font-medium">{cat.codigo}</span>
                      {' · '}
                      {cat.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Línea de Gasto Selection */}
            <div className="grid gap-2">
              <Label htmlFor="lineaGasto">Línea de Gasto *</Label>
              <Select 
                value={rubroId} 
                onValueChange={setRubroId} 
                disabled={!categoriaCodig}
                required
              >
                <SelectTrigger id="lineaGasto">
                  <SelectValue placeholder={
                    categoriaCodig 
                      ? "Selecciona una línea de gasto..." 
                      : "Primero selecciona una categoría"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {availableRubros.map((rubro) => (
                    <SelectItem key={rubro.id} value={rubro.id}>
                      <span className="font-medium">{rubro.linea_codigo}</span>
                      {' · '}
                      {rubro.linea_gasto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Description (read-only, auto-filled) */}
            {selectedTaxonomy && (
              <div className="grid gap-2">
                <Label>Descripción</Label>
                <div className="p-2 border border-border rounded-md bg-muted/30 text-sm">
                  {selectedTaxonomy.descripcion}
                </div>
              </div>
            )}
            
            {/* Tipo */}
            <div className="grid gap-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as 'una_vez' | 'recurrente')} required>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurrente">Recurrente</SelectItem>
                  <SelectItem value="una_vez">Una vez</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Mes de Inicio and Plazo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="mesInicio">Mes de Inicio *</Label>
                <Input
                  id="mesInicio"
                  type="number"
                  min="1"
                  max="12"
                  value={mesInicio}
                  onChange={(e) => setMesInicio(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">1-12 (enero-diciembre)</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plazoMeses">Plazo (meses) *</Label>
                <Input
                  id="plazoMeses"
                  type="number"
                  min="1"
                  value={plazoMeses}
                  onChange={(e) => setPlazoMeses(e.target.value)}
                  required
                />
              </div>
            </div>
            
            {/* Cantidad and Costo Unitario */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cantidad">Cantidad *</Label>
                <Input
                  id="cantidad"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="costoUnitario">Costo Unitario *</Label>
                <Input
                  id="costoUnitario"
                  type="number"
                  min="0"
                  step="0.01"
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(e.target.value)}
                  required
                />
              </div>
            </div>
            
            {/* Moneda */}
            <div className="grid gap-2">
              <Label htmlFor="moneda">Moneda *</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as any)} required>
                <SelectTrigger id="moneda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="COP">COP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Total calculado */}
            {selectedTaxonomy && (
              <div className="p-3 bg-muted/50 rounded-md border border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Total estimado:</span>
                  <span className="text-lg font-semibold">
                    {new Intl.NumberFormat('es-MX', {
                      style: 'currency',
                      currency: moneda,
                      minimumFractionDigits: 2,
                    }).format(parseFloat(cantidad) * parseFloat(costoUnitario) * parseInt(plazoMeses))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {cantidad} × {costoUnitario} × {plazoMeses} meses
                </p>
              </div>
            )}
            
            {/* Notas */}
            <div className="grid gap-2">
              <Label htmlFor="notas">Notas (opcional)</Label>
              <Input
                id="notas"
                placeholder="Comentarios adicionales..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                maxLength={1000}
              />
            </div>
            
            {context === 'estructura' && (
              <div className="text-xs text-muted-foreground p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-900">
                💡 Los nuevos rubros fluyen al proceso de aprobación SDMT cuando corresponda.
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Agregando...' : 'Agregar Rubro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
