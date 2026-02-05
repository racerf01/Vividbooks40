-- =====================================================
-- DĚJEPIS - Struktura v Knihovně Vividbooks
-- =====================================================

-- 1. Vytvořit kategorii Dějepis v category_menus (pokud existuje)
INSERT INTO category_menus (category, menu, created_at, updated_at)
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
          "children": [
            {"id": "dejepis-6-uvod", "label": "Úvod do studia dějepisu", "slug": "dejepis-6-uvod", "type": "folder"},
            {"id": "dejepis-6-egypt", "label": "Starověký Egypt", "slug": "dejepis-6-egypt", "type": "folder"},
            {"id": "dejepis-6-mezopotamie", "label": "Mezopotámie", "slug": "dejepis-6-mezopotamie", "type": "folder"},
            {"id": "dejepis-6-recko", "label": "Starověké Řecko", "slug": "dejepis-6-recko", "type": "folder"},
            {"id": "dejepis-6-rim", "label": "Starověký Řím", "slug": "dejepis-6-rim", "type": "folder"}
          ]
        }
      ]
    },
    {
      "id": "dejepis-7-rocnik",
      "label": "7. ročník",
      "icon": "graduation-cap",
      "color": "#d97706",
      "children": [
        {
          "id": "dejepis-7-stredovek",
          "label": "Středověk",
          "icon": "castle",
          "children": [
            {"id": "dejepis-7-francie", "label": "Francká říše", "slug": "dejepis-7-francie", "type": "folder"},
            {"id": "dejepis-7-cechy", "label": "České země ve středověku", "slug": "dejepis-7-cechy", "type": "folder"},
            {"id": "dejepis-7-krizove", "label": "Křížové výpravy", "slug": "dejepis-7-krizove", "type": "folder"},
            {"id": "dejepis-7-husitske", "label": "Husitské hnutí", "slug": "dejepis-7-husitske", "type": "folder"}
          ]
        }
      ]
    },
    {
      "id": "dejepis-8-rocnik",
      "label": "8. ročník",
      "icon": "graduation-cap",
      "color": "#d97706",
      "children": [
        {
          "id": "dejepis-8-novovek",
          "label": "Novověk",
          "icon": "globe",
          "children": [
            {"id": "dejepis-8-objevy", "label": "Zámořské objevy", "slug": "dejepis-8-objevy", "type": "folder"},
            {"id": "dejepis-8-reformace", "label": "Reformace", "slug": "dejepis-8-reformace", "type": "folder"},
            {"id": "dejepis-8-30leta", "label": "Třicetiletá válka", "slug": "dejepis-8-30leta", "type": "folder"},
            {"id": "dejepis-8-revoluce", "label": "Velká francouzská revoluce", "slug": "dejepis-8-revoluce", "type": "folder"},
            {"id": "dejepis-8-prumyslova", "label": "Průmyslová revoluce", "slug": "dejepis-8-prumyslova", "type": "folder"}
          ]
        }
      ]
    },
    {
      "id": "dejepis-9-rocnik",
      "label": "9. ročník",
      "icon": "graduation-cap",
      "color": "#d97706",
      "children": [
        {
          "id": "dejepis-9-moderni",
          "label": "Moderní dějiny",
          "icon": "clock",
          "children": [
            {"id": "dejepis-9-ww1", "label": "První světová válka", "slug": "dejepis-9-ww1", "type": "folder"},
            {"id": "dejepis-9-csr", "label": "Vznik Československa", "slug": "dejepis-9-csr", "type": "folder"},
            {"id": "dejepis-9-ww2", "label": "Druhá světová válka", "slug": "dejepis-9-ww2", "type": "folder"},
            {"id": "dejepis-9-komunismus", "label": "Komunistická éra", "slug": "dejepis-9-komunismus", "type": "folder"},
            {"id": "dejepis-9-sametova", "label": "Sametová revoluce", "slug": "dejepis-9-sametova", "type": "folder"}
          ]
        }
      ]
    }
  ]'::jsonb,
  now(),
  now()
)
ON CONFLICT (category) DO UPDATE SET
  menu = EXCLUDED.menu,
  updated_at = now();

-- Hotovo!
SELECT 'Dějepis menu structure created!' as result;
