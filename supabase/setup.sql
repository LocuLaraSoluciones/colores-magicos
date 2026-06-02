-- ============================================================
-- COLORES MÁGICOS — Setup completo de Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. TABLA DE PERFILES
-- (extiende la tabla auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA DE COLORES DESCUBIERTOS
CREATE TABLE IF NOT EXISTS public.discovered_colors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  color_hex    TEXT NOT NULL,
  color_name   TEXT NOT NULL,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, color_hex)
);

-- 3. TABLA DE DIBUJOS
CREATE TABLE IF NOT EXISTS public.drawings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'Mi dibujo',
  image_url    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;

-- PROFILES
-- Cada usuario puede leer su propio perfil
CREATE POLICY "Own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin puede leer todos los perfiles
CREATE POLICY "Admin reads all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DISCOVERED COLORS
-- Usuarios leen sus propios colores
CREATE POLICY "Own discovered colors" ON public.discovered_colors
  FOR ALL USING (auth.uid() = user_id);

-- Admin lee todos
CREATE POLICY "Admin reads all discovered" ON public.discovered_colors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DRAWINGS
-- Usuarios leen/crean sus propios dibujos
CREATE POLICY "Own drawings" ON public.drawings
  FOR ALL USING (auth.uid() = user_id);

-- Admin lee todos
CREATE POLICY "Admin reads all drawings" ON public.drawings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- TRIGGER: auto-crear perfil al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STORAGE: bucket para dibujos
-- ============================================================
-- Ejecutar esto en el SQL Editor también:
INSERT INTO storage.buckets (id, name, public)
VALUES ('drawings', 'drawings', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users upload own drawings" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'drawings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public read drawings" ON storage.objects
  FOR SELECT USING (bucket_id = 'drawings');

CREATE POLICY "Users delete own drawings" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'drawings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- ¡LISTO! Ahora registrá los 3 usuarios en Authentication
-- ============================================================
-- 
-- OPCIÓN A: Desde Supabase Dashboard → Authentication → Users → Add user
--
--   1. Papa (admin):
--      Email:    papa@coloresmagicos.com
--      Password: (elegí una)
--      Después de crearlo, ejecutar:
--      UPDATE profiles SET role = 'admin', display_name = 'Papá' WHERE id = '<UUID del usuario>';
--
--   2. Ahitana:
--      Email:    ahitana@coloresmagicos.com
--      Password: (elegí una)
--      UPDATE profiles SET display_name = 'Ahitana' WHERE id = '<UUID>';
--
--   3. Anamey:
--      Email:    anamey@coloresmagicos.com
--      Password: (elegí una)
--      UPDATE profiles SET display_name = 'Anamey' WHERE id = '<UUID>';
--
-- OPCIÓN B (más rápida): Usar el script de seed de abajo
-- ============================================================
