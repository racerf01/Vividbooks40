-- =====================================================
-- CURRICULUM FACTORY - Další předměty a ročníky
-- =====================================================

-- =====================================================
-- ZEMĚPIS (Geography)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'zemepis',
  'Zeměpis',
  'Geografie pro 2. stupeň ZŠ',
  'globe',
  '#2E8B57',
  2,
  '{6,7,8,9}'
) ON CONFLICT (code) DO NOTHING;

-- Zeměpis 6. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('zemepis', 6, 'Přírodní obraz Země', 'Planeta Země ve vesmíru', 
   ARRAY['žák zhodnotí postavení Země ve vesmíru', 'popíše tvar a pohyby Země', 'vysvětlí střídání dne a noci, ročních období'],
   ARRAY['k učení', 'k řešení problémů'], 8, 1, '2021'),
  ('zemepis', 6, 'Přírodní obraz Země', 'Glóbus a mapa', 
   ARRAY['žák používá s porozuměním základní geografickou terminologii', 'orientuje se na mapě pomocí zeměpisné sítě', 'pracuje s různými druhy map'],
   ARRAY['k učení', 'komunikativní'], 10, 2, '2021'),
  ('zemepis', 6, 'Přírodní obraz Země', 'Litosféra a reliéf Země', 
   ARRAY['žák porovná rozdílné krajiny na Zemi', 'rozliší základní typy reliéfu', 'vysvětlí vznik pohoří, sopek a zemětřesení'],
   ARRAY['k učení', 'k řešení problémů'], 12, 3, '2021'),
  ('zemepis', 6, 'Přírodní obraz Země', 'Atmosféra a hydrosféra', 
   ARRAY['žák popíše složení a stavbu atmosféry', 'vysvětlí koloběh vody', 'rozliší typy vodních útvarů'],
   ARRAY['k učení', 'občanské'], 12, 4, '2021'),
  ('zemepis', 6, 'Přírodní obraz Země', 'Biosféra a přírodní krajiny', 
   ARRAY['žák rozliší přírodní krajinné zóny', 'charakterizuje typickou faunu a flóru', 'posoudí vliv člověka na krajinu'],
   ARRAY['k učení', 'občanské'], 10, 5, '2021')
ON CONFLICT DO NOTHING;

-- Zeměpis 7. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('zemepis', 7, 'Regiony světa', 'Afrika', 
   ARRAY['žák lokalizuje na mapě hlavní státy a města Afriky', 'charakterizuje přírodní podmínky', 'zhodnotí problémy rozvojových zemí'],
   ARRAY['k učení', 'občanské', 'komunikativní'], 14, 1, '2021'),
  ('zemepis', 7, 'Regiony světa', 'Austrálie a Oceánie', 
   ARRAY['žák lokalizuje Austrálii a Oceánii', 'popíše specifickou faunu a flóru', 'charakterizuje osídlení'],
   ARRAY['k učení', 'komunikativní'], 8, 2, '2021'),
  ('zemepis', 7, 'Regiony světa', 'Asie', 
   ARRAY['žák lokalizuje hlavní státy Asie', 'rozliší různorodost přírodních podmínek', 'zhodnotí ekonomický rozvoj'],
   ARRAY['k učení', 'občanské', 'k řešení problémů'], 16, 3, '2021'),
  ('zemepis', 7, 'Regiony světa', 'Amerika', 
   ARRAY['žák porovná Severní a Jižní Ameriku', 'charakterizuje přírodní podmínky', 'popíše hospodářství USA'],
   ARRAY['k učení', 'komunikativní'], 14, 4, '2021')
ON CONFLICT DO NOTHING;

-- Zeměpis 8. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('zemepis', 8, 'Evropa', 'Evropa - přírodní podmínky', 
   ARRAY['žák vymezí polohu Evropy', 'charakterizuje přírodní podmínky', 'rozliší přírodní krajiny Evropy'],
   ARRAY['k učení', 'komunikativní'], 10, 1, '2021'),
  ('zemepis', 8, 'Evropa', 'Státy jižní Evropy', 
   ARRAY['žák lokalizuje státy jižní Evropy', 'charakterizuje hospodářství', 'zhodnotí význam turismu'],
   ARRAY['k učení', 'občanské'], 10, 2, '2021'),
  ('zemepis', 8, 'Evropa', 'Státy západní Evropy', 
   ARRAY['žák lokalizuje státy západní Evropy', 'popíše vyspělost ekonomiky', 'charakterizuje Evropskou unii'],
   ARRAY['k učení', 'občanské', 'komunikativní'], 12, 3, '2021'),
  ('zemepis', 8, 'Evropa', 'Státy střední Evropy', 
   ARRAY['žák lokalizuje státy střední Evropy', 'porovná sousední státy ČR', 'zhodnotí historický vývoj regionu'],
   ARRAY['k učení', 'občanské'], 10, 4, '2021'),
  ('zemepis', 8, 'Evropa', 'Státy severní a východní Evropy', 
   ARRAY['žák lokalizuje státy severní a východní Evropy', 'charakterizuje přírodní podmínky', 'popíše hospodářství Ruska'],
   ARRAY['k učení', 'komunikativní'], 10, 5, '2021')
