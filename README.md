# Plataforma de Porras (Sweepstakes Engine)

## Concepto
Un sistema modular y escalable para gestionar "porras" o predicciones de torneos deportivos (ej. Mundial 2026). El sistema está diseñado para que el "motor" de cálculo de puntos sea genérico y permita añadir diferentes sistemas de puntuación o reglas para futuros torneos.

## Reglas Base Oficiales (Mundial 2026)
*Límite de inscripción: 5 de Junio.*

### 1. Fase de Grupos
- **Goles exactos:** 1 punto por cada equipo del que se acierten sus goles exactos en un partido.
- **Signo (1X2):** 2 puntos por acertar el resultado final.

### 2. Clasificación Fase de Grupos
- **Equipos clasificados:** 5 puntos por cada equipo acertado que se clasifique (da igual el orden).
- **Orden exacto:** 3 puntos por cada acierto en el orden de clasificación exacto.

### 3. Fase Eliminatoria
*Se abrirá un único periodo entre el último partido de grupos y la primera eliminatoria.*
- **Goles exactos en 90 min:** 10 puntos por partido.
- **Clasificados a Octavos:** 5 puntos por acierto.
- **Clasificados a Cuartos:** 10 puntos por acierto.
- **Clasificados a Semifinales:** 15 puntos por acierto.
- **Clasificados para el tercer y cuarto puesto:** 25 puntos por acierto.
- **Clasificados para la Final:** 30 puntos por acierto.
*Nota: Puntos de esta fase supeditados a los cruces pronosticados.*

### 4. Premios Finales y Preguntas
- **Tercer Clasificado del Mundial:** 25 puntos.
- **Campeón del Mundial:** 50 puntos.
- **Preguntas Varias:** 26 preguntas, 100 puntos en total.

### 5. Distribución de Premios
- 1º: 40%
- 2º: 25%
- 3º: 15%
- 4º: 10%
- 5º: 5%
- Mejor en preguntas: 5%

## Arquitectura Híbrida Propuesta
1. **Automatización (Partidos):** Conexión a una API deportiva externa para actualizar resultados en tiempo real y recalcular las puntuaciones de goles/clasificados automáticamente.
2. **Manual (Preguntas Especiales):** Panel de administrador para resolver las preguntas específicas que no son de fácil automatización.
