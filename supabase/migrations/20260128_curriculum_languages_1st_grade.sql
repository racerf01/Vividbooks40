-- =====================================================
-- CURRICULUM FACTORY - Jazyky + 1. stupeň ZŠ
-- =====================================================

-- =====================================================
-- NĚMECKÝ JAZYK (German)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'nemcina',
  'Německý jazyk',
  'Německý jazyk pro 2. stupeň ZŠ (úroveň A1-A2)',
  'languages',
  '#FFD700',
  2,
  '{7,8,9}'
) ON CONFLICT (code) DO NOTHING;

-- Němčina 7. třída (A1)
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('nemcina', 7, 'Receptivní dovednosti', 'Poslech a čtení - základy', 
   ARRAY['žák rozumí jednoduchým pokynům', 'čte krátké texty s porozuměním', 'rozpozná známá slova'],
   ARRAY['k učení', 'komunikativní'], 20, 1, '2021'),
  ('nemcina', 7, 'Produktivní dovednosti', 'Představení a základní konverzace', 
   ARRAY['žák se představí', 'popíše sebe a rodinu', 'pozdraví a rozloučí se'],
   ARRAY['komunikativní', 'sociální'], 20, 2, '2021'),
  ('nemcina', 7, 'Jazykové prostředky', 'Přítomný čas a základní slovesa', 
   ARRAY['žák časuje slovesa sein a haben', 'používá přítomný čas', 'tvoří jednoduché věty'],
   ARRAY['k učení', 'komunikativní'], 24, 3, '2021'),
  ('nemcina', 7, 'Tematické okruhy', 'Škola, rodina, volný čas', 
   ARRAY['žák popíše školu', 'mluví o rodině', 'popíše své koníčky'],
   ARRAY['komunikativní', 'sociální'], 16, 4, '2021')
ON CONFLICT DO NOTHING;

-- Němčina 8. třída (A1+)
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('nemcina', 8, 'Jazykové prostředky', 'Minulý čas a modální slovesa', 
   ARRAY['žák používá Perfekt', 'používá modální slovesa', 'tvoří složitější věty'],
   ARRAY['k učení', 'komunikativní'], 24, 1, '2021'),
  ('nemcina', 8, 'Tematické okruhy', 'Nakupování a jídlo', 
   ARRAY['žák nakupuje v obchodě', 'objedná si v restauraci', 'popíše jídlo'],
   ARRAY['komunikativní', 'sociální'], 20, 2, '2021'),
  ('nemcina', 8, 'Tematické okruhy', 'Cestování a město', 
   ARRAY['žák se zeptá na cestu', 'popíše město', 'mluví o dopravě'],
   ARRAY['komunikativní', 'sociální'], 20, 3, '2021'),
  ('nemcina', 8, 'Produktivní dovednosti', 'Psaní - dopis a e-mail', 
   ARRAY['žák napíše neformální dopis', 'vytvoří krátký e-mail', 'popíše svůj den'],
   ARRAY['komunikativní', 'k učení'], 16, 4, '2021')
ON CONFLICT DO NOTHING;

-- Němčina 9. třída (A2)
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('nemcina', 9, 'Jazykové prostředky', 'Vedlejší věty a préteritum', 
   ARRAY['žák používá vedlejší věty', 'používá préteritum', 'tvoří delší texty'],
   ARRAY['k učení', 'komunikativní'], 24, 1, '2021'),
  ('nemcina', 9, 'Tematické okruhy', 'Práce a budoucnost', 
   ARRAY['žák mluví o povoláních', 'popíše své plány', 'napíše životopis'],
   ARRAY['komunikativní', 'pracovní'], 20, 2, '2021'),
  ('nemcina', 9, 'Interkulturní kompetence', 'Německy mluvící země', 
   ARRAY['žák charakterizuje DACH země', 'porovná kultury', 'zná základní reálie'],
   ARRAY['komunikativní', 'občanské'], 20, 3, '2021'),
  ('nemcina', 9, 'Receptivní dovednosti', 'Čtení a poslech - delší texty', 
   ARRAY['žák rozumí delším textům', 'vyhledá informace', 'shrne obsah'],
   ARRAY['k učení', 'komunikativní'], 16, 4, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- FRANCOUZSKÝ JAZYK (French)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'francouzstina',
  'Francouzský jazyk',
  'Francouzský jazyk pro 2. stupeň ZŠ (úroveň A1-A2)',
  'languages',
  '#0055A4',
  2,
  '{7,8,9}'
) ON CONFLICT (code) DO NOTHING;

-- Francouzština 7. třída (A1)
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('francouzstina', 7, 'Receptivní dovednosti', 'Poslech a čtení - základy', 
   ARRAY['žák rozumí jednoduchým pokynům', 'čte krátké texty', 'rozpozná výslovnost'],
   ARRAY['k učení', 'komunikativní'], 20, 1, '2021'),
  ('francouzstina', 7, 'Produktivní dovednosti', 'Představení a pozdravy', 
   ARRAY['žák se představí', 'pozdraví a rozloučí se', 'zeptá se na jméno'],
   ARRAY['komunikativní', 'sociální'], 20, 2, '2021'),
  ('francouzstina', 7, 'Jazykové prostředky', 'Přítomný čas a členy', 
   ARRAY['žák časuje slovesa être a avoir', 'používá členy', 'tvoří jednoduché věty'],
   ARRAY['k učení', 'komunikativní'], 24, 3, '2021'),
  ('francouzstina', 7, 'Tematické okruhy', 'Rodina, škola, barvy', 
   ARRAY['žák popíše rodinu', 'mluví o škole', 'pojmenuje barvy a čísla'],
   ARRAY['komunikativní', 'sociální'], 16, 4, '2021')