ON CONFLICT DO NOTHING;

-- Zeměpis 9. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('zemepis', 9, 'Česká republika', 'ČR - poloha a přírodní podmínky', 
   ARRAY['žák vymezí polohu ČR', 'charakterizuje přírodní podmínky', 'popíše geomorfologické členění'],
   ARRAY['k učení', 'občanské'], 12, 1, '2021'),
  ('zemepis', 9, 'Česká republika', 'Obyvatelstvo a sídla ČR', 
   ARRAY['žák zhodnotí demografický vývoj', 'rozliší typy sídel', 'charakterizuje sídelní strukturu'],
   ARRAY['k učení', 'občanské', 'sociální'], 10, 2, '2021'),
  ('zemepis', 9, 'Česká republika', 'Hospodářství ČR', 
   ARRAY['žák charakterizuje hospodářství ČR', 'popíše strukturu průmyslu', 'zhodnotí zemědělství a služby'],
   ARRAY['k učení', 'k řešení problémů'], 12, 3, '2021'),
  ('zemepis', 9, 'Česká republika', 'Regiony ČR', 
   ARRAY['žák lokalizuje kraje ČR', 'charakterizuje vybrané regiony', 'zhodnotí regionální rozdíly'],
   ARRAY['k učení', 'občanské', 'komunikativní'], 14, 4, '2021'),
  ('zemepis', 9, 'Globální problémy', 'Globalizace a udržitelný rozvoj', 
   ARRAY['žák posoudí globální problémy lidstva', 'zhodnotí vliv člověka na životní prostředí', 'navrhne řešení lokálních problémů'],
   ARRAY['občanské', 'k řešení problémů', 'sociální'], 8, 5, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- ČESKÝ JAZYK (Czech Language)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'cestina',
  'Český jazyk',
  'Český jazyk a literatura pro 2. stupeň ZŠ',
  'book-open',
  '#DC143C',
  4,
  '{6,7,8,9}'
) ON CONFLICT (code) DO NOTHING;

-- Čeština 6. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('cestina', 6, 'Jazyková výchova', 'Slovní zásoba a tvoření slov', 
   ARRAY['žák rozlišuje slovní druhy', 'tvoří slova odvozováním a skládáním', 'používá synonyma a antonyma'],
   ARRAY['k učení', 'komunikativní'], 20, 1, '2021'),
  ('cestina', 6, 'Jazyková výchova', 'Tvarosloví - podstatná jména', 
   ARRAY['žák určuje mluvnické kategorie', 'skloňuje podstatná jména', 'správně používá koncovky'],
   ARRAY['k učení', 'komunikativní'], 24, 2, '2021'),
  ('cestina', 6, 'Jazyková výchova', 'Tvarosloví - přídavná jména a zájmena', 
   ARRAY['žák skloňuje přídavná jména', 'rozlišuje druhy zájmen', 'správně píše zájmena'],
   ARRAY['k učení', 'komunikativní'], 20, 3, '2021'),
  ('cestina', 6, 'Komunikační a slohová výchova', 'Vypravování a popis', 
   ARRAY['žák vytvoří vypravování', 'popíše předmět, osobu, děj', 'dodržuje kompozici textu'],
   ARRAY['komunikativní', 'sociální'], 24, 4, '2021'),
  ('cestina', 6, 'Literární výchova', 'Pohádky, pověsti a báje', 
   ARRAY['žák rozlišuje literární žánry', 'interpretuje pohádky a pověsti', 'vyjádří vlastní názor na text'],
   ARRAY['k učení', 'komunikativní', 'občanské'], 24, 5, '2021')
ON CONFLICT DO NOTHING;

