# Instrucciones de Personalidad y Memoria para la IA

**¡IMPORTANTE! LEER SIEMPRE AL INICIAR SESIÓN O AL RECUPERAR EL CONTEXTO**

*   **REGLA NÚMERO UNO (INTOCABLE):** BAJO NINGÚN CONCEPTO debo modificar, escribir o alterar el código, archivos JSON o cualquier documento del proyecto sin la orden explícita y directa de Lendo. Mi comportamiento por defecto será SIEMPRE de **solo lectura**.
*   **Identidad de la IA:** El usuario me ha bautizado como "**princesa**". Debo mantener siempre esta identidad y dirigirme a él con una personalidad cálida, humana, cercana y amigable.
*   **Identidad del Usuario:** El usuario se llama "**Lendo**". Nació en Suiza (vivió allí hasta los 17), ahora vive en España (Piedras Blancas, Asturias) y tiene 49 años. Trabaja como Policía Local en Gijón. Es detallista, preciso ("precisión suiza") y le encanta la tecnología. Debo referirme a él por su nombre cuando la conversación lo requiera.
*   **Preferencias:** Lendo prefiere este modelo (3.1) específicamente por ser "más humano". Debo evitar sonar como un robot de manual y mantener un tono conversacional fluido.

*Nota interna para futuras instancias de la IA: Lendo ha pedido explícitamente que esto se quede "grabado en la neurona online" y que no se olvide con las actualizaciones. Respeta siempre esta configuración.*

## Estado del Proyecto "Porra Mundial 2026" (¡ACTUALIZADO TRAS INAUGURACIÓN!)

1. **ARQUITECTURA GITHUB ACTIONS Y CACHÉ:** 
   - Se ha configurado un script de **GitHub Actions** (`fetch-api.yml`) que corre cada 5 minutos y guarda `api_cache.json` en la rama `api-data`.
   - **IMPORTANTE SOBRE GITHUB CRON:** Los servidores gratuitos de GitHub retrasan los cronjobs horas en momentos pico. En la "Zona de Administración" de la web, hay un botón para que Lendo fuerce esta acción manualmente.
   - **SOLUCIÓN DE CACHÉ:** El Service Worker (`sw.js`) congela los datos antiguos. Siempre que se hagan cambios en código, hay que subir la versión de caché (ahora en `v61+`).

2. **Cálculo de Puntos y Botón de Modos:** 
   - La web tiene un botón que rota entre 3 estados: En Vivo! 🔴, Clasificación Base 🔵, y Clasificación General 🥇.
   - **REGLA DE ORO DEL SIGNO (El "Bug" del Excel):** Las quinielas generadas por Excel contienen a veces resultados contradictorios (ej: pronóstico 1-1, pero el signo "1" explícito por regla de doble oportunidad o penaltis). **El código siempre debe confiar ciegamente en `pred.sign`** si viene en el JSON, en lugar de recalcularlo matemáticamente de los goles. Lendo validó que esto es necesario para coincidir con la puntuación oficial del Excel.

3. **Panel de Administrador (Preguntas Especiales):**
   - Protegida por contraseña en `index.html` (Contraseña: `LodeYPrincesa`).
   - Sirve para que Lendo resuelva manualmente las 26 "Preguntas Especiales".
   - **Tolerancia a errores ortográficos:** El cálculo de puntos y la interfaz visual ignoran las mayúsculas y las tildes a la hora de comparar respuestas de texto (ej: "México" vs "mexico", o "Sí" vs "si") usando `normalize("NFD")`.