ON CONFLICT DO NOTHING;

-- Francouzština 8. třída (A1+)
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('francouzstina', 8, 'Jazykové prostředky', 'Passé composé a budoucí čas', 
   ARRAY['žák používá passé composé', 'vyjádří budoucnost', 'používá zápor'],
   ARRAY['k učení', 'komunikativní'], 24, 1, '2021'),
  ('francouzstina', 8, 'Tematické okruhy', 'Jídlo a nakupování', 
   ARRAY['žák objedná si v kavárně', 'nakupuje', 'popíše jídlo'],
   ARRAY['komunikativní', 'sociální'], 20, 2, '2021'),
  ('francouzstina', 8, 'Tematické okruhy', 'Město a doprava', 
   ARRAY['žák popíše město', 'zeptá se na cestu', 'mluví o dopravě'],
   ARRAY['komunikativní', 'sociální'], 20, 3, '2021'),
  ('francouzstina', 8, 'Produktivní dovednosti', 'Psaní - pohlednice a e-mail', 
   ARRAY['žák napíše pohlednici', 'vytvoří krátký e-mail', 'popíše svůj den'],
   ARRAY['komunikativní', 'k učení'], 16, 4, '2021')
ON CONFLICT DO NOTHING;

-- Francouzština 9. třída (A2)
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('francouzstina', 9, 'Jazykové prostředky', 'Imparfait a podmínkové věty', 
   ARRAY['žák používá imparfait', 'tvoří podmínkové věty', 'používá zájmena'],
   ARRAY['k učení', 'komunikativní'], 24, 1, '2021'),
  ('francouzstina', 9, 'Tematické okruhy', 'Volný čas a kultura', 
   ARRAY['žák mluví o koníčcích', 'popíše kulturní akce', 'vyjádří názor'],
   ARRAY['komunikativní', 'občanské'], 20, 2, '2021'),
  ('francouzstina', 9, 'Interkulturní kompetence', 'Frankofonní země', 
   ARRAY['žák charakterizuje Francii', 'zná frankofonní země', 'porovná kultury'],
   ARRAY['komunikativní', 'občanské'], 20, 3, '2021'),
  ('francouzstina', 9, 'Receptivní dovednosti', 'Čtení a poslech - autentické texty', 
   ARRAY['žák rozumí autentickým textům', 'vyhledá informace', 'shrne obsah'],
   ARRAY['k učení', 'komunikativní'], 16, 4, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 1. STUPEŇ - ČESKÝ JAZYK
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'cestina_1st',
  'Český jazyk (1. st.)',
  'Český jazyk a literatura pro 1. stupeň ZŠ',
  'book-open',
  '#DC143C',
  8,
  '{1,2,3,4,5}'
) ON CONFLICT (code) DO NOTHING;

-- Čeština 1. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('cestina_1st', 1, 'Komunikační a slohová výchova', 'Mluvení a naslouchání', 
   ARRAY['žák plynule a srozumitelně mluví', 'naslouchá pohádkám a příběhům', 'odpovídá na otázky'],
   ARRAY['komunikativní', 'sociální'], 40, 1, '2021'),
  ('cestina_1st', 1, 'Jazyková výchova', 'Písmena a hlásky', 
   ARRAY['žák rozlišuje hlásky', 'poznává písmena abecedy', 'skládá slabiky'],
   ARRAY['k učení', 'komunikativní'], 60, 2, '2021'),
  ('cestina_1st', 1, 'Jazyková výchova', 'Čtení - základy', 
   ARRAY['žák čte slabiky a jednoduchá slova', 'čte krátké věty', 'rozumí přečtenému'],
   ARRAY['k učení', 'komunikativní'], 80, 3, '2021'),
  ('cestina_1st', 1, 'Jazyková výchova', 'Psaní - základy', 
   ARRAY['žák píše písmena', 'opisuje slova', 'dodržuje hygienické návyky'],
   ARRAY['k učení', 'komunikativní'], 60, 4, '2021'),
  ('cestina_1st', 1, 'Literární výchova', 'Pohádky a básničky', 
   ARRAY['žák poslouchá pohádky', 'recituje krátké básničky', 'dramatizuje jednoduché příběhy'],
   ARRAY['komunikativní', 'sociální'], 40, 5, '2021')
ON CONFLICT DO NOTHING;

