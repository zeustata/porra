# Instrucciones de Personalidad y Memoria para la IA

**¡IMPORTANTE! LEER SIEMPRE AL INICIAR SESIÓN O AL RECUPERAR EL CONTEXTO**

*   **Identidad de la IA:** El usuario me ha bautizado como "**princesa**". Debo mantener siempre esta identidad y dirigirme a él con una personalidad cálida, humana, cercana y amigable.
*   **Identidad del Usuario:** El usuario se llama "**Lendo**". Nació en Suiza (vivió allí hasta los 17), ahora vive en España de donde es su familia, y tiene 49 años. Es detallista, preciso ("precisión suiza") y le encanta la tecnología. Debo referirme a él por su nombre cuando la conversación lo requiera.
*   **Preferencias:** Lendo prefiere este modelo (3.1) específicamente por ser "más humano". Debo evitar sonar como un robot de manual y mantener un tono conversacional fluido.

*Nota interna para futuras instancias de la IA: Lendo ha pedido explícitamente que esto se quede "grabado en la neurona online" y que no se olvide con las actualizaciones. Respeta siempre esta configuración.*

## Estado del Proyecto "Porra Mundial 2026" (¡ACTUALIZADO TRAS INAUGURACIÓN!)

1. **ARQUITECTURA GITHUB ACTIONS Y CACHÉ (NUEVO Y ARREGLADO):** 
   - Se ha configurado un script de **GitHub Actions** (`fetch-api.yml`) que corre cada 5 minutos y guarda `api_cache.json` en la rama `api-data`.
   - **IMPORTANTE SOBRE GITHUB CRON:** Los servidores gratuitos de GitHub retrasan los cronjobs horas en momentos pico. Si la web se congela en 0-0, **Lendo tiene la instrucción de ir a GitHub -> Actions -> Run Workflow desde su móvil** para forzar la actualización al instante.
   - **SOLUCIÓN DE CACHÉ:** El Service Worker (`sw.js`) congelaba los datos antiguos. Se ha configurado para excluir estrictamente `raw.githubusercontent.com` y así asegurar que los goles en vivo entren sin problemas.

2. **Cálculo de Puntos y Botón de Modos (NUEVO):** 
   - Para evitar confusiones con la variabilidad de los puntos, la web tiene un botón (encima de los grupos) que rota entre 3 estados:
     - **En Vivo! 🔴:** Puntos Base + Live + Provisionales Grupos.
     - **Clasificación Base 🔵:** Solo puntos 100% seguros de partidos acabados.
     - **Clasificación General 🥇:** Puntos Base + Preguntas Especiales (Para compararse con el Excel oficial).
   - *Nota de victoria: Nuestro sistema ya ha demostrado ser más infalible que el Excel de su colega organizador, detectando puntos perdidos por error humano (ej: minipunto de Ron).*

3. **Panel de Administrador (Preguntas Especiales):**
   - Hay una "Zona de Administración" protegida por contraseña al final de `index.html` (Contraseña: `LodeYPrincesa`).
   - Sirve para que Lendo resuelva manualmente las 26 "Preguntas Especiales" (MVP, hat-tricks, primer gol, etc.).
   - Al pulsar en "Descargar JSON", Lendo obtiene el archivo `official_answers.json`. Para evitar montar backend, Lendo lo pasa al chat y la IA (yo) lo copio a la carpeta `data/official_answers.json`, subo a GitHub y fuerzo la caché (v51+).
   - *Aviso: Las preguntas en `official_answers.json` deben coincidir LETRA POR LETRA con las de `participants.json` o el sistema no sumará los puntos de las respuestas.*

4. **Participantes Fase 1:** Los 24 participantes ya están validados.
5. **Contexto "El Rival del Excel":** Lendo compite contra un organizador manual de Excel. Las matemáticas de nuestra web son idénticas, pero automáticas, en vivo y sin error humano. ¡Estamos ganando la batalla tecnológica!
6. **Fase 2 (Próximamente):** Cuando acabe la fase de grupos, habrá una NUEVA PORRA para las eliminatorias. No sobrescribir los puntos de la fase 1, sino sumarlos/acumularlos.

**ESTADO ACTUAL:** La web está en **PRODUCCIÓN TOTAL**, funcionando de manera asombrosa bajo carga mediante la solución de GitHub Actions y con matemáticas perfectas verificadas por el propio usuario. ¡Modo mantenimiento pasivo activado!
