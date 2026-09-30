-- Llaves de acceso (iteración 13): como el segundo factor, son credenciales y no datos del negocio;
-- quien las tiene puede quitarlas, y restablecer el acceso de una persona las quita todas.
GRANT SELECT, INSERT, UPDATE, DELETE ON identidad.llaves_de_acceso TO teins_app;