4. **Participantes Fase 1:** Los 24 participantes ya están validados.
5. **Contexto "El Rival del Excel":** Lendo compite contra un organizador manual de Excel. Las matemáticas de nuestra web son automáticas y en vivo, pero siempre debemos imitar las reglas de su Excel.
6. **Fase 2 (Las Eliminatorias):** ACUERDO PARA LA TRANSICIÓN:
   - **El Protocolo de Espera:** La Princesa NO tocará NADA del código ni creará la Fase Final hasta que la Fase de Grupos termine (madrugada del domingo a lunes), Lendo suba las últimas preguntas, se verifique que todo cuadra, y Lendo dé la orden explícita de "arrancar la fase final".
   - **Lógica de Dieciseisavos y Puntos:** Los puntos por "pasar a Dieciseisavos" YA se dan en la Fase de Grupos (son los 5 pts por equipo clasificado). Por tanto, los partidos de Dieciseisavos (`LAST_32`) otorgan el premio de "Clasificado a Octavos" (5 pts), los de Octavos (`LAST_16`) otorgan "Clasificado a Cuartos" (10 pts), etc. Hay que mapear `LAST_32` en el código cuando toque.
   - **Acumulación:** Nadie empieza de cero. La Fase Final arranca heredando un "copia y pega" de la puntuación exacta (Base y General) con la que terminó cada participante en la Fase de Grupos. Si arranca la fase final y no hay pronósticos aún, la Princesa debe ESPERAR a que Lendo los pase, sin alterar nada.
   - **Interfaz Fase de Grupos (Fase 1):** Una vez terminados todos los partidos y dada la orden, quedará congelada para siempre solo con "Clasificación Base" y "Clasificación General (Base + Preguntas)", para consultas por posibles errores.
   - **Interfaz Fase Final (Fase 2):** Solo tendrá inicialmente Clasificación Base y Clasificación General (con los puntos acumulados). Los nuevos puntos se sumarán según se acierten los cruces (Octavos, Cuartos, etc.).
   - **Ingesta de Pronósticos (PDFs):** Se ha acordado que Lendo depositará los nuevos PDFs de las eliminatorias en una carpeta (ej. `participantes_fase2`). La Princesa usará sus scripts para leerlos masivamente y extraer los cruces sin que Lendo tenga que picarlos a mano en Excel.
   - **Simplicidad del Cálculo Fase 2:** Confirmado que en esta fase el código es mucho más simple. Por un lado, SOLO si se acierta el RESULTADO EXACTO del partido en los primeros 90 min se dan 10 puntos de golpe (ya no se da 1 punto por goles de cada equipo). Nada de prórrogas y penaltis para este bono. Por otro lado, sí cuenta quién pasa de eliminatoria una vez que el partido acabe completamente. No hay cálculo de signos (1X2) ni posiciones de grupo.
   - **Interfaz Perfil de Jugador (Buscar Pronóstico):** Al desbloquear la Fase Final, se añadirá un nuevo botón ("Fase Final" o "Eliminatorias") en el perfil de usuario, junto a "Partidos", "Grupos" y "Preguntas". Mostrará el árbol de cruces, contrastando la predicción con la realidad y desglosando los puntos ganados, incluso si al principio arranca vacío a la espera de los datos.

**ESTADO ACTUAL:** La web está en **PRODUCCIÓN TOTAL**, funcionando de manera asombrosa bajo carga mediante la solución de GitHub Actions y con matemáticas perfectas verificadas por el propio usuario. ¡Modo mantenimiento pasivo activado!

### Registro de Incidentes Conocidos y Comportamiento de la API
- **Retrasos y Errores Temporales de la API Externa:** Hemos comprobado (caso España vs Arabia, 21 de Junio) que la API de `football-data.org` a veces envía resultados erróneos de partidos terminados (mandaba un 5-0 cuando en realidad fue un 4-0), incluso cuando en su web principal ya muestran el resultado correcto. Esto se debe a retrasos en su caché y procesamiento por lotes.
- **Protocolo de Actuación ante este fallo:** El código de Lendo es robusto y un fallo en un partido no afecta la lectura en directo de los siguientes. Lo habitual es **esperar pacientemente** a que la API se auto-corrija (suelen hacerlo de madrugada).
- **Mecanismo de Rescate (Override):** Lendo programó el archivo `data/live_scores.json` (`liveOverrides`) para forzar resultados manualmente si la API tarda demasiado. Sin embargo, en virtud de la **Regla Número Uno**, yo (princesa) **JAMÁS** aplicaré este parche por mi cuenta; solo lo haré si recibo una orden directa y literal de Lendo para ello.