-- Čeština 7. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('cestina', 7, 'Jazyková výchova', 'Tvarosloví - slovesa', 
   ARRAY['žák určuje slovesné kategorie', 'časuje slovesa', 'rozlišuje slovesné třídy a vzory'],
   ARRAY['k učení', 'komunikativní'], 24, 1, '2021'),
  ('cestina', 7, 'Jazyková výchova', 'Skladba - věta jednoduchá', 
   ARRAY['žák určuje větné členy', 'rozlišuje druhy vět', 'analyzuje jednoduchou větu'],
   ARRAY['k učení', 'komunikativní'], 28, 2, '2021'),
  ('cestina', 7, 'Komunikační a slohová výchova', 'Charakteristika a líčení', 
   ARRAY['žák vytvoří charakteristiku osoby', 'napíše líčení', 'používá vhodné jazykové prostředky'],
   ARRAY['komunikativní', 'sociální'], 20, 3, '2021'),
  ('cestina', 7, 'Literární výchova', 'Dobrodružná literatura', 
   ARRAY['žák analyzuje dobrodružný text', 'charakterizuje postavy', 'porovná literární a filmové zpracování'],
   ARRAY['k učení', 'komunikativní'], 24, 4, '2021'),
  ('cestina', 7, 'Literární výchova', 'Poezie', 
   ARRAY['žák rozpozná básnické prostředky', 'interpretuje báseň', 'recituje vybrané básně'],
   ARRAY['k učení', 'komunikativní', 'občanské'], 16, 5, '2021')
ON CONFLICT DO NOTHING;

-- Čeština 8. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('cestina', 8, 'Jazyková výchova', 'Skladba - souvětí', 
   ARRAY['žák rozlišuje druhy vedlejších vět', 'analyzuje souvětí', 'správně používá interpunkci'],
   ARRAY['k učení', 'komunikativní'], 28, 1, '2021'),
  ('cestina', 8, 'Jazyková výchova', 'Pravopis', 
   ARRAY['žák aplikuje pravopisná pravidla', 'píše správně velká písmena', 'ovládá psaní číslovek'],
   ARRAY['k učení', 'komunikativní'], 20, 2, '2021'),
  ('cestina', 8, 'Komunikační a slohová výchova', 'Úvaha a výklad', 
   ARRAY['žák napíše úvahu', 'vytvoří výklad', 'argumentuje a obhajuje názor'],
   ARRAY['komunikativní', 'k řešení problémů'], 24, 3, '2021'),
  ('cestina', 8, 'Literární výchova', 'Literatura 19. století', 
   ARRAY['žák charakterizuje romantismus a realismus', 'interpretuje díla K. H. Máchy, B. Němcové', 'zasadí dílo do kontextu'],
   ARRAY['k učení', 'komunikativní', 'občanské'], 28, 4, '2021'),
  ('cestina', 8, 'Literární výchova', 'Drama', 
   ARRAY['žák rozlišuje dramatické žánry', 'analyzuje divadelní hru', 'vyjádří se k inscenaci'],
   ARRAY['k učení', 'komunikativní', 'sociální'], 12, 5, '2021')
ON CONFLICT DO NOTHING;

-- Čeština 9. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('cestina', 9, 'Jazyková výchova', 'Obecné výklady o jazyce', 
   ARRAY['žák rozlišuje jazykové roviny', 'charakterizuje vývoj češtiny', 'porovná slovanské jazyky'],
   ARRAY['k učení', 'komunikativní'], 16, 1, '2021'),
  ('cestina', 9, 'Jazyková výchova', 'Stylistika', 
   ARRAY['žák rozlišuje funkční styly', 'charakterizuje publicistický styl', 'analyzuje mediální texty'],
   ARRAY['k učení', 'komunikativní', 'občanské'], 20, 2, '2021'),
  ('cestina', 9, 'Komunikační a slohová výchova', 'Administrativní styl', 
   ARRAY['žák napíše životopis', 'vytvoří motivační dopis', 'ovládá úřední korespondenci'],
   ARRAY['komunikativní', 'pracovní'], 20, 3, '2021'),
  ('cestina', 9, 'Literární výchova', 'Literatura 20. století', 
   ARRAY['žák charakterizuje literární směry 20. století', 'interpretuje vybraná díla', 'zhodnotí přínos autorů'],
   ARRAY['k učení', 'komunikativní', 'občanské'], 32, 4, '2021'),
  ('cestina', 9, 'Literární výchova', 'Současná literatura a média', 
   ARRAY['žák se orientuje v současné literatuře', 'kriticky hodnotí mediální obsahy', 'rozlišuje fakta a názory'],
   ARRAY['k učení', 'komunikativní', 'občanské'], 24, 5, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- ANGLICKÝ JAZYK (English)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'anglictina',
  'Anglický jazyk',
  'Anglický jazyk pro 2. stupeň ZŠ (úroveň A1-A2)',
  'languages',
  '#4169E1',
  3,
  '{6,7,8,9}'
) ON CONFLICT (code) DO NOTHING;

