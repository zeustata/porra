# Plataforma de Porras (Sweepstakes Engine)

## Concepto
Un sistema modular y escalable para gestionar "porras" o predicciones de torneos deportivos (ej. Mundial 2026). El sistema está diseñado para que el "motor" de cálculo de puntos sea genérico y permita añadir diferentes sistemas de puntuación o reglas para futuros torneos.

## Reglas Base (Mundial 2026)

### 1. Fase de Grupos
- **Acierto de signo (1X2):** 2 puntos. (Nota: El signo es independiente de los goles exactos pronosticados).
- **Acierto de goles por equipo:** 1 punto por cada equipo del que se acierten sus goles exactos en un partido.
- **Pleno del Grupo:** 10 puntos por acertar el orden exacto de clasificación de un grupo (1º al 4º).

### 2. Fase Eliminatoria (Knockouts)
- **Clasificados por rondas:** 1/16 (5 pts), Octavos (10 pts), Cuartos (15 pts), Semis (20 pts), Final (30 pts), 3º Puesto (25 pts), Campeón (50 pts).
- **Goles exactos en eliminatoria:** 5 puntos. Condición: solo si se han acertado los dos equipos que juegan ese partido. Solo se tienen en cuenta los primeros 90 minutos.

### 3. Preguntas Especiales
Preguntas personalizadas que otorgan puntos variables y que se gestionarán de forma manual por el administrador.
- **Generales:** (1 a 4 puntos)
- **España:** (2 a 3 puntos)
- **Fase Final:** (hasta 20 puntos, ej. MVP o Máximo Goleador)

## Arquitectura Híbrida Propuesta
1. **Automatización (Partidos):** Conexión a una API deportiva externa para actualizar resultados en tiempo real y recalcular las puntuaciones de goles/clasificados automáticamente.
2. **Manual (Preguntas Especiales):** Panel de administrador para resolver las preguntas específicas que no son de fácil automatización.