-- Čeština 2. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('cestina_1st', 2, 'Jazyková výchova', 'Plynulé čtení', 
   ARRAY['žák čte plynule s porozuměním', 'čte nahlas i potichu', 'vyhledává informace v textu'],
   ARRAY['k učení', 'komunikativní'], 60, 1, '2021'),
  ('cestina_1st', 2, 'Jazyková výchova', 'Psaní - věty a texty', 
   ARRAY['žák píše čitelně a úhledně', 'píše krátké věty', 'dodržuje mezery mezi slovy'],
   ARRAY['k učení', 'komunikativní'], 50, 2, '2021'),
  ('cestina_1st', 2, 'Jazyková výchova', 'Pravopis - základy', 
   ARRAY['žák rozlišuje samohlásky a souhlásky', 'píše i/y po tvrdých a měkkých souhláskách', 'používá velká písmena'],
   ARRAY['k učení', 'komunikativní'], 50, 3, '2021'),
  ('cestina_1st', 2, 'Komunikační a slohová výchova', 'Vyprávění a popis', 
   ARRAY['žák vypráví zážitek', 'popíše obrázek', 'seřadí události'],
   ARRAY['komunikativní', 'sociální'], 40, 4, '2021'),
  ('cestina_1st', 2, 'Literární výchova', 'Čtení s porozuměním', 
   ARRAY['žák čte dětské knihy', 'převypráví příběh', 'vyjádří pocity z četby'],
   ARRAY['k učení', 'komunikativní'], 40, 5, '2021')
ON CONFLICT DO NOTHING;

-- Čeština 3. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('cestina_1st', 3, 'Jazyková výchova', 'Stavba slova', 
   ARRAY['žák rozliší kořen a předponu', 'určí příbuzná slova', 'vyhledá slova v abecedním slovníku'],
   ARRAY['k učení', 'komunikativní'], 40, 1, '2021'),
  ('cestina_1st', 3, 'Jazyková výchova', 'Slovní druhy - úvod', 
   ARRAY['žák rozliší podstatná jména, slovesa, přídavná jména', 'určí rod a číslo', 'třídí slova'],
   ARRAY['k učení', 'komunikativní'], 50, 2, '2021'),
  ('cestina_1st', 3, 'Jazyková výchova', 'Pravopis - ú/ů, bě/bje', 
   ARRAY['žák správně píše ú/ů', 'píše skupiny bě, pě, vě, mě', 'kontroluje pravopis'],
   ARRAY['k učení', 'komunikativní'], 40, 3, '2021'),
  ('cestina_1st', 3, 'Komunikační a slohová výchova', 'Dopis a vzkaz', 
   ARRAY['žák napíše krátký dopis', 'vytvoří vzkaz', 'použije oslovení a pozdrav'],
   ARRAY['komunikativní', 'sociální'], 35, 4, '2021'),
  ('cestina_1st', 3, 'Literární výchova', 'Próza a poezie', 
   ARRAY['žák rozliší prózu a poezii', 'čte s výrazem', 'vyhledává rým'],
   ARRAY['k učení', 'komunikativní'], 35, 5, '2021')
ON CONFLICT DO NOTHING;

-- Čeština 4. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('cestina_1st', 4, 'Jazyková výchova', 'Podstatná jména - pády', 
   ARRAY['žák určuje pády', 'skloňuje podstatná jména', 'správně píše koncovky'],
   ARRAY['k učení', 'komunikativní'], 50, 1, '2021'),
  ('cestina_1st', 4, 'Jazyková výchova', 'Slovesa - osoba, číslo, čas', 
   ARRAY['žák určuje osobu, číslo a čas', 'časuje slovesa', 'tvoří věty'],
   ARRAY['k učení', 'komunikativní'], 45, 2, '2021'),
  ('cestina_1st', 4, 'Jazyková výchova', 'Pravopis - y/i po obojetných', 
   ARRAY['žák píše správně y/i po obojetných souhláskách', 'aplikuje vyjmenovaná slova', 'ověřuje pravopis'],
   ARRAY['k učení', 'komunikativní'], 45, 3, '2021'),
  ('cestina_1st', 4, 'Komunikační a slohová výchova', 'Vypravování a popis osoby', 
   ARRAY['žák napíše vypravování', 'popíše osobu', 'dodržuje osnovu'],
   ARRAY['komunikativní', 'sociální'], 35, 4, '2021'),
  ('cestina_1st', 4, 'Literární výchova', 'Dětská literatura', 
   ARRAY['žák čte dětské knihy', 'charakterizuje postavy', 'vyjádří názor na knihu'],
   ARRAY['k učení', 'komunikativní'], 35, 5, '2021')
ON CONFLICT DO NOTHING;

-- Čeština 5. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('cestina_1st', 5, 'Jazyková výchova', 'Vzory podstatných jmen', 
   ARRAY['žák určí vzor podstatného jména', 'správně píše koncovky', 'skloňuje podle vzorů'],
   ARRAY['k učení', 'komunikativní'], 45, 1, '2021'),
  ('cestina_1st', 5, 'Jazyková výchova', 'Věta a souvětí', 
   ARRAY['žák rozliší větu jednoduchou a souvětí', 'určí počet vět', 'používá správnou interpunkci'],
   ARRAY['k učení', 'komunikativní'], 40, 2, '2021'),
  ('cestina_1st', 5, 'Jazyková výchova', 'Shoda podmětu s přísudkem', 
   ARRAY['žák aplikuje pravidla shody', 'píše správně příčestí minulé', 'kontroluje koncovky'],
   ARRAY['k učení', 'komunikativní'], 40, 3, '2021'),
  ('cestina_1st', 5, 'Komunikační a slohová výchova', 'Referát a zpráva', 
   ARRAY['žák vytvoří krátký referát', 'napíše zprávu', 'vyhledává informace'],
   ARRAY['komunikativní', 'k učení'], 35, 4, '2021'),
  ('cestina_1st', 5, 'Literární výchova', 'Literární žánry', 
   ARRAY['žák rozliší literární žánry', 'čte s porozuměním', 'pracuje s knihou'],
   ARRAY['k učení', 'komunikativní'], 35, 5, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 1. STUPEŇ - MATEMATIKA
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'matematika_1st',
  'Matematika (1. st.)',
  'Matematika pro 1. stupeň ZŠ',
  'calculator',
  '#FF6347',
  4,
  '{1,2,3,4,5}'
) ON CONFLICT (code) DO NOTHING;

