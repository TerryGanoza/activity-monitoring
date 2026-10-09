# activity-monitoring
Control de actividades y bitacora de seguimiento de los TMs

Aplicación local para dar seguimiento a Team Members y proyectos. Está construida con Next.js y SQLite; el archivo de base de datos se crea automáticamente en `.data/bitacora.sqlite` y mantiene los cambios al reiniciar el servidor. La carpeta `.data/` está excluida de Git.

## Iniciar manualmente en desarrollo (Windows)

Abre la carpeta del proyecto en VS Code y, en una terminal de PowerShell, ejecuta desde la raíz:

```powershell
npm.cmd run dev
```

Deja la terminal abierta mientras trabajas y visita [http://localhost:3000](http://localhost:3000). 
Para trabajar de forma externa entra a http://192.168.18.24:3000.
Para detener el servidor, pulsa `Ctrl+C`. La próxima vez que quieras usar la aplicación, vuelve a ejecutar el comando. Si todavía no has instalado las dependencias, ejecuta primero `npm.cmd install`.

Requisitos: Node.js 22.13 o posterior y npm.

El primer inicio crea una cuenta local de demostración:

- Correo: `admin@bcp.local`
- Contraseña: `BcpLocal2026!`

Los datos iniciales de equipo, proyectos y bitácora también se crean una sola vez. En Proyectos, selecciona una tarjeta para abrir el detalle y usa el lápiz para editar su configuración. Cada proyecto permite crear requerimientos y registrar su avance diario.

La plantilla conserva el requerimiento/API, su alcance, el TM responsable, el QE, el tipo de OCD, el estado, la fecha de inicio opcional, el deadline opcional y la hora de pase. Las fechas de inicio y deadline se pueden dejar vacías; se muestran como «Sin fecha». El selector ofrece dos tipos OCD: «OCD Normal» (Abierto, Desarrollo, Congelamiento, Reversión, Recongelamiento, Gestión de pase, Done y Bloqueado) y «Deploy Go» (Abierto, Desarrollo, Congelamiento, Gestión de pase, Done y Bloqueado). «Abierto» es el estado inicial antes de Desarrollo. La interfaz y la API aplican las opciones correspondientes, y los estados guardados con las etiquetas anteriores se adaptan al abrir el espacio sin eliminar registros. Las pruebas funcionales, de performance, OWASP y ethical hacking se agrupan como validaciones. El proyecto y el rol del TM se muestran desde sus perfiles para no repetir columnas; las observaciones quedan en la bitácora diaria y la columna «Último avance» se calcula con la fecha más reciente. La fecha de alta se registra automáticamente. Los perfiles de Team Members también conservan sus propios seguimientos diarios.

En el módulo Proyectos, el botón de papelera permite eliminar un proyecto tras confirmar. Sus requerimientos y los avances diarios asociados también se eliminan.

Los requerimientos pueden reasignarse a otro proyecto desde su formulario de edición. Sus registros de bitácora se conservan y el avance de ambos proyectos se recalcula al guardar.

El avance general del proyecto se calcula automáticamente: cada requerimiento en curso cuenta como 50%, cada requerimiento en Done como 100% y los requerimientos en Abierto o Bloqueado como 0%. El porcentaje es 0% si el proyecto aún no tiene requerimientos y no se puede editar manualmente.

En Team Members, los roles disponibles son Backend Engineer y Quality Engineer; los perfiles nuevos usan Backend Engineer e Ingeniería por defecto. El proyecto asignado se elige de los proyectos existentes. El avance del miembro se calcula con sus requerimientos asignados usando la misma ponderación (Abierto y Bloqueado 0%, en curso 50%, Done 100%) y se actualiza cuando cambian sus requerimientos. Los seguimientos individuales se pueden eliminar desde la bitácora con confirmación.

Para definir otra cuenta antes de la primera ejecución, configura `BCP_ADMIN_EMAIL` y `BCP_ADMIN_PASSWORD`. La cuenta y la contraseña se crean una sola vez en la base de datos; cambiar las variables no restablece una cuenta ya creada.

## Configuración de producción

La contraseña de la cuenta inicial no está habilitada como valor predeterminado en producción. Antes de iniciar una instancia de producción, configura `BCP_ADMIN_EMAIL`, `BCP_ADMIN_PASSWORD` y `AUTH_SECRET` con valores propios y seguros. Para trabajar en varias instancias o equipos, migra la persistencia a una base de datos compartida; el archivo SQLite local está pensado para desarrollo en una sola máquina.

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm run lint`: analiza el código.
- `npm run build`: comprueba y crea la versión de producción.
