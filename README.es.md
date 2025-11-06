
# UI de Planificación Financiera y Entrega de Servicios

Interfaz de nivel empresarial para la estimación de Pre-Factura (PMO) y el costeo/pronóstico (SDMT). Esta SPA está construida con React + Vite + Tailwind y se publica detrás de CloudFront en el prefijo de ruta `/finanzas/`.

El backend de este proyecto vive en `services/finanzas-api` y está definido con AWS SAM. El contrato OpenAPI está en `openapi/finanzas.yaml`.

## Resumen

- Frontend: React 19, Vite 6, Tailwind v4, sistema de diseño GitHub Spark, Radix UI
- Base de rutas: `/finanzas/` (Vite) y `/finanzas` (React Router)
- Hosting: S3 (privado) + CloudFront, comportamiento con patrón `/finanzas/*`
- Autenticación y roles (a nivel UI): PMO, SDMT, VENDOR, EXEC_RO (solo lectura)
- Datos: API simulada en `src/lib/api.ts` para desarrollo local; contrato real en `openapi/finanzas.yaml`

## Requisitos previos

- Node.js >= 18.18
- npm >= 9
- AWS CLI (para despliegue)

## Inicio rápido (dev)

```bash
npm ci
npm run dev
```

Vite levantará un servidor de desarrollo (normalmente en <http://localhost:5173>). Las rutas de la app parten de `/finanzas`, por lo que las URLs locales lucen como `http://localhost:5173/finanzas/`.

## Build

```bash
npm run build
```

Los artefactos se generan en `dist/` con el base URL correcto incorporado (`/finanzas/`). Para previsualizar localmente el build de producción:

```bash
npm run preview
```

## Despliegue (S3 + CloudFront)

Esta app está diseñada para servirse en el prefijo de ruta de CloudFront `/finanzas/`. Hay dos requisitos esenciales:

1. Un comportamiento de CloudFront configurado para `/finanzas/*` que apunte a tu origen S3 (con OAC)
2. Objetos en S3 almacenados bajo el prefijo de clave `finanzas/` (así `/finanzas/index.html` mapea a `s3://<bucket>/finanzas/index.html`)

El bucket y la distribución recomendados están documentados en `infra/README.md`:

- Bucket: `ukusi-ui-finanzas-prod` (privado, con versionado y cifrado)
- Distribución: `EPQU7PVDLQXUA` (ejemplo)

### Infraestructura (una sola vez)

Usa Terraform en `infra/` para aprovisionar el bucket S3, OAC y políticas de caché. Luego, en la consola de CloudFront, agrega:

- Origen: tu bucket S3 (con OAC)
- Comportamiento: patrón de ruta `/finanzas/*`
- Respuestas de error personalizadas para deep links de SPA:
  - 403 → `/finanzas/index.html`
  - 404 → `/finanzas/index.html`

Consulta `infra/README.md` para instrucciones paso a paso.

### Subida e invalidación

Después de `npm run build`, sube el contenido de `dist/` al prefijo `finanzas/` en S3 e invalida CloudFront:

```bash
# Sube al prefijo finanzas/ para que las claves coincidan con la ruta de CloudFront
aws s3 sync dist/ s3://ukusi-ui-finanzas-prod/finanzas/ --delete

# Invalida la ruta /finanzas/* para que los clientes obtengan la última versión
aws cloudfront create-invalidation \
  --distribution-id EPQU7PVDLQXUA \
  --paths '/finanzas/*'
```

Consejo: Hay un script de ayuda para crear el bucket S3 con las políticas recomendadas: `scripts/create-s3-bucket.sh`.

## Enrutamiento y base de la SPA

La app está configurada explícitamente para la base `/finanzas`:

- `vite.config.ts` → `base: '/finanzas/'`
- `src/App.tsx` → `<BrowserRouter basename="/finanzas">`
- Comportamiento de CloudFront → `/finanzas/*`
- Claves en S3 → sube el build al prefijo `finanzas/`

Esto asegura que los deep links como `/finanzas/pmo/prefactura/estimator` funcionen tanto localmente como detrás de CloudFront. Asegúrate de que las respuestas de error personalizadas de CloudFront devuelvan `/finanzas/index.html` para 403/404 y así soportar el enrutamiento de SPA.

## Roles y acceso (UI)

La UI simula acceso y permisos basados en roles:

- Roles: `PMO`, `SDMT`, `VENDOR`, `EXEC_RO` (solo lectura)
- Cambio de rol: barra superior → menú desplegable con la insignia del rol (visible cuando hay múltiples roles disponibles)
- Rutas predeterminadas por rol:
  - PMO → `/finanzas/pmo/prefactura/estimator`
  - SDMT → `/finanzas/sdmt/cost/catalog`
  - VENDOR → `/finanzas/sdmt/cost/catalog`
  - EXEC_RO → `/finanzas/sdmt/cost/cashflow`

Durante el desarrollo local, la app utilizará un usuario de demostración si el runtime de Spark no está presente, y podrás cambiar de rol desde el menú. Para una verificación rápida, navega a `/profile` para ver la información del usuario y sus roles.

## API de backend

- OpenAPI: `openapi/finanzas.yaml` (validado con Spectral; ver `docs/endpoint-coverage.md`)
- Servicio SAM: `services/finanzas-api/` con múltiples Lambdas y tablas DynamoDB
- Estado: Endpoints núcleo (health, catalog, projects, handoff) implementados; otros están esqueleto para R1

La UI actualmente usa datos simulados en `src/lib/api.ts`. Para integrar la API real, introduce un cliente HTTP (p. ej. fetch o axios) con una base URL configurable y reemplaza progresivamente los métodos de `ApiService`.

## Scripts útiles

- `npm run dev` → inicia el servidor de desarrollo
- `npm run build` → build de producción (dist/)
- `npm run preview` → previsualiza el build generado
- `npm run lint` → lint del workspace
- `scripts/create-s3-bucket.sh` → crea y configura el bucket S3 para hosting
- `scripts/deploy-check.sh` → verificación amigable para CI (lint/build). Ajusta según sea necesario.

## Solución de problemas

- Los deep links regresan 404 vía CloudFront
  - Asegúrate de que las respuestas de error personalizadas de CloudFront mapeen 403/404 a `/finanzas/index.html`
- Archivos estáticos en 404 tras el despliegue
  - Verifica que subiste a `s3://<bucket>/finanzas/` y no a la raíz del bucket
- Pantalla en blanco o base URL incorrecta en local
  - Confirma que `vite.config.ts` usa base `/finanzas/` y el router usa basename `/finanzas`
- Pantallas de permiso denegado
  - Cambia de rol usando el menú de la barra superior; AccessControl te redirigirá a la ruta por defecto de tu rol

## Mapa del repositorio (rápido)

- Frontend: `src/` (components, features, lib, mocks)
- Infra (hosting de UI): `infra/` (Terraform + instrucciones manuales de CF)
- Backend (API): `services/finanzas-api/` (plantilla SAM y handlers)
- OpenAPI: `openapi/finanzas.yaml`
- Docs: `docs/` (cobertura de endpoints, configuración de entornos, uso de auth)

---

¿Preguntas o problemas? Comienza con `infra/README.md` para detalles de hosting, `docs/endpoint-coverage.md` para validación de API, o abre un issue en este repositorio.