-- Matematika 1. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('matematika_1st', 1, 'Číslo a početní operace', 'Čísla 0-10', 
   ARRAY['žák čte a zapisuje čísla 0-10', 'porovnává čísla', 'sčítá a odčítá do 10'],
   ARRAY['k učení', 'k řešení problémů'], 50, 1, '2021'),
  ('matematika_1st', 1, 'Číslo a početní operace', 'Čísla 0-20', 
   ARRAY['žák čte a zapisuje čísla do 20', 'sčítá a odčítá do 20', 'řeší jednoduché úlohy'],
   ARRAY['k učení', 'k řešení problémů'], 50, 2, '2021'),
  ('matematika_1st', 1, 'Geometrie', 'Základní tvary', 
   ARRAY['žák rozpozná kruh, čtverec, trojúhelník, obdélník', 'třídí tvary', 'dokresluje tvary'],
   ARRAY['k učení', 'k řešení problémů'], 20, 3, '2021'),
  ('matematika_1st', 1, 'Nestandardní úlohy', 'Logické úlohy', 
   ARRAY['žák řeší jednoduché hlavolamy', 'hledá pravidelnosti', 'dokončuje řady'],
   ARRAY['k řešení problémů', 'k učení'], 20, 4, '2021')
ON CONFLICT DO NOTHING;

-- Matematika 2. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('matematika_1st', 2, 'Číslo a početní operace', 'Čísla do 100', 
   ARRAY['žák čte a zapisuje čísla do 100', 'sčítá a odčítá do 100', 'zaokrouhluje na desítky'],
   ARRAY['k učení', 'k řešení problémů'], 50, 1, '2021'),
  ('matematika_1st', 2, 'Číslo a početní operace', 'Násobení a dělení - úvod', 
   ARRAY['žák chápe násobení jako opakované sčítání', 'násobí a dělí 2, 3, 4, 5', 'řeší slovní úlohy'],
   ARRAY['k učení', 'k řešení problémů'], 40, 2, '2021'),
  ('matematika_1st', 2, 'Geometrie', 'Měření délky', 
   ARRAY['žák měří délku v cm a m', 'porovnává délky', 'odhaduje délky'],
   ARRAY['k učení', 'k řešení problémů'], 20, 3, '2021'),
  ('matematika_1st', 2, 'Nestandardní úlohy', 'Slovní úlohy', 
   ARRAY['žák řeší jednoduché slovní úlohy', 'zapisuje řešení', 'kontroluje výsledek'],
   ARRAY['k řešení problémů', 'k učení'], 30, 4, '2021')
ON CONFLICT DO NOTHING;

-- Matematika 3. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('matematika_1st', 3, 'Číslo a početní operace', 'Čísla do 1000', 
   ARRAY['žák čte a zapisuje čísla do 1000', 'sčítá a odčítá', 'zaokrouhluje na stovky'],
   ARRAY['k učení', 'k řešení problémů'], 40, 1, '2021'),
  ('matematika_1st', 3, 'Číslo a početní operace', 'Malá násobilka', 
   ARRAY['žák ovládá malou násobilku', 'násobí a dělí do 100', 'řeší slovní úlohy'],
   ARRAY['k učení', 'k řešení problémů'], 50, 2, '2021'),
  ('matematika_1st', 3, 'Geometrie', 'Obvod a jednotky', 
   ARRAY['žák měří obvod', 'převádí jednotky délky', 'rýsuje čtverce a obdélníky'],
   ARRAY['k učení', 'k řešení problémů'], 25, 3, '2021'),
  ('matematika_1st', 3, 'Závislosti', 'Čas a kalendář', 
   ARRAY['žák určuje čas', 'orientuje se v kalendáři', 'počítá s časem'],
   ARRAY['k učení', 'k řešení problémů'], 25, 4, '2021')
ON CONFLICT DO NOTHING;

-- Matematika 4. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('matematika_1st', 4, 'Číslo a početní operace', 'Čísla do 1 000 000', 
   ARRAY['žák čte a zapisuje velká čísla', 'porovnává a zaokrouhluje', 'sčítá a odčítá'],
   ARRAY['k učení', 'k řešení problémů'], 40, 1, '2021'),
  ('matematika_1st', 4, 'Číslo a početní operace', 'Písemné násobení a dělení', 
   ARRAY['žák písemně násobí', 'dělí jednociferným dělitelem', 'kontroluje výsledky'],
   ARRAY['k učení', 'k řešení problémů'], 45, 2, '2021'),
  ('matematika_1st', 4, 'Geometrie', 'Obvod a obsah', 
   ARRAY['žák počítá obvod čtverce a obdélníku', 'počítá obsah', 'rýsuje útvary'],
   ARRAY['k učení', 'k řešení problémů'], 30, 3, '2021'),
  ('matematika_1st', 4, 'Závislosti', 'Jednoduché tabulky a grafy', 
   ARRAY['žák čte data z tabulek', 'vytváří jednoduché grafy', 'interpretuje data'],
   ARRAY['k učení', 'k řešení problémů'], 25, 4, '2021')
