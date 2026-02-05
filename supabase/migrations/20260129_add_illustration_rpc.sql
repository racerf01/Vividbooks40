-- RPC funkce pro atomické přidání ilustrace do DataSetu
-- Zabraňuje race condition při souběžném generování více ilustrací

CREATE OR REPLACE FUNCTION add_illustration_to_dataset(
  p_dataset_id UUID,
  p_prompt_id TEXT,
  p_illustration JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_media JSONB;
  v_illustrations JSONB;
  v_prompts JSONB;
  v_result JSONB;
BEGIN
  -- Zamknout řádek pro atomickou operaci
  SELECT media INTO v_media
  FROM topic_data_sets
  WHERE id = p_dataset_id
  FOR UPDATE;
  
  IF v_media IS NULL THEN
    v_media := '{}'::jsonb;
  END IF;
  
  -- Získat existující ilustrace (nebo prázdné pole)
  v_illustrations := COALESCE(v_media->'generatedIllustrations', '[]'::jsonb);
  
  -- Odstranit existující ilustraci se stejným ID (pokud existuje)
  v_illustrations := (
    SELECT COALESCE(jsonb_agg(ill), '[]'::jsonb)
    FROM jsonb_array_elements(v_illustrations) AS ill
    WHERE ill->>'id' != p_prompt_id
  );
  
  -- Přidat novou ilustraci
  v_illustrations := v_illustrations || jsonb_build_array(p_illustration);
  
  -- Aktualizovat prompty - nastavit status na completed a přidat URL
  v_prompts := COALESCE(v_media->'illustrationPrompts', '[]'::jsonb);
  v_prompts := (
    SELECT COALESCE(jsonb_agg(
      CASE 
        WHEN prompt->>'id' = p_prompt_id 
        THEN prompt || jsonb_build_object(
          'status', 'completed',
          'generatedUrl', p_illustration->>'url'
        )
        ELSE prompt
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(v_prompts) AS prompt
  );
  
  -- Aktualizovat media objekt
  v_media := v_media || jsonb_build_object(
    'generatedIllustrations', v_illustrations,
    'illustrationPrompts', v_prompts
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
GRANT EXECUTE ON FUNCTION add_illustration_to_dataset TO authenticated;