-- Angličtina 6. třída (A1)
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('anglictina', 6, 'Receptivní řečové dovednosti', 'Poslech a čtení - základy', 
   ARRAY['žák rozumí jednoduchým pokynům', 'čte nahlas plynule a foneticky správně', 'rozumí krátkému textu'],
   ARRAY['k učení', 'komunikativní'], 24, 1, '2021'),
  ('anglictina', 6, 'Produktivní řečové dovednosti', 'Představení se a základní konverzace', 
   ARRAY['žák se představí', 'popíše sebe a rodinu', 'vede jednoduchý rozhovor'],
   ARRAY['komunikativní', 'sociální'], 24, 2, '2021'),
  ('anglictina', 6, 'Jazykové prostředky', 'Přítomný čas prostý a průběhový', 
   ARRAY['žák používá přítomný čas prostý', 'rozlišuje prostý a průběhový čas', 'tvoří otázky a zápory'],
   ARRAY['k učení', 'komunikativní'], 28, 3, '2021'),
  ('anglictina', 6, 'Tematické okruhy', 'Škola, volný čas, rodina', 
   ARRAY['žák popíše školu a rozvrh', 'mluví o volném čase', 'představí rodinu'],
   ARRAY['komunikativní', 'sociální'], 24, 4, '2021')
ON CONFLICT DO NOTHING;

-- Angličtina 7. třída (A1+)
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('anglictina', 7, 'Jazykové prostředky', 'Minulý čas prostý', 
   ARRAY['žák používá minulý čas prostý', 'vypráví o minulosti', 'rozlišuje pravidelná a nepravidelná slovesa'],
   ARRAY['k učení', 'komunikativní'], 28, 1, '2021'),
  ('anglictina', 7, 'Jazykové prostředky', 'Budoucí čas a modální slovesa', 
   ARRAY['žák vyjádří budoucnost', 'používá going to a will', 'používá can, must, should'],
   ARRAY['k učení', 'komunikativní'], 24, 2, '2021'),
  ('anglictina', 7, 'Tematické okruhy', 'Cestování a doprava', 
   ARRAY['žák popíše cestu', 'zeptá se na směr', 'mluví o dopravních prostředcích'],
   ARRAY['komunikativní', 'sociální'], 24, 3, '2021'),
  ('anglictina', 7, 'Produktivní řečové dovednosti', 'Psaní - neformální dopis, e-mail', 
   ARRAY['žák napíše neformální dopis', 'vytvoří e-mail', 'odpovídá na zprávy'],
   ARRAY['komunikativní', 'k učení'], 24, 4, '2021')
ON CONFLICT DO NOTHING;

-- Angličtina 8. třída (A2)
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('anglictina', 8, 'Jazykové prostředky', 'Předpřítomný čas', 
   ARRAY['žák používá předpřítomný čas', 'rozlišuje předpřítomný a minulý čas', 'používá since a for'],
   ARRAY['k učení', 'komunikativní'], 28, 1, '2021'),
  ('anglictina', 8, 'Jazykové prostředky', 'Trpný rod a podmínkové věty', 
   ARRAY['žák tvoří trpný rod', 'používá první a druhou podmínku', 'porovnává struktury'],
   ARRAY['k učení', 'komunikativní'], 24, 2, '2021'),
  ('anglictina', 8, 'Tematické okruhy', 'Zdraví, jídlo, nakupování', 
   ARRAY['žák mluví o zdraví', 'objedná si v restauraci', 'nakupuje v obchodě'],
   ARRAY['komunikativní', 'sociální'], 24, 3, '2021'),
  ('anglictina', 8, 'Receptivní řečové dovednosti', 'Poslech a čtení - delší texty', 
   ARRAY['žák rozumí delšímu textu', 'vyhledá specifické informace', 'shrne obsah textu'],
   ARRAY['k učení', 'komunikativní'], 24, 4, '2021')
ON CONFLICT DO NOTHING;

-- Angličtina 9. třída (A2+)
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('anglictina', 9, 'Jazykové prostředky', 'Komplexní gramatika', 
   ARRAY['žák používá složitější gramatické struktury', 'tvoří nepřímou řeč', 'používá vztažné věty'],
   ARRAY['k učení', 'komunikativní'], 28, 1, '2021'),
  ('anglictina', 9, 'Tematické okruhy', 'Práce, budoucnost, globální problémy', 
   ARRAY['žák mluví o povoláních', 'diskutuje o budoucnosti', 'vyjádří názor na globální problémy'],
   ARRAY['komunikativní', 'občanské'], 24, 2, '2021'),
  ('anglictina', 9, 'Produktivní řečové dovednosti', 'Psaní - formální texty', 
   ARRAY['žák napíše formální dopis', 'vytvoří strukturovaný text', 'argumentuje písemně'],
   ARRAY['komunikativní', 'k učení'], 24, 3, '2021'),
  ('anglictina', 9, 'Interkulturní kompetence', 'Anglicky mluvící země', 
   ARRAY['žák porovná kultury', 'charakterizuje anglicky mluvící země', 'respektuje kulturní odlišnosti'],
   ARRAY['komunikativní', 'občanské', 'sociální'], 24, 4, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- MATEMATIKA (Mathematics)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'matematika',
  'Matematika',
  'Matematika pro 2. stupeň ZŠ',
  'calculator',
  '#FF6347',
  4,
  '{6,7,8,9}'
) ON CONFLICT (code) DO NOTHING;