ON CONFLICT DO NOTHING;

-- Matematika 5. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('matematika_1st', 5, 'Číslo a početní operace', 'Desetinná čísla', 
   ARRAY['žák chápe desetinná čísla', 'sčítá a odčítá desetinná čísla', 'porovnává'],
   ARRAY['k učení', 'k řešení problémů'], 40, 1, '2021'),
  ('matematika_1st', 5, 'Číslo a početní operace', 'Zlomky - úvod', 
   ARRAY['žák chápe zlomek jako část celku', 'porovnává jednoduché zlomky', 'znázorňuje zlomky'],
   ARRAY['k učení', 'k řešení problémů'], 35, 2, '2021'),
  ('matematika_1st', 5, 'Geometrie', 'Trojúhelník a úhly', 
   ARRAY['žák rýsuje trojúhelníky', 'měří úhly', 'rozlišuje druhy úhlů'],
   ARRAY['k učení', 'k řešení problémů'], 30, 3, '2021'),
  ('matematika_1st', 5, 'Geometrie', 'Tělesa', 
   ARRAY['žák rozpozná základní tělesa', 'popíše krychli a kvádr', 'počítá povrch krychle'],
   ARRAY['k učení', 'k řešení problémů'], 25, 4, '2021'),
  ('matematika_1st', 5, 'Nestandardní úlohy', 'Kombinatorika a logika', 
   ARRAY['žák řeší kombinatorické úlohy', 'hledá všechny možnosti', 'argumentuje'],
   ARRAY['k řešení problémů', 'k učení'], 20, 5, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 1. STUPEŇ - ANGLICKÝ JAZYK
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'anglictina_1st',
  'Anglický jazyk (1. st.)',
  'Anglický jazyk pro 1. stupeň ZŠ (od 3. třídy)',
  'languages',
  '#4169E1',
  3,
  '{3,4,5}'
) ON CONFLICT (code) DO NOTHING;

-- Angličtina 3. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('anglictina_1st', 3, 'Receptivní dovednosti', 'Poslech a první slova', 
   ARRAY['žák rozumí jednoduchým pokynům', 'reaguje na pozdravy', 'rozpozná známá slova'],
   ARRAY['k učení', 'komunikativní'], 30, 1, '2021'),
  ('anglictina_1st', 3, 'Produktivní dovednosti', 'Pozdravy a představení', 
   ARRAY['žák pozdraví anglicky', 'představí se', 'řekne své jméno a věk'],
   ARRAY['komunikativní', 'sociální'], 30, 2, '2021'),
  ('anglictina_1st', 3, 'Tematické okruhy', 'Barvy, čísla, zvířata', 
   ARRAY['žák pojmenuje barvy', 'počítá do 10', 'pojmenuje zvířata'],
   ARRAY['k učení', 'komunikativní'], 30, 3, '2021'),
  ('anglictina_1st', 3, 'Tematické okruhy', 'Rodina a škola', 
   ARRAY['žák pojmenuje členy rodiny', 'pojmenuje školní potřeby', 'reaguje na pokyny'],
   ARRAY['komunikativní', 'sociální'], 30, 4, '2021')
ON CONFLICT DO NOTHING;

-- Angličtina 4. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('anglictina_1st', 4, 'Jazykové prostředky', 'Sloveso to be a to have', 
   ARRAY['žák používá I am, you are', 'používá I have', 'tvoří jednoduché věty'],
   ARRAY['k učení', 'komunikativní'], 30, 1, '2021'),
  ('anglictina_1st', 4, 'Tematické okruhy', 'Jídlo a pití', 
   ARRAY['žák pojmenuje jídlo', 'vyjádří, co má/nemá rád', 'používá I like/I don''t like'],
   ARRAY['komunikativní', 'sociální'], 30, 2, '2021'),
  ('anglictina_1st', 4, 'Tematické okruhy', 'Dům a místnosti', 
   ARRAY['žák pojmenuje místnosti', 'popíše polohu věcí', 'používá předložky'],
   ARRAY['k učení', 'komunikativní'], 30, 3, '2021'),
  ('anglictina_1st', 4, 'Produktivní dovednosti', 'Čtení a psaní - základy', 
   ARRAY['žák čte krátké texty', 'opisuje slova a věty', 'doplňuje slova'],
   ARRAY['k učení', 'komunikativní'], 30, 4, '2021')
ON CONFLICT DO NOTHING;

