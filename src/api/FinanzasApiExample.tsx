/**
 * Example component demonstrating the Finanzas API client usage
 * This component shows how to:
 * 1. List projects
 * 2. Get budget rubros
 * 3. Handle loading and error states
 * 4. Use typed responses
 */

import { useEffect, useState } from 'react';
import { getProjects, getRubros } from '@/api';
import { ApiClientError } from '@/api/client';
import type { ApiResponse } from '@/api/client';

type ProjectsResponse = ApiResponse<'/projects', 'get'>;
type RubrosResponse = ApiResponse<'/catalog/rubros', 'get'>;

export function FinanzasApiExample() {
  const [projects, setProjects] = useState<ProjectsResponse['data']>([]);
  const [rubros, setRubros] = useState<RubrosResponse['data']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Load projects
        const projectsResponse = await getProjects({
          status: 'active',
          limit: 10,
        });
        setProjects(projectsResponse.data);

        // Load rubros
        const rubrosResponse = await getRubros();
        setRubros(rubrosResponse.data);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(`API Error (${err.code}): ${err.message}`);
          
          // Handle specific error cases
          if (err.status === 401) {
            console.error('User needs to authenticate');
            // Redirect to login or show auth modal
          }
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <div className="p-4">Loading Finanzas data...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-800 rounded">
        <h3 className="font-bold">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Finanzas API Demo</h2>
      
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">
          Projects ({projects.length})
        </h3>
        <ul className="space-y-2">
          {projects.map((project) => (
            <li key={project.id} className="border p-3 rounded">
              <div className="font-medium">{project.name}</div>
              <div className="text-sm text-gray-600">
                Code: {project.code} | Status: {project.status}
              </div>
              <div className="text-sm text-gray-600">
                Budget: {project.currency} {project.mod_total?.toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">
          Budget Rubros ({rubros.length})
        </h3>
        <ul className="space-y-2">
          {rubros.map((rubro) => (
            <li key={rubro.id} className="border p-3 rounded">
              <div className="font-medium">{rubro.nombre}</div>
              <div className="text-sm text-gray-600">
                Code: {rubro.code} | Type: {rubro.tipo_ejecucion}
              </div>
              <div className="text-sm text-gray-600">
                Category: {rubro.categoria}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded">
        <p className="text-sm text-gray-700">
          💡 <strong>Tip:</strong> Toggle mock mode by setting{' '}
          <code className="bg-gray-200 px-1 rounded">VITE_USE_MOCKS=true</code>{' '}
          in your environment variables.
        </p>
      </div>
    </div>
  );
}
