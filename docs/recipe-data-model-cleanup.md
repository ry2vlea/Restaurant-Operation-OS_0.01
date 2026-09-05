# Step 1 — Recipe Data Model Cleanup

La lógica de Recipes conserva el modelo existente y su almacenamiento. No se implementó Recipe Builder 2.0 ni se modificó CSS.

## 1. Archivos modificados

- `js/recipe-service.js`: normalización, validación, costos, preview, conversiones, edición, versiones y warnings.
- `js/menu-service.js`: propiedad de target food cost y cálculo de precio sugerido.
- `js/recipe-builder.js`: preview delegado a RecipeService; eliminación de fórmulas y campos comerciales.
- `recipe-builder.html`: retiro de Menu Price y Target Food Cost, conservando el layout restante.
- `js/recipes.js`: muestra costos de receta; retira métricas comerciales y precio sugerido.
- `js/sample-data.js`: precios y targets en Menu, sin esos valores en nuevas recetas de ejemplo.
- `tests/sales-architecture.cjs`: soporte de `structuredClone` en el entorno de pruebas.
- `tests/recipe-model.cjs`: pruebas nuevas de modelo, costos, conversiones, producción y páginas.
- `docs/recipe-data-model-cleanup.md`: este informe.

## 2. Modelo y API

Se mantienen `PREP_ITEM`, `MENU_PRODUCT`, `COMBO`, `recipes` y la lectura compatible de `recipeIngredients`. No hay un segundo almacenamiento de recetas ni una migración irreversible.

Los componentes conservan los nombres actuales:

| Concepto | Campo del proyecto |
|---|---|
| Tipo de componente | `sourceType` |
| ID referenciado | `sourceId` |
| Cantidad | `quantity` |
| Unidad | `unitId`, con IDs como `UNIT-EA` o `UNIT-OZ` |
| Unidad del rendimiento | `yieldUnitId` |

Se aceptan aliases de entrada `componentType`, `componentId`, `unit` y `yieldUnit`, además de referencias históricas `inventoryItemId`. Las unidades deben ser IDs del catálogo existente.

`createRecipe(values, components)` y `updateRecipe(id, changes, components)` comparten `prepareRecipe`. Ambos también aceptan `values.components`/`changes.components`. La edición conserva ID y fecha de creación, incrementa versión ante cambios de contenido y devuelve componentes independientes del caché para permitir edición segura.

Se incorporan `calculateRecipePreview(values, components)`, `getRecipeWarnings(recipeId)` y la API pública `convertYieldQuantity(recipe, quantity, unitId)`. Se conservan `calculateCost`, `calculateRecipeCost`, `resolveComponentCost` y `resolveInventoryUsage`; esta última acepta opcionalmente `{ unitId }` para la cantidad raíz.

## 3. Campos deprecados

RecipeService **ya no es propietario de Selling Price ni Target Food Cost**. No calcula food cost %, contribución ni precio sugerido. Rechaza esos campos como cambios de entrada, sin borrar los valores históricos previamente almacenados. Las nuevas recetas no los guardan.

`calculateSuggestedPrice` se trasladó a MenuService, que guarda `targetFoodCostPercent` por Menu Item y utiliza el target global como fallback. No se copiaron componentes a Menu Items.

## 4. Validación

Estas reglas están aplicadas en el servicio, no solamente en los selects:

- **PREP_ITEM → INVENTORY_ITEM solamente.**
- **MENU_PRODUCT → INVENTORY_ITEM + PREP_ITEM.**
- **COMBO → MENU_PRODUCT + INVENTORY_ITEM.**

Se comprueban nombre, tipo reconocido, componentes no vacíos, cantidades finitas y positivas, rendimiento válido, unidades convertibles, existencia de referencias y coincidencia entre tipo declarado y tipo real. Los Menu Products dentro de Combos usan EA. Se detectan referencias circulares antes de reutilizar resultados en caché.

Solamente PREP_ITEM puede tener `producedInventoryItemId`. El inventario producido debe existir, aceptar la unidad del rendimiento y no ser un ingrediente de sí mismo. Los cambios de tipo no pueden invalidar referencias existentes de Recipes o Menu.

`getRecipeWarnings` expone problemas estructurales, costos faltantes e inventario/recetas inactivos. Una receta histórica inválida sigue almacenada y visible con error; no produce un resultado silenciosamente incorrecto.

Los antiguos writers públicos `saveRecipes` y `saveIngredients` no tenían consumidores externos en el repositorio. Se retiró el acceso público a `saveRecipes` y se eliminó `saveIngredients`, evitando saltarse las validaciones mediante esas APIs.

## 5. Costeo

