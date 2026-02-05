-- =====================================================
-- LIBRARY MENU TABLE - Perzistentní úložiště pro menu strukturu
-- =====================================================

-- Tabulka pro menu strukturu knihovny (místo Deno KV)
CREATE TABLE IF NOT EXISTS library_menus (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL UNIQUE,  -- 'dejepis', 'fyzika', etc.
  menu jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE library_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_menus_read" ON library_menus
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "library_menus_write" ON library_menus
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabulka pro library content (odkazy na teacher_boards, worksheets, pages)
CREATE TABLE IF NOT EXISTS library_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,           -- 'dejepis', 'fyzika'
  menu_path text[],                 -- ['6-rocnik', 'starovek', 'egypt']
  content_type text NOT NULL,       -- 'board', 'worksheet', 'text', 'page'
  content_id uuid,                  -- ID v teacher_boards/worksheets/documents
  page_slug text,                   -- Pro stránky v KV store
  title text NOT NULL,
  description text,
  icon text,
  order_index integer DEFAULT 0,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexy
CREATE INDEX IF NOT EXISTS idx_library_content_category ON library_content(category);
CREATE INDEX IF NOT EXISTS idx_library_content_path ON library_content USING gin(menu_path);

-- RLS policies
ALTER TABLE library_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_content_read" ON library_content
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "library_content_write" ON library_content
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Vložit základní menu pro Dějepis
INSERT INTO library_menus (category, menu)
VALUES (
  'dejepis',
  '[
    {
      "id": "dejepis-6-rocnik",
      "label": "6. ročník",
      "icon": "graduation-cap",
      "color": "#d97706",
      "children": [
        {
          "id": "dejepis-6-starovek",
          "label": "Starověk",
          "icon": "pyramid",
          "children": []
        }
      ]
    },
    {
      "id": "dejepis-7-rocnik",
      "label": "7. ročník",
      "icon": "graduation-cap",
      "color": "#d97706",
      "children": []
    },
    {
      "id": "dejepis-8-rocnik",
      "label": "8. ročník",
      "icon": "graduation-cap",
      "color": "#d97706",
      "children": []
    },
    {
      "id": "dejepis-9-rocnik",
      "label": "9. ročník",
      "icon": "graduation-cap",
      "color": "#d97706",
      "children": []
    }
  ]'::jsonb
)
ON CONFLICT (category) DO UPDATE SET
  menu = EXCLUDED.menu,
  updated_at = now();

SELECT 'Library tables created!' as result;
