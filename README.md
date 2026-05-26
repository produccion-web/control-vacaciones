# Control vacaciones SaaS

App multiempresa y multiusuario para gestionar vacaciones de trabajadores.

## Stack

- React + Vite
- Tailwind CSS
- Supabase Auth + PostgreSQL + RLS
- Vercel para despliegue gratuito

## Puesta en marcha local

```bash
npm install
cp .env.example .env
npm run dev
```

Rellena `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde Supabase.

## Supabase

1. Crea un proyecto en Supabase.
2. Abre SQL Editor.
3. Ejecuta `supabase/schema.sql`.
4. En Authentication, activa email/password.
5. Crea una cuenta desde la app.
6. Crea una empresa desde el panel.

## Despliegue en Vercel

1. Sube esta carpeta a GitHub.
2. Importa el repositorio en Vercel.
3. Añade las variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

## Seguridad multiempresa

Los datos están aislados por `organization_id`. Las políticas RLS solo permiten leer datos a miembros de la empresa y escribir a `owner/admin`.

## Próximas mejoras recomendadas

- Pantalla para invitar usuarios a una empresa.
- Roles más detallados: supervisor, empleado, solo lectura.
- Solicitudes pendientes de aprobación.
- Exportación Excel/PDF.
- Tabla `holidays` editable por empresa y año.