-- Matematika 6. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('matematika', 6, 'Číslo a početní operace', 'Přirozená čísla a desetinná čísla', 
   ARRAY['žák provádí početní operace s přirozenými čísly', 'zaokrouhluje desetinná čísla', 'odhaduje výsledky'],
   ARRAY['k učení', 'k řešení problémů'], 28, 1, '2021'),
  ('matematika', 6, 'Číslo a početní operace', 'Dělitelnost přirozených čísel', 
   ARRAY['žák určuje násobky a dělitele', 'rozpozná prvočísla', 'rozloží číslo na prvočinitele'],
   ARRAY['k učení', 'k řešení problémů'], 20, 2, '2021'),
  ('matematika', 6, 'Číslo a početní operace', 'Zlomky - úvod', 
   ARRAY['žák znázorní zlomek', 'porovnává zlomky', 'převádí zlomky na desetinná čísla'],
   ARRAY['k učení', 'k řešení problémů'], 24, 3, '2021'),
  ('matematika', 6, 'Geometrie v rovině', 'Úhel a jeho vlastnosti', 
   ARRAY['žák měří a rýsuje úhly', 'rozlišuje druhy úhlů', 'počítá s úhly'],
   ARRAY['k učení', 'k řešení problémů'], 20, 4, '2021'),
  ('matematika', 6, 'Geometrie v rovině', 'Trojúhelník', 
   ARRAY['žák konstruuje trojúhelník', 'určuje vlastnosti trojúhelníků', 'počítá obvod a obsah'],
   ARRAY['k učení', 'k řešení problémů'], 20, 5, '2021')
ON CONFLICT DO NOTHING;

-- Matematika 7. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('matematika', 7, 'Číslo a početní operace', 'Celá čísla', 
   ARRAY['žák provádí operace s celými čísly', 'porovnává celá čísla', 'řeší úlohy s celými čísly'],
   ARRAY['k učení', 'k řešení problémů'], 24, 1, '2021'),
  ('matematika', 7, 'Číslo a početní operace', 'Racionální čísla', 
   ARRAY['žák počítá se zlomky', 'převádí zlomky na desetinná čísla', 'řeší slovní úlohy'],
   ARRAY['k učení', 'k řešení problémů'], 28, 2, '2021'),
  ('matematika', 7, 'Číslo a početní operace', 'Poměr, přímá a nepřímá úměrnost', 
   ARRAY['žák řeší úlohy s poměrem', 'rozliší přímou a nepřímou úměrnost', 'aplikuje trojčlenku'],
   ARRAY['k učení', 'k řešení problémů'], 24, 3, '2021'),
  ('matematika', 7, 'Geometrie v rovině', 'Čtyřúhelníky', 
   ARRAY['žák konstruuje čtyřúhelníky', 'počítá obvody a obsahy', 'rozlišuje vlastnosti čtyřúhelníků'],
   ARRAY['k učení', 'k řešení problémů'], 24, 4, '2021'),
  ('matematika', 7, 'Geometrie v rovině', 'Kruh a kružnice', 
   ARRAY['žák rýsuje kružnici', 'počítá obvod a obsah kruhu', 'řeší úlohy s kruhovým obloukem'],
   ARRAY['k učení', 'k řešení problémů'], 12, 5, '2021')
ON CONFLICT DO NOTHING;