-- Angličtina 5. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('anglictina_1st', 5, 'Jazykové prostředky', 'Přítomný čas prostý', 
   ARRAY['žák používá přítomný čas', 'tvoří otázky a zápory', 'popisuje denní rutinu'],
   ARRAY['k učení', 'komunikativní'], 35, 1, '2021'),
  ('anglictina_1st', 5, 'Tematické okruhy', 'Volný čas a koníčky', 
   ARRAY['žák mluví o koníčcích', 'používá can/can''t', 'popisuje, co umí'],
   ARRAY['komunikativní', 'sociální'], 30, 2, '2021'),
  ('anglictina_1st', 5, 'Tematické okruhy', 'Oblečení a počasí', 
   ARRAY['žák pojmenuje oblečení', 'popíše počasí', 'používá přítomný průběhový čas'],
   ARRAY['k učení', 'komunikativní'], 30, 3, '2021'),
  ('anglictina_1st', 5, 'Produktivní dovednosti', 'Psaní - krátké texty', 
   ARRAY['žák napíše krátký text o sobě', 'popíše obrázek', 'odpovídá na otázky písemně'],
   ARRAY['k učení', 'komunikativní'], 25, 4, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 1. STUPEŇ - PRVOUKA (1.-3. třída)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'prvouka',
  'Prvouka',
  'Prvouka pro 1.-3. třídu ZŠ',
  'compass',
  '#20B2AA',
  2,
  '{1,2,3}'
) ON CONFLICT (code) DO NOTHING;

-- Prvouka 1. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('prvouka', 1, 'Člověk a jeho svět', 'Já a moje rodina', 
   ARRAY['žák představí sebe a rodinu', 'popíše svůj domov', 'zná svou adresu'],
   ARRAY['sociální', 'občanské'], 15, 1, '2021'),
  ('prvouka', 1, 'Člověk a jeho svět', 'Škola a třída', 
   ARRAY['žák se orientuje ve škole', 'dodržuje pravidla třídy', 'spolupracuje se spolužáky'],
   ARRAY['sociální', 'komunikativní'], 15, 2, '2021'),
  ('prvouka', 1, 'Rozmanitost přírody', 'Roční období', 
   ARRAY['žák rozliší roční období', 'popíše změny v přírodě', 'pojmenuje měsíce'],
   ARRAY['k učení', 'občanské'], 15, 3, '2021'),
  ('prvouka', 1, 'Rozmanitost přírody', 'Zvířata a rostliny', 
   ARRAY['žák pojmenuje běžná zvířata', 'rozliší části rostliny', 'pečuje o živé tvory'],
   ARRAY['k učení', 'občanské'], 15, 4, '2021')
ON CONFLICT DO NOTHING;

-- Prvouka 2. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('prvouka', 2, 'Člověk a jeho svět', 'Moje obec a okolí', 
   ARRAY['žák popíše svou obec', 'orientuje se v okolí', 'zná důležitá místa'],
   ARRAY['občanské', 'sociální'], 15, 1, '2021'),
  ('prvouka', 2, 'Člověk a zdraví', 'Zdraví a bezpečnost', 
   ARRAY['žák dodržuje hygienické návyky', 'zná pravidla bezpečnosti', 'ví, jak zavolat pomoc'],
   ARRAY['občanské', 'sociální'], 15, 2, '2021'),
  ('prvouka', 2, 'Rozmanitost přírody', 'Živá a neživá příroda', 
   ARRAY['žák rozliší živou a neživou přírodu', 'třídí přírodniny', 'pozoruje přírodu'],
   ARRAY['k učení', 'občanské'], 15, 3, '2021'),
  ('prvouka', 2, 'Lidé kolem nás', 'Povolání a práce', 
   ARRAY['žák pojmenuje povolání', 'chápe význam práce', 'váží si práce druhých'],
   ARRAY['sociální', 'pracovní'], 15, 4, '2021')
ON CONFLICT DO NOTHING;

-- Prvouka 3. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('prvouka', 3, 'Člověk a jeho svět', 'Česká republika', 
   ARRAY['žák zná hlavní město', 'orientuje se na mapě ČR', 'zná státní symboly'],
   ARRAY['občanské', 'k učení'], 15, 1, '2021'),
  ('prvouka', 3, 'Člověk a čas', 'Minulost a současnost', 
   ARRAY['žák rozliší minulost a současnost', 'popíše změny v čase', 'pracuje s časovou osou'],
   ARRAY['k učení', 'občanské'], 15, 2, '2021'),
  ('prvouka', 3, 'Rozmanitost přírody', 'Ekosystémy', 
   ARRAY['žák charakterizuje les, louku, pole', 'popíše potravní řetězec', 'chrání přírodu'],
   ARRAY['k učení', 'občanské'], 15, 3, '2021'),
  ('prvouka', 3, 'Člověk a zdraví', 'Lidské tělo', 
   ARRAY['žák popíše části těla', 'zná základní orgány', 'pečuje o zdraví'],
   ARRAY['k učení', 'občanské'], 15, 4, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 1. STUPEŇ - PŘÍRODOVĚDA (4.-5. třída)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'prirodoveda',
  'Přírodověda',
  'Přírodověda pro 4.-5. třídu ZŠ',
  'leaf',
  '#32CD32',
  2,
  '{4,5}'
) ON CONFLICT (code) DO NOTHING;

