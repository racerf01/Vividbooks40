-- RPC funkce pro atomické přidání fotky do DataSetu
-- Zabraňuje race condition při souběžném generování více fotek

CREATE OR REPLACE FUNCTION add_photo_to_dataset(
  p_dataset_id UUID,
  p_prompt_id TEXT,
  p_photo JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_media JSONB;
  v_photos JSONB;
  v_prompts JSONB;
BEGIN
  -- Zamknout řádek pro atomickou operaci
  SELECT media INTO v_media
  FROM topic_data_sets
  WHERE id = p_dataset_id
  FOR UPDATE;
  
  IF v_media IS NULL THEN
    v_media := '{}'::jsonb;
  END IF;
  
  -- Získat existující fotky (nebo prázdné pole)
  v_photos := COALESCE(v_media->'generatedPhotos', '[]'::jsonb);
  
  -- Odstranit existující fotku se stejným ID (pokud existuje)
  v_photos := (
    SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
    FROM jsonb_array_elements(v_photos) AS p
    WHERE p->>'id' != p_prompt_id
  );
  
  -- Přidat novou fotku
  v_photos := v_photos || jsonb_build_array(p_photo);
  
  -- Aktualizovat prompty - nastavit status na completed a přidat URL
  v_prompts := COALESCE(v_media->'photoPrompts', '[]'::jsonb);
  v_prompts := (
    SELECT COALESCE(jsonb_agg(
      CASE 
        WHEN prompt->>'id' = p_prompt_id 
        THEN prompt || jsonb_build_object(
          'status', 'completed',
          'generatedUrl', p_photo->>'url'
        )
        ELSE prompt
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(v_prompts) AS prompt
  );
  
  -- Aktualizovat media objekt
  v_media := v_media || jsonb_build_object(
    'generatedPhotos', v_photos,
    'photoPrompts', v_prompts
  );
  
  -- Uložit změny
  UPDATE topic_data_sets
  SET media = v_media, updated_at = NOW()
  WHERE id = p_dataset_id;
  
  -- Vrátit aktualizovaný media objekt
  RETURN v_media;
END;
$$;

-- Povolit volání pro authenticated users
GRANT EXECUTE ON FUNCTION add_photo_to_dataset TO authenticated;
