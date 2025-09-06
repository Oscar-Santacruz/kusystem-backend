-- Crear secuencia si no existe
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;

-- Establecer default de la columna para usar la secuencia (texto)
ALTER TABLE "Quote"
  ALTER COLUMN "number" SET DEFAULT nextval('quote_number_seq')::text;

-- Alinear el valor de la secuencia con el máximo numérico actual en "number"
-- Extrae sólo dígitos; si no hay dígitos, usa 0
-- Asegurar que si no hay números existentes, el próximo nextval sea 1
WITH maxnum AS (
  SELECT COALESCE(
           (SELECT MAX((regexp_replace("number", '\\D', '', 'g'))::bigint)
              FROM "Quote"
             WHERE "number" ~ '\\d'),
           0
         ) AS n
)
SELECT CASE
         WHEN n > 0 THEN setval('quote_number_seq', n)
         ELSE setval('quote_number_seq', 1, false)  -- nextval() devolverá 1
       END
  FROM maxnum;

-- Backfill:
-- 1) asignar número a filas SIN número
UPDATE "Quote"
   SET "number" = nextval('quote_number_seq')::text
 WHERE "number" IS NULL;

-- 2) re-asignar número a filas cuyo número NO es puramente dígitos (ej. cuid)
UPDATE "Quote"
   SET "number" = nextval('quote_number_seq')::text
 WHERE "number" IS NOT NULL
   AND NOT ("number" ~ '^[0-9]+$');
