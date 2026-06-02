# 🎨 Colores Mágicos — Guía de Deploy

## Estructura del proyecto
```
colores-magicos/
├── app/
│   ├── layout.tsx          ← Layout raíz con fuentes
│   ├── page.tsx            ← Redirige según rol
│   ├── globals.css
│   ├── login/page.tsx      ← Login
│   ├── dashboard/
│   │   ├── page.tsx        ← Router admin/user
│   │   └── game/page.tsx   ← Juego para las nenas
│   └── admin/page.tsx      ← Panel de Papá
├── components/
│   ├── GameClient.tsx      ← Juego interactivo completo
│   └── AdminClient.tsx     ← Panel admin con tabs
├── lib/
│   ├── supabase-browser.ts
│   ├── supabase-server.ts
│   └── game-data.ts        ← Recetas y colores
├── middleware.ts            ← Protección de rutas
├── supabase/setup.sql      ← SQL completo
├── .env.local              ← Variables de entorno (ya completadas)
└── .env.example
```

---

## PASO 1 — Proyecto Supabase ✅ YA CREADO

- **Project URL**: `https://knuvqgnmnsbetazulooa.supabase.co`
- El archivo `.env.local` ya viene pre-completado.

---

## PASO 2 — Ejecutar el SQL

1. Ir a [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor** → **New query**
2. Pegar todo el contenido de `supabase/setup.sql`
3. Click en **Run**
4. Verificar en **Table Editor** que aparecen: `profiles`, `discovered_colors`, `drawings`
5. Verificar en **Storage → Buckets** que aparece el bucket `drawings`

---

## PASO 3 — Crear los 3 usuarios

### 3a. Crear en Authentication
Ir a **Authentication → Users → Add user → Create new user**

| Nombre    | Email                          | Password sugerida |
|-----------|--------------------------------|-------------------|
| Papá      | papa@coloresmagicos.com        | (la que quieras)  |
| Ahitana   | ahitana@coloresmagicos.com     | (simple para ella)|
| Anamey    | anamey@coloresmagicos.com      | (simple para ella)|

> Marcar **"Auto Confirm User"** para que no necesiten confirmar email.

### 3b. Asignar roles y nombres en SQL Editor
Después de crear cada usuario, copiar su UUID (columna "UID" en la lista) y ejecutar:

```sql
-- Reemplazar los UUID con los reales de tu proyecto

-- Papá (ADMIN)
UPDATE public.profiles 
SET role = 'admin', display_name = 'Papá' 
WHERE id = 'UUID-DE-PAPA-ACÁ';

-- Ahitana
UPDATE public.profiles 
SET display_name = 'Ahitana' 
WHERE id = 'UUID-DE-AHITANA-ACÁ';

-- Anamey
UPDATE public.profiles 
SET display_name = 'Anamey' 
WHERE id = 'UUID-DE-ANAMEY-ACÁ';
```

### 3c. Verificar
```sql
SELECT id, display_name, role FROM public.profiles;
```
Deberías ver los 3 usuarios con sus roles correctos.

---

## PASO 4 — Deploy en Vercel

### 4a. Subir el código a GitHub
```bash
# En la carpeta del proyecto:
git init
git add .
git commit -m "Initial commit - Colores Mágicos"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/colores-magicos.git
git push -u origin main
```

> Si no tenés git instalado, también podés subir la carpeta directamente desde github.com → "Upload files".

### 4b. Conectar con Vercel
1. Ir a [vercel.com](https://vercel.com) → **Add New Project**
2. Importar el repo de GitHub
3. Framework: **Next.js** (lo detecta solo)
4. En **Environment Variables** agregar exactamente estos dos:

**Variable 1:**
```
Name:  NEXT_PUBLIC_SUPABASE_URL
Value: https://knuvqgnmnsbetazulooa.supabase.co
```

**Variable 2:**
```
Name:  NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudXZxZ25tbnNiZXRhenVsb29hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjM1MDcsImV4cCI6MjA5NTk5OTUwN30.x5RZBv3-sWBpFDhkIMuu1DjF1P224Hut2jODdZQKqtM
```

5. Click en **Deploy** 🚀

---

## PASO 5 — Verificar que todo funciona

Una vez deployado, probar en orden:

1. `tuapp.vercel.app` → debe redirigir a `/login`
2. Login con `papa@coloresmagicos.com` → debe abrir **Panel de Papá** con 2 tabs (Ahitana / Anamey)
3. Login con `ahitana@coloresmagicos.com` → debe abrir el **juego**
4. En el juego: mezclar Rojo + Azul → aparece Violeta con fuegos artificiales ✨
5. Pintar algo y guardar → aparece en la galería del panel de Papá

---

## Uso diario

- **Papá**: entra con su usuario, ve las pestañas de cada hija con sus colores descubiertos, dibujos guardados y progreso
- **Ahitana / Anamey**: entran con sus usuarios, juegan, mezclan, pintan y guardan dibujos
- El progreso se guarda automáticamente en Supabase

---

## Problemas frecuentes

**"Error: relation profiles does not exist"**
→ El SQL no se ejecutó. Ir al SQL Editor y ejecutar `setup.sql` de nuevo.

**"Infinite redirect loop"**
→ Las variables de entorno no están configuradas en Vercel. Verificar en Settings → Environment Variables.

**"Las imágenes no se guardan"**
→ El bucket `drawings` no existe o las políticas están mal. Re-ejecutar el SQL completo.

**"Acceso denegado al panel de admin"**
→ El UPDATE del rol de Papá no se ejecutó. Verificar con `SELECT * FROM profiles`.