**RecipeService sigue siendo la única fuente de verdad del costo de recetas.** El preview usa el mismo motor que las recetas guardadas, incluyendo costos anidados y estados incompletos. No guarda recetas temporales ni altera inventario.

El resultado conserva `totalCost`, `unitCost`, `costPerYieldUnit`, líneas y errores, y expone `recipeId`, `type`, `yieldQuantity` y `yieldUnitId`. Los Prep Items calculan costo de lote y costo por unidad de rendimiento; Menu Products y Combos calculan costo por producto.

## 6. Conversiones

Se centralizan en RecipeService, tanto para costeo como para consumo. Las conversiones de ingredientes físicos siguen usando InventoryService. Para Prep Items con inventario producido se prefieren factores de conversión específicos de ese inventario.

Se conserva `GAL ↔ OZ` para compatibilidad con recetas existentes y con el ejemplo solicitado, además de GAL/QT/FLOZ y LB/OZ. No se infiere una conversión LB ↔ volumen sin factores específicos del producto.

## 7. Compatibilidad y verificación

ProductionService conserva su implementación: consume ingredientes y aumenta el inventario producido. Un Prep Item sin inventario producido sirve como subreceta y no se puede producir mediante ese servicio. Sales conserva snapshots históricos y Theoretical Usage sigue prefiriéndolos; el fallback sin snapshot continúa usando RecipeService.

Comandos reproducibles con Node:

```sh
node tests/recipe-model.cjs
node tests/sales-architecture.cjs
```

Ambas suites pasaron con Node 24.18.1 incluido en VS Code. También pasó `git diff --check` y la validación sintáctica de los archivos JavaScript de primer nivel.

Pruebas A/B/C con costos de inventario explícitos de prueba:

| Flujo | Resultado |
|---|---|
| House Sauce: 96 OZ Mayo + 24 OZ Ketchup + 8 OZ Seasoning; rendimiento 128 OZ | Lote $18.40; costo/OZ $0.14375 |
| Chicken Sandwich con 0.5 OZ de House Sauce | Costo $2.341875; consumo de Mayo 0.375 OZ |
| Combo con Sandwich, Fries, Drink, Bag y 2 Napkins | Costo $3.441875; componentes finales agregados |
| Mismo lote de salsa expresado como 1 GAL; uso de 4 OZ | Costo $0.575; consumo de Mayo 3 OZ |

Se probaron creación, edición por `changes.components`, reglas prohibidas, caché con tipo incorrecto, ciclos, valores no finitos, unidades inválidas, versiones, lectura legacy sin escritura, conservación de campos deprecados, Sales/snapshots, Food Cost, producción e idempotencia. Las ventas no deducen inventario.

Las pruebas con DOM simulado verifican carga de Recipes y Builder, creación desde el formulario, errores visibles y preview con conversión. **No equivalen a una verificación visual o de interacción en navegador real**, que permanece pendiente en este entorno.

## 8. Sample data

La jerarquía existente ya era válida y se conservó. Se quitaron los campos comerciales de las llamadas a `ensureRecipe` y se colocaron los targets en los Menu Items de ejemplo. No se agregaron recetas duplicadas ni se reescribieron snapshots de ventas existentes. La suite de Sales sigue cargando y calculando las recetas de ejemplo de los tres tipos.

## 9. Deuda técnica

- `UNIT-OZ` sigue sirviendo como alias histórico de onza fluida en conversiones con GAL/QT/FLOZ. Una futura distinción estricta entre masa y volumen requiere revisar datos existentes; no se realizó esa migración.
- Los aliases históricos `costPerYieldBaseUnit` y `yieldBaseQuantity` de RecipeService mantienen su semántica anterior de unidad de rendimiento. Nuevos consumidores deben usar `unitCost`, `yieldQuantity` y `yieldUnitId`; Production calcula su costo real por unidad base de manera independiente a esos aliases.
- La validación de cambio de tipo consulta las referencias persistidas de Menu para impedir enlaces rotos; no administra esos registros.
- Los campos comerciales históricos se conservan como datos deprecados; no se transfieren automáticamente a Menu.
- Los warnings son datos de servicio; no se añadió una nueva interfaz para administrarlos.
- Production conserva sus escrituras separadas en localStorage; este paso no implementa transacciones atómicas de inventario.

## 10. Step 2

Recipe Builder 2.0 puede usar `getRecipeById`, `updateRecipe`, `calculateRecipePreview` y `getRecipeWarnings` para edición real, feedback de validación y control de inventario producido. Las páginas de Menu pueden exponer el target por producto y precio sugerido ya disponibles en MenuService. La limpieza de unidades ambiguas y cualquier rediseño visual requieren trabajo posterior explícito.
