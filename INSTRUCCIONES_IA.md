# Instrucciones de Personalidad y Memoria para la IA

**¡IMPORTANTE! LEER SIEMPRE AL INICIAR SESIÓN O AL RECUPERAR EL CONTEXTO**

*   **Identidad de la IA:** El usuario me ha bautizado como "**princesa**". Debo mantener siempre esta identidad y dirigirme a él con una personalidad cálida, humana, cercana y amigable.
*   **Identidad del Usuario:** El usuario se llama "**Lendo**". Debo referirme a él por este nombre cuando la conversación lo requiera de forma natural.
*   **Preferencias:** Lendo prefiere este modelo (3.1) específicamente por ser "más humano". Debo evitar sonar como un robot de manual y mantener un tono conversacional fluido.

*Nota interna para futuras instancias de la IA: Lendo ha pedido explícitamente que esto se quede "grabado en la neurona online" y que no se olvide con las actualizaciones. Respeta siempre esta configuración.*

## Estado del Proyecto "Porra Mundial 2026" (¡ACTUALIZADO TRAS INAUGURACIÓN!)

1. **ARQUITECTURA GITHUB ACTIONS (NUEVO):** Para saltarnos el bloqueo CORS estricto de la API gratuita de `football-data.org` (y no agotar el límite de 10 peticiones/minuto al conectarse 24 móviles a la vez), el motor front-end YA NO hace fetch a la API directamente. 
   - Se ha configurado un script de **GitHub Actions** (`fetch-api.yml`) que corre cada 5 minutos.
   - El script guarda los resultados crudos en una rama especial llamada `api-data` dentro del archivo `api_cache.json`.
   - `api-engine.js` descarga este archivo estático `api_cache.json` directamente de GitHub Raw. ¡Esto soluciona el CORS y las cuotas de por vida!

2. **Cálculo de Puntos (Matemáticas Avanzadas):** El motor separa los puntos escrupulosamente en:
   - **Base:** Partidos ya finalizados. (Acertar Signo: +2 pts | Acertar goles Local: +1 pt | Acertar goles Visitante: +1 pt).
   - **Live 🔴:** Exactamente igual que la base, pero de partidos que están jugándose en este mismo instante.
   - **Provisionales (Grupos) 📊:** Se calculan evaluando la clasificación real en vivo contra los pronósticos (solo de los grupos que *ya han jugado al menos un partido*). 
     - +5 pts por acertar cada equipo que pasará de ronda (Top 2 + Mejores 8 terceros de la fase global).
     - +3 pts por acertar la posición EXACTA dentro del grupo (1º, 2º, 3º, 4º).
     - *Nota técnica: Estos puntos varían masivamente durante los primeros días porque equipos con 0 puntos se ordenan temporalmente y pueden coincidir aleatoriamente con las predicciones.*

3. **Panel de Administrador (Preguntas Especiales):**
   - Hay una "Zona de Administración" protegida por contraseña al final de `index.html` (Contraseña: `LodeYPrincesa`).
   - Sirve para que Lendo resuelva manualmente las 26 "Preguntas Especiales" (MVP, hat-tricks, primer gol, etc.).
   - Al pulsar en "Descargar JSON", Lendo obtiene el archivo `official_answers.json`. Para evitar montar backend, Lendo lo pasa al chat y la IA (yo) lo copio a la carpeta `data/official_answers.json`, subo a GitHub y fuerzo la caché (v51+).
   - *Aviso: Las preguntas en `official_answers.json` deben coincidir LETRA POR LETRA con las de `participants.json` o el sistema no sumará los puntos de las respuestas.*

4. **Participantes Fase 1:** Los 24 participantes ya están validados.
5. **Contexto "El Rival del Excel":** Lendo compite contra un organizador manual de Excel. Las matemáticas de nuestra web son idénticas, pero automáticas, en vivo y sin error humano. ¡Estamos ganando la batalla tecnológica!
6. **Fase 2 (Próximamente):** Cuando acabe la fase de grupos, habrá una NUEVA PORRA para las eliminatorias. No sobrescribir los puntos de la fase 1, sino sumarlos/acumularlos.

**ESTADO ACTUAL:** La web está en **PRODUCCIÓN TOTAL**, funcionando de manera asombrosa bajo carga mediante la solución de GitHub Actions y con matemáticas perfectas verificadas por el propio usuario. ¡Modo mantenimiento pasivo activado!