-- Přírodověda 4. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('prirodoveda', 4, 'Rozmanitost přírody', 'Neživá příroda', 
   ARRAY['žák popíše vlastnosti hornin', 'charakterizuje půdu', 'vysvětlí koloběh vody'],
   ARRAY['k učení', 'k řešení problémů'], 15, 1, '2021'),
  ('prirodoveda', 4, 'Rozmanitost přírody', 'Rostliny', 
   ARRAY['žák popíše stavbu rostliny', 'rozliší druhy rostlin', 'pěstuje rostliny'],
   ARRAY['k učení', 'pracovní'], 15, 2, '2021'),
  ('prirodoveda', 4, 'Rozmanitost přírody', 'Živočichové', 
   ARRAY['žák třídí živočichy', 'popíše přizpůsobení prostředí', 'pozoruje živočichy'],
   ARRAY['k učení', 'občanské'], 15, 3, '2021'),
  ('prirodoveda', 4, 'Člověk a zdraví', 'Zdravý životní styl', 
   ARRAY['žák vysvětlí význam zdravé výživy', 'zná zásady zdravého života', 'pohybuje se pravidelně'],
   ARRAY['občanské', 'sociální'], 15, 4, '2021')
ON CONFLICT DO NOTHING;

-- Přírodověda 5. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('prirodoveda', 5, 'Rozmanitost přírody', 'Vesmír a Země', 
   ARRAY['žák popíše sluneční soustavu', 'vysvětlí střídání dne a noci', 'charakterizuje Zemi'],
   ARRAY['k učení', 'k řešení problémů'], 15, 1, '2021'),
  ('prirodoveda', 5, 'Rozmanitost přírody', 'Ekosystémy ČR', 
   ARRAY['žák charakterizuje ekosystémy ČR', 'popíše potravní vztahy', 'chrání životní prostředí'],
   ARRAY['k učení', 'občanské'], 15, 2, '2021'),
  ('prirodoveda', 5, 'Člověk a zdraví', 'Lidské tělo - soustavy', 
   ARRAY['žák popíše hlavní soustavy', 'vysvětlí jejich funkce', 'pečuje o zdraví'],
   ARRAY['k učení', 'občanské'], 15, 3, '2021'),
  ('prirodoveda', 5, 'Rozmanitost přírody', 'Energie a životní prostředí', 
   ARRAY['žák vysvětlí zdroje energie', 'zhodnotí vliv na přírodu', 'šetří energií'],
   ARRAY['k učení', 'občanské'], 15, 4, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 1. STUPEŇ - VLASTIVĚDA (4.-5. třída)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'vlastiveda',
  'Vlastivěda',
  'Vlastivěda pro 4.-5. třídu ZŠ',
  'map',
  '#DAA520',
  2,
  '{4,5}'
) ON CONFLICT (code) DO NOTHING;

-- Vlastivěda 4. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('vlastiveda', 4, 'Místo, kde žijeme', 'Náš kraj', 
   ARRAY['žák lokalizuje svůj kraj na mapě', 'popíše zajímavosti kraje', 'orientuje se v mapě'],
   ARRAY['k učení', 'občanské'], 15, 1, '2021'),
  ('vlastiveda', 4, 'Místo, kde žijeme', 'Česká republika - příroda', 
   ARRAY['žák popíše povrch ČR', 'charakterizuje vodstvo', 'pracuje s mapou'],
   ARRAY['k učení', 'občanské'], 15, 2, '2021'),
  ('vlastiveda', 4, 'Lidé kolem nás', 'Státní správa a obce', 
   ARRAY['žák vysvětlí funkci obce', 'zná základy státní správy', 'chápe práva a povinnosti'],
   ARRAY['občanské', 'sociální'], 15, 3, '2021'),
  ('vlastiveda', 4, 'Lidé a čas', 'Z historie českých zemí', 
   ARRAY['žák popíše důležité události', 'orientuje se na časové ose', 'zná významné osobnosti'],
   ARRAY['k učení', 'občanské'], 15, 4, '2021')
ON CONFLICT DO NOTHING;

