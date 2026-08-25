# El recorrido del vehículo, etapa por etapa

El estado de una OT no es una lista fija: **depende del tipo de ingreso**. Un service
no pasa por diagnóstico, una garantía no se presupuesta y un siniestro sí espera
repuestos. Cada tipo define su propio recorrido y la UI muestra ese recorrido —
no uno genérico.

| Tipo de ingreso | Etapas | Particularidad |
|---|---|---|
| **Mantenimiento** (service) | 8 | Se presupuesta directo: el trabajo ya se conoce |
| **Reparación correctiva** | 10 | Diagnóstico antes de presupuestar; puede esperar repuestos |
| **Diagnóstico / peritaje** | 5 | Puede terminar sin trabajo, entregando el informe |
| **Chapa y pintura** | 10 | Peritaje fotográfico pesado; los tiempos los manda el secado |
| **Neumáticos y alineación** | 7 | Se cotiza en el momento y se resuelve en el día |
| **Garantía** | 6 | Sin presupuesto: se corrige lo que el taller ya hizo |
| **Siniestro / seguro** | 10 | El peritaje y la autorización son de la compañía |
| **Preentrega** | 5 | Revisión completa que termina en informe |

Los recorridos viven en `packages/shared/workshop.ts` (`WORKORDER_KIND_DEFS`), así
que la API, el tablero y el PDF leen exactamente la misma definición.

## Las etapas

1. **Cita** *(opcional)* — agenda semanal con turnos; al llegar el vehículo se
   convierte en OT.
2. **Recepción** — fotos reales del vehículo con **marcadores de daño** tocando la
   foto (x/y relativos, aguantan cualquier pantalla y el PDF), inventario de lo que
   trae, nivel de combustible, kilometraje y **firma del cliente en pantalla**.
3. **Diagnóstico** — el técnico registra qué encontró.
4. **Presupuesto** — versionado (`PRE-2026-000004 v2`), con ítems marcables como
   *opcional* o *urgente por seguridad*. Al enviarlo se registra por qué canal.
5. **Aprobación / rechazo** — se registra **ítem por ítem** lo que el cliente
   contestó, con canal, quién respondió y el motivo del rechazo. Los aprobados pasan
   solos a la OT y el estado cambia a Aprobado o Rechazado. Si rechaza, se puede
   generar la versión siguiente arrastrando lo que no rechazó.
6. **Espera de repuestos** — pedido al proveedor; al recibir la mercadería el stock
   entra solo y el costo del repuesto se actualiza.
7. **En taller** — ejecución, partes de horas y consumo automático de repuestos.
8. **Control de calidad** — checklist de 13 puntos y prueba de ruta. Si se rechaza,
   la OT vuelve a taller; si aprueba, pasa a lavado.
9. **Entrega** — acta con quién retira, kilometraje de salida, garantía en días,
   firma de conformidad y factura opcional en el mismo acto.
10. **Postventa** — al entregar se agenda solo el llamado de satisfacción (2 días) y
    el recordatorio del próximo service.

## Roles

| Rol | Qué puede hacer |
|---|---|
| **SuperAdmin** | Toda la plataforma y el alta de talleres |
| **Admin del taller** | Todo dentro del taller: usuarios, precios, reportes |
| **Jefe de taller** | Reparte trabajo, valida diagnósticos, firma el control de calidad |
| **Recepcionista** | Atiende, recibe el vehículo, arma la OT, presupuesta y factura |
| **Técnico** | Sólo sus OT: diagnóstico, horas, repuestos usados |
| **Repuestos / Almacén** | Stock, pedidos a proveedores, recepción de mercadería |
| **Caja** | Factura, cobra y sigue las cuentas por cobrar |
| **Cliente** | Sus vehículos, presupuestos e historial |

Los permisos son atómicos (`quote:decide`, `quality:write`, …) y viven en un solo
lugar: `packages/shared/roles.ts`. La API los exige y la UI oculta lo que el rol no
puede hacer, leyendo el mismo mapa.

## Catálogo de vehículos

Importado del **vPIC de la NHTSA** (dominio público) y completado a mano con las
marcas del mercado uruguayo que ahí faltan (BYD, Chery, JAC, Jetour, DFSK…):
**120 marcas con logo y 3.656 modelos**. El selector busca por marca con su logo y
por modelo; si el modelo no está, se escribe y queda dado de alta para el taller.

Los logos vienen de `car-logos-dataset` (MIT). Son marcas registradas de sus dueños:
acá se usan para identificar el vehículo del cliente dentro del sistema.

## Ficha del vehículo

Cada auto tiene su ficha con historial profesional: relevamiento fotográfico propio
(independiente de cada OT), todas las visitas con lo que se hizo y cuánto costó, el
acumulado de daños relevados visita tras visita, datos técnicos, detalles visuales
(polarizado, llantas, GNC…), garantía vigente y próximo service.