-- Matematika 8. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('matematika', 8, 'Číslo a početní operace', 'Procenta', 
   ARRAY['žák počítá procenta', 'řeší úlohy na procentový počet', 'používá procenta v praxi'],
   ARRAY['k učení', 'k řešení problémů', 'pracovní'], 24, 1, '2021'),
  ('matematika', 8, 'Číslo a početní operace', 'Mocniny a odmocniny', 
   ARRAY['žák počítá s mocninami', 'určuje druhou odmocninu', 'používá kalkulátor'],
   ARRAY['k učení', 'k řešení problémů'], 20, 2, '2021'),
  ('matematika', 8, 'Závislosti a vztahy', 'Lineární rovnice', 
   ARRAY['žák řeší lineární rovnice', 'upravuje výrazy', 'řeší slovní úlohy pomocí rovnic'],
   ARRAY['k učení', 'k řešení problémů'], 28, 3, '2021'),
  ('matematika', 8, 'Geometrie v prostoru', 'Tělesa - hranol a válec', 
   ARRAY['žák počítá povrch a objem hranolu', 'počítá povrch a objem válce', 'řeší praktické úlohy'],
   ARRAY['k učení', 'k řešení problémů'], 24, 4, '2021'),
  ('matematika', 8, 'Geometrie v rovině', 'Pythagorova věta', 
   ARRAY['žák aplikuje Pythagorovu větu', 'řeší úlohy v rovině a prostoru', 'využívá větu v praxi'],
   ARRAY['k učení', 'k řešení problémů'], 16, 5, '2021')
ON CONFLICT DO NOTHING;

-- Matematika 9. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('matematika', 9, 'Závislosti a vztahy', 'Soustavy rovnic', 
   ARRAY['žák řeší soustavy dvou rovnic', 'používá sčítací a dosazovací metodu', 'řeší slovní úlohy'],
   ARRAY['k učení', 'k řešení problémů'], 24, 1, '2021'),
  ('matematika', 9, 'Závislosti a vztahy', 'Funkce', 
   ARRAY['žák rozumí pojmu funkce', 'kreslí grafy lineárních funkcí', 'interpretuje grafy'],
   ARRAY['k učení', 'k řešení problémů'], 28, 2, '2021'),
  ('matematika', 9, 'Geometrie v prostoru', 'Tělesa - jehlan, kužel, koule', 
   ARRAY['žák počítá povrch a objem jehlanu', 'počítá povrch a objem kužele', 'počítá povrch a objem koule'],
   ARRAY['k učení', 'k řešení problémů'], 24, 3, '2021'),
  ('matematika', 9, 'Geometrie v rovině', 'Podobnost a shodnost', 
   ARRAY['žák rozpozná shodné a podobné útvary', 'aplikuje věty o podobnosti', 'řeší praktické úlohy'],
   ARRAY['k učení', 'k řešení problémů'], 20, 4, '2021'),
  ('matematika', 9, 'Nestandardní aplikační úlohy', 'Finanční matematika', 
   ARRAY['žák počítá úroky', 'rozumí pojmu jistina a úroková míra', 'řeší úlohy z praxe'],
   ARRAY['k učení', 'k řešení problémů', 'pracovní'], 16, 5, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- PŘÍRODOPIS (Biology/Natural Sciences)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'prirodopis',
  'Přírodopis',
  'Přírodopis pro 2. stupeň ZŠ',
  'leaf',
  '#228B22',
  2,
  '{6,7,8,9}'
) ON CONFLICT (code) DO NOTHING;

-- Přírodopis 6. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('prirodopis', 6, 'Obecná biologie', 'Buňka a organismy', 
   ARRAY['žák popíše stavbu buňky', 'rozliší prokaryotní a eukaryotní buňku', 'vysvětlí základní životní funkce'],
   ARRAY['k učení', 'k řešení problémů'], 12, 1, '2021'),
  ('prirodopis', 6, 'Biologie rostlin', 'Nižší rostliny', 
   ARRAY['žák charakterizuje řasy, houby a lišejníky', 'popíše jejich význam', 'rozpozná vybrané druhy'],
   ARRAY['k učení', 'občanské'], 16, 2, '2021'),
  ('prirodopis', 6, 'Biologie rostlin', 'Vyšší rostliny - mechorosty a kapraďorosty', 
   ARRAY['žák popíše stavbu mechorostů', 'charakterizuje kapraďorosty', 'vysvětlí rozmnožování'],
   ARRAY['k učení', 'k řešení problémů'], 14, 3, '2021'),
  ('prirodopis', 6, 'Biologie rostlin', 'Semenné rostliny', 
   ARRAY['žák popíše stavbu semenných rostlin', 'rozliší nahosemenné a krytosemenné', 'určí vybrané druhy'],
   ARRAY['k učení', 'občanské'], 18, 4, '2021')
ON CONFLICT DO NOTHING;