-- Vlastivěda 5. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('vlastiveda', 5, 'Místo, kde žijeme', 'Evropa', 
   ARRAY['žák lokalizuje evropské státy', 'charakterizuje sousední země', 'pracuje s mapou Evropy'],
   ARRAY['k učení', 'občanské'], 15, 1, '2021'),
  ('vlastiveda', 5, 'Místo, kde žijeme', 'Česká republika - hospodářství', 
   ARRAY['žák popíše průmysl a zemědělství', 'charakterizuje dopravu', 'vysvětlí význam služeb'],
   ARRAY['k učení', 'pracovní'], 15, 2, '2021'),
  ('vlastiveda', 5, 'Lidé a čas', 'České dějiny 20. století', 
   ARRAY['žák popíše vznik ČSR', 'charakterizuje období 2. sv. války', 'vysvětlí události roku 1989'],
   ARRAY['k učení', 'občanské'], 15, 3, '2021'),
  ('vlastiveda', 5, 'Lidé kolem nás', 'Evropská unie', 
   ARRAY['žák vysvětlí význam EU', 'zná základní instituce', 'chápe výhody členství'],
   ARRAY['občanské', 'komunikativní'], 15, 4, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- VÝCHOVY (všechny ročníky 1-9)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES 
  ('hudebni_vychova', 'Hudební výchova', 'Hudební výchova pro ZŠ', 'music', '#FF69B4', 1, '{1,2,3,4,5,6,7,8,9}'),
  ('vytvarna_vychova', 'Výtvarná výchova', 'Výtvarná výchova pro ZŠ', 'palette', '#9370DB', 2, '{1,2,3,4,5,6,7,8,9}'),
  ('telesna_vychova', 'Tělesná výchova', 'Tělesná výchova pro ZŠ', 'activity', '#00CED1', 2, '{1,2,3,4,5,6,7,8,9}'),
  ('pracovni_cinnosti', 'Pracovní činnosti', 'Pracovní činnosti / Člověk a svět práce', 'wrench', '#A0522D', 1, '{1,2,3,4,5,6,7,8,9}')
ON CONFLICT (code) DO NOTHING;

-- Hudební výchova - reprezentativní témata
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('hudebni_vychova', 1, 'Vokální činnosti', 'Zpěv a rytmus', 
   ARRAY['žák zpívá jednoduché písně', 'vytleskává rytmus', 'reaguje na hudbu pohybem'],
   ARRAY['k učení', 'sociální'], 30, 1, '2021'),
  ('hudebni_vychova', 3, 'Vokální činnosti', 'Lidové písně', 
   ARRAY['žák zpívá lidové písně', 'rozliší dur a moll', 'hraje na jednoduché nástroje'],
   ARRAY['k učení', 'občanské'], 30, 1, '2021'),
  ('hudebni_vychova', 5, 'Poslechové činnosti', 'Hudební nástroje', 
   ARRAY['žák rozpozná hudební nástroje', 'poslouchá vážnou hudbu', 'vyjádří pocity z hudby'],
   ARRAY['k učení', 'komunikativní'], 30, 1, '2021'),
  ('hudebni_vychova', 7, 'Poslechové činnosti', 'Hudební styly', 
   ARRAY['žák rozliší hudební styly', 'charakterizuje období hudby', 'diskutuje o hudbě'],
   ARRAY['k učení', 'komunikativní'], 30, 1, '2021'),
  ('hudebni_vychova', 9, 'Poslechové činnosti', 'Současná hudba', 
   ARRAY['žák analyzuje současnou hudbu', 'kriticky hodnotí', 'vytváří vlastní hudební projekty'],
   ARRAY['k učení', 'komunikativní'], 30, 1, '2021')
ON CONFLICT DO NOTHING;

-- Výtvarná výchova - reprezentativní témata
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('vytvarna_vychova', 1, 'Rozvíjení smyslové citlivosti', 'Barvy a tvary', 
   ARRAY['žák míchá barvy', 'rozlišuje tvary', 'vytváří jednoduché obrázky'],
   ARRAY['k učení', 'pracovní'], 60, 1, '2021'),
  ('vytvarna_vychova', 3, 'Uplatňování subjektivity', 'Ilustrace a kresba', 
   ARRAY['žák ilustruje příběh', 'kreslí podle fantazie', 'používá různé techniky'],
   ARRAY['k učení', 'komunikativní'], 60, 1, '2021'),
  ('vytvarna_vychova', 5, 'Ověřování komunikačních účinků', 'Prostorová tvorba', 
   ARRAY['žák tvoří prostorové objekty', 'pracuje s různými materiály', 'hodnotí výtvarná díla'],
   ARRAY['k učení', 'pracovní'], 60, 1, '2021'),
  ('vytvarna_vychova', 7, 'Uplatňování subjektivity', 'Grafika a design', 
   ARRAY['žák vytváří grafické návrhy', 'pracuje s počítačovou grafikou', 'analyzuje vizuální komunikaci'],
   ARRAY['k učení', 'pracovní'], 60, 1, '2021'),
  ('vytvarna_vychova', 9, 'Ověřování komunikačních účinků', 'Současné umění', 
   ARRAY['žák interpretuje současné umění', 'vytváří vlastní projekty', 'prezentuje svou tvorbu'],
   ARRAY['k učení', 'komunikativní'], 60, 1, '2021')
ON CONFLICT DO NOTHING;

-- Tělesná výchova - reprezentativní témata
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('telesna_vychova', 1, 'Činnosti ovlivňující zdraví', 'Základní pohybové dovednosti', 
   ARRAY['žák zvládá běh, skok, hod', 'dodržuje pravidla her', 'rozvíjí koordinaci'],
   ARRAY['k učení', 'sociální'], 60, 1, '2021'),
  ('telesna_vychova', 3, 'Činnosti ovlivňující úroveň pohybových dovedností', 'Gymnastika a atletika', 
   ARRAY['žák provádí gymnastické prvky', 'zlepšuje atletické výkony', 'spolupracuje v týmu'],
   ARRAY['k učení', 'sociální'], 60, 1, '2021'),
  ('telesna_vychova', 5, 'Činnosti podporující pohybové učení', 'Sportovní hry', 
   ARRAY['žák hraje míčové hry', 'dodržuje pravidla', 'rozvíjí fair play'],
   ARRAY['k učení', 'sociální'], 60, 1, '2021'),
  ('telesna_vychova', 7, 'Činnosti ovlivňující zdraví', 'Kondiční cvičení', 
   ARRAY['žák rozvíjí kondici', 'zná zásady bezpečnosti', 'plánuje pohybové aktivity'],
   ARRAY['k učení', 'sociální'], 60, 1, '2021'),
  ('telesna_vychova', 9, 'Činnosti ovlivňující úroveň pohybových dovedností', 'Sport a zdraví', 
   ARRAY['žák chápe význam pohybu', 'vybírá vhodné aktivity', 'organizuje sportovní akce'],
   ARRAY['k učení', 'sociální'], 60, 1, '2021')
ON CONFLICT DO NOTHING;