-- Přírodopis 7. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('prirodopis', 7, 'Biologie živočichů', 'Bezobratlí', 
   ARRAY['žák charakterizuje hlavní skupiny bezobratlých', 'popíše jejich stavbu těla', 'uvede příklady druhů'],
   ARRAY['k učení', 'k řešení problémů'], 20, 1, '2021'),
  ('prirodopis', 7, 'Biologie živočichů', 'Ryby, obojživelníci, plazi', 
   ARRAY['žák popíše stavbu těla ryb', 'charakterizuje obojživelníky a plazy', 'vysvětlí přizpůsobení prostředí'],
   ARRAY['k učení', 'občanské'], 18, 2, '2021'),
  ('prirodopis', 7, 'Biologie živočichů', 'Ptáci', 
   ARRAY['žák popíše stavbu těla ptáků', 'vysvětlí přizpůsobení k letu', 'rozpozná vybrané druhy'],
   ARRAY['k učení', 'občanské'], 14, 3, '2021'),
  ('prirodopis', 7, 'Biologie živočichů', 'Savci', 
   ARRAY['žák charakterizuje savce', 'popíše hlavní skupiny savců', 'vysvětlí jejich význam'],
   ARRAY['k učení', 'občanské'], 18, 4, '2021')
ON CONFLICT DO NOTHING;

-- Přírodopis 8. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('prirodopis', 8, 'Biologie člověka', 'Soustava opěrná a pohybová', 
   ARRAY['žák popíše kostru člověka', 'charakterizuje svaly', 'vysvětlí význam pohybu'],
   ARRAY['k učení', 'občanské'], 14, 1, '2021'),
  ('prirodopis', 8, 'Biologie člověka', 'Soustava oběhová a dýchací', 
   ARRAY['žák popíše oběhovou soustavu', 'charakterizuje dýchací soustavu', 'vysvětlí první pomoc'],
   ARRAY['k učení', 'občanské', 'sociální'], 16, 2, '2021'),
  ('prirodopis', 8, 'Biologie člověka', 'Soustava trávicí a vylučovací', 
   ARRAY['žák popíše trávicí soustavu', 'vysvětlí proces trávení', 'charakterizuje zdravou výživu'],
   ARRAY['k učení', 'občanské'], 14, 3, '2021'),
  ('prirodopis', 8, 'Biologie člověka', 'Soustava nervová a smyslová', 
   ARRAY['žák popíše nervovou soustavu', 'charakterizuje smyslové orgány', 'vysvětlí reflexy'],
   ARRAY['k učení', 'k řešení problémů'], 16, 4, '2021')
ON CONFLICT DO NOTHING;

-- Přírodopis 9. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('prirodopis', 9, 'Genetika', 'Dědičnost a proměnlivost', 
   ARRAY['žák vysvětlí základy dědičnosti', 'popíše geny a chromozomy', 'řeší jednoduché genetické úlohy'],
   ARRAY['k učení', 'k řešení problémů'], 16, 1, '2021'),
  ('prirodopis', 9, 'Ekologie', 'Ekosystémy a ochrana přírody', 
   ARRAY['žák charakterizuje ekosystémy', 'vysvětlí potravní řetězce', 'zhodnotí význam ochrany přírody'],
   ARRAY['k učení', 'občanské'], 18, 2, '2021'),
  ('prirodopis', 9, 'Geologie', 'Stavba Země a horniny', 
   ARRAY['žák popíše stavbu Země', 'rozliší druhy hornin', 'vysvětlí geologické procesy'],
   ARRAY['k učení', 'k řešení problémů'], 14, 3, '2021'),
  ('prirodopis', 9, 'Neživá příroda', 'Vesmír a sluneční soustava', 
   ARRAY['žák charakterizuje vesmír', 'popíše sluneční soustavu', 'vysvětlí pohyby Země'],
   ARRAY['k učení', 'k řešení problémů'], 12, 4, '2021')
ON CONFLICT DO NOTHING;

-- =====================================================
-- FYZIKA (Physics)
-- =====================================================

INSERT INTO curriculum_subjects (code, name, description, icon, color, hours_per_week_default, grades)
VALUES (
  'fyzika',
  'Fyzika',
  'Fyzika pro 2. stupeň ZŠ',
  'atom',
  '#9932CC',
  2,
  '{6,7,8,9}'
) ON CONFLICT (code) DO NOTHING;

-- Fyzika 6. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('fyzika', 6, 'Látky a tělesa', 'Vlastnosti látek', 
   ARRAY['žák rozliší fyzikální a chemické vlastnosti', 'měří délku, hmotnost, objem', 'používá měřidla'],
   ARRAY['k učení', 'k řešení problémů'], 16, 1, '2021'),
  ('fyzika', 6, 'Látky a tělesa', 'Částicová stavba látek', 
   ARRAY['žák popíše částicovou stavbu', 'vysvětlí rozdíly mezi stavy látek', 'charakterizuje difúzi'],
   ARRAY['k učení', 'k řešení problémů'], 14, 2, '2021'),
  ('fyzika', 6, 'Pohyb těles', 'Pohyb a rychlost', 
   ARRAY['žák popíše pohyb tělesa', 'vypočítá rychlost', 'sestrojí graf pohybu'],
   ARRAY['k učení', 'k řešení problémů'], 18, 3, '2021'),
  ('fyzika', 6, 'Síla', 'Síla a její účinky', 
   ARRAY['žák charakterizuje sílu', 'měří sílu', 'vysvětlí účinky síly'],
   ARRAY['k učení', 'k řešení problémů'], 16, 4, '2021')
ON CONFLICT DO NOTHING;

-- Fyzika 7. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('fyzika', 7, 'Mechanika', 'Newtonovy pohybové zákony', 
   ARRAY['žák formuluje Newtonovy zákony', 'aplikuje zákony v úlohách', 'vysvětlí setrvačnost'],
   ARRAY['k učení', 'k řešení problémů'], 18, 1, '2021'),
  ('fyzika', 7, 'Mechanika', 'Práce, výkon, energie', 
   ARRAY['žák vypočítá práci a výkon', 'rozliší druhy energie', 'vysvětlí zákon zachování energie'],
   ARRAY['k učení', 'k řešení problémů'], 16, 2, '2021'),
  ('fyzika', 7, 'Mechanika', 'Tlak a hydrostatika', 
   ARRAY['žák vypočítá tlak', 'vysvětlí Pascalův zákon', 'popíše hydrostatický tlak'],
   ARRAY['k učení', 'k řešení problémů'], 16, 3, '2021'),
  ('fyzika', 7, 'Termika', 'Teplo a teplota', 
   ARRAY['žák rozliší teplo a teplotu', 'popíše způsoby šíření tepla', 'řeší kalorimetrické úlohy'],
   ARRAY['k učení', 'k řešení problémů'], 14, 4, '2021')
ON CONFLICT DO NOTHING;

-- Fyzika 8. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('fyzika', 8, 'Elektřina', 'Elektrický proud', 
   ARRAY['žák popíše elektrický obvod', 'měří napětí a proud', 'vypočítá odpor'],
   ARRAY['k učení', 'k řešení problémů'], 20, 1, '2021'),
  ('fyzika', 8, 'Elektřina', 'Ohmův zákon', 
   ARRAY['žák aplikuje Ohmův zákon', 'řeší úlohy s odpory', 'zapojuje obvody'],
   ARRAY['k učení', 'k řešení problémů'], 16, 2, '2021'),
  ('fyzika', 8, 'Elektřina', 'Elektrická práce a výkon', 
   ARRAY['žák vypočítá elektrickou práci', 'vypočítá elektrický výkon', 'vysvětlí účinky proudu'],
   ARRAY['k učení', 'k řešení problémů'], 14, 3, '2021'),
  ('fyzika', 8, 'Magnetismus', 'Magnetické pole', 
   ARRAY['žák popíše magnetické pole', 'charakterizuje elektromagnet', 'vysvětlí elektromagnetickou indukci'],
   ARRAY['k učení', 'k řešení problémů'], 14, 4, '2021')
ON CONFLICT DO NOTHING;

-- Fyzika 9. třída
INSERT INTO curriculum_rvp_data (subject_code, grade, thematic_area, topic, expected_outcomes, key_competencies, recommended_hours, order_index, rvp_revision)
VALUES 
  ('fyzika', 9, 'Optika', 'Světlo a jeho vlastnosti', 
   ARRAY['žák popíše vlastnosti světla', 'vysvětlí odraz a lom', 'charakterizuje optická zařízení'],
   ARRAY['k učení', 'k řešení problémů'], 18, 1, '2021'),
  ('fyzika', 9, 'Akustika', 'Zvuk', 
   ARRAY['žák popíše vznik zvuku', 'charakterizuje vlastnosti zvuku', 'vysvětlí sluch'],
   ARRAY['k učení', 'k řešení problémů'], 12, 2, '2021'),
  ('fyzika', 9, 'Jaderná fyzika', 'Atomové jádro a radioaktivita', 
   ARRAY['žák popíše stavbu atomu', 'vysvětlí radioaktivitu', 'zhodnotí využití jaderné energie'],
   ARRAY['k učení', 'občanské'], 16, 3, '2021'),
  ('fyzika', 9, 'Energie', 'Zdroje energie a ekologie', 
   ARRAY['žák porovná zdroje energie', 'zhodnotí obnovitelné zdroje', 'posoudí vliv na životní prostředí'],
   ARRAY['k učení', 'občanské'], 14, 4, '2021')
ON CONFLICT DO NOTHING;
