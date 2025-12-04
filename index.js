import express from "express"; //libreria para uso de servidor
import expressSession from "express-session"; //libreria para sesion de usuario
import bodyparser from "body-parser" //middleware para tomar variables desde EJS en js
import pg from "pg"; //libreria para pdAdmin postgres
import bcrypt from "bcrypt"; //libreria para comparación de contraseñas
import {createPDF} from './reportePDF.js'; //funcion createPDF importada de reportePDF.js
import { transporter, mailOptions } from "./envioEmail.js";//funciones transporter y mailOptions importadas de envioEmail.js
import dotenv from 'dotenv'; //libreria para uso de archivo .env (variables de entorono para configuraciones)
import sharp from "sharp"; //libreria para procesamiento de imagenes de firmas
import multer from "multer"; //middleware para manejar la subida de imagen a la base de datos
import path from "path"; //libreria para manejar rutas de archivos
import fs from "fs"; //libreria para sistema de archivos

// Cargar configuración según el entorno
const configPath = process.env.NODE_ENV === 'production' ? './config.env' : './config.env.local';
dotenv.config({ path: configPath }); //asignamos path para dotenv de configuraciones para emailHost y contraseñas

const app= express(); //declaramos nuestro servidor como variable app
const port=3000; //asignamos nuestro puerto para ser el 3000

app.use(expressSession({
  secret: process.env.SESSION_SECRET || 'mi-secreto-temporal-cambiar',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000, //24 hrs
    httpOnly: true, // Previene acceso desde JavaScript
    secure: false // Cambiar a true si usas HTTPS
  }
}));

const transportador =transporter(); //funcion traida desde ./envioEmail.js y programada con loss datos del host, puerto etc del servicio email transportador

// Configuración de multer para guardar archivos (fotos/videos) en disco
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Crear carpeta específica para cada orden: public/uploads/ordenes/{folio}/
        const folio = req.body.folio || 'temp';
        const uploadPath = path.join('public', 'uploads', 'ordenes', folio.toString());

        // Crear directorio si no existe
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Nombre único: timestamp + nombre original
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const nombreSinExt = path.basename(file.originalname, ext);
        cb(null, nombreSinExt + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB máximo
    fileFilter: function (req, file, cb) {
        // Aceptar solo imágenes y videos
        const tiposPermitidos = /jpeg|jpg|png|gif|mp4|mov|avi|webm/;
        const extname = tiposPermitidos.test(path.extname(file.originalname).toLowerCase());
        const mimetype = tiposPermitidos.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen (jpg, png, gif) o video (mp4, mov, avi, webm)'));
        }
    }
});

var fecha= new Date(); 
fecha=fecha.toLocaleDateString("es-MX");//fecha usada para la creacion de orden y cierre de orden por técnico

//variables asignadas con datos del servicio email en archivo config.env
const dbHost = process.env.DB_Host; 
const dbUsuario = process.env.DB_Usuario;
const dbContraseña = process.env.DB_Password;
const dbNombre = process.env.DB_Nombre;
const dbPuerto= process.env.DB_Puerto;

//inicializo mi base de datos como db obteniendo los valores del archivo config.env
const db= new pg.Client({ 
    user:dbUsuario,
    database: dbNombre,
    password: dbContraseña,
    host: dbHost,
    port: dbPuerto,
});

//conectando base de datos
db.connect((err)=>{
    if(err){
        console.log("no fue posible connectarse a la base de datos" + err);
    } else{
        console.log("conexion a base de datos exitosa");
    }
})

app.use(express.json({ limit: '10mb' }));//parseando las imagenes para usar con req.body, definiendo max peso de 10mb
app.use(express.urlencoded({extended:true}));//parseando el cuerpo de solicitudes HTTP extendido(true) a arrays y anidados para usar req.body
app.use(express.static('public')); //usando express.static para nuestra carpeta public para usar sus archivos sin definir las rutas en cada http request

// Middleware de seguridad: evita caché solo cuando NO hay sesión activa
app.use((req, res, next) => {
  // Si NO hay sesión autenticada, aplicar no-cache
  if (!req.session.isAuthenticated) {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', 0);
  }
  // Si hay sesión, permitir navegación normal con "atrás"
  next();
});

app.get("/", (req, res)=>{ //pagina de inicio sesion
    const error = req.session.error; //mensaje de error en nuestro index.ejs con un if damos instruccion en caso de que exista esta variable (con valor asignado en http.post(/entrar) )
    req.session.error = null; // Limpiar el mensaje de error
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', 0);
    res.render("index.ejs", { error });
});

app.post("/entrar", (req, res) =>{ //boton ingresar a sesion (de index.ejs) 
    let usuario= req.body.usuarioId;
    let contraseña= req.body.contraseñaId;
    if(!usuario || !contraseña){
         req.session.error = 'No llenaste un campo';
        res.redirect("/");
    }else{
    db.query('SELECT * FROM usuarios WHERE username=$1', [usuario], (err, result) =>{
        if (err){
            console.log(err);
            res.redirect("/");
        }else if (result.rows.length === 0) {
            console.log('Usuario no encontrado');
            req.session.error = 'Usuario no encontrado';
            res.redirect("/");
        }else{
            let pass= result.rows[0].password;
            let role= result.rows[0].role;
            bcrypt.compare(contraseña, pass, (err, correcto) => {
                if (err) {
                    console.log(err);
                     req.session.error = 'Error al autenticar';
                    res.redirect("/");
                } else if (!correcto) {
                    console.log("Contraseña incorrecta");
                    req.session.error = "Contraseña incorrecta";
                     res.redirect("/");
                } else {
                    // Guardar usuario y role en la sesión
                    req.session.user = usuario;
                    req.session.userId = result.rows[0].id;
                    req.session.role = role;
                    req.session.isAuthenticated = true;

                    if (role==1){
                        res.render("menuAdmin.ejs", {});
                    }else if(role==2){
                        const userId = result.rows[0].id;
                        // Órdenes abiertas asignadas al técnico
                        db.query(`SELECT s.id, TO_CHAR(s.create_at, 'DD-MM-YYYY') AS create_at, estado, nombre
                            FROM ordenes_servicio s
                            INNER JOIN clientes c ON c.id=s.id_cliente
                            WHERE s.estado='Abierto' AND s.id_usu_tecnico=$1
                            ORDER BY s.id DESC`, [userId], (err, abiertas) =>{
                            if(err){
                                console.log("Error órdenes abiertas: " + err.stack);
                                return res.redirect("/");
                            }
                            // Órdenes completadas del técnico
                            db.query(`SELECT s.id, TO_CHAR(s.create_at, 'DD-MM-YYYY') AS create_at,
                                TO_CHAR(s.fecha_servicio, 'DD-MM-YYYY') AS fecha_servicio, estado, nombre
                                FROM ordenes_servicio s
                                INNER JOIN clientes c ON c.id=s.id_cliente
                                WHERE s.estado='completada' AND s.id_usu_tecnico=$1
                                ORDER BY s.id DESC`, [userId], (err, completadas) =>{
                                if(err){
                                    console.log("Error órdenes completadas: " + err.stack);
                                    return res.redirect("/");
                                }
                                res.render("historialPendientes.ejs", {
                                    usuario: usuario,
                                    historialAbiertas: abiertas.rows,
                                    historialCompletadas: completadas.rows,
                                    totalAbiertas: abiertas.rows.length,
                                    totalCompletadas: completadas.rows.length
                                });
                            });
                        });
                    }
                }
            });
            }
          
        });
        }
    });

app.all("/crearUsuario", (req, res) =>{ //app.all para aceptar post de boton en /entrar y redirect app.get en /nuevoUsuario para error de "username ya existe"
     if (!req.session.user || req.session.role !== 1) {
    req.session.error = 'No tienes permisos';
    return res.redirect("/");
  }
    const error = req.session.error;
    req.session.error = null; // Limpiar el mensaje de error
    res.render('crearUsuario.ejs', { error });
});

app.post("/nuevoUsuario", (req, res) =>{
      if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let hoy=fecha;
    let nuevoUsuarioEs= req.body.nuevoUsuario;
    let nuevaContraseñaEs= req.body.nuevaContraseña;
    let correo= req.body.correo;
    let nombre= req.body.nombre;
    let apellido= req.body.apellido;
    let boolean="true";
    let role= req.body.role;
    console.log(role);

    bcrypt.hash(nuevaContraseñaEs, 10, (err, hashedPassword) => { //cifrando contraseña introducida
        if (err) {
            console.log("hubo un error " + err.stack);
            res.status(500).send("Error creating user");
            return;
        }else{
    db.query('INSERT INTO usuarios (username, firstname, lastname, password, email, enabled, createat, role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [nuevoUsuarioEs, nombre, apellido, hashedPassword, correo, boolean, hoy, role ],
        (err, result) =>{ 
            if(err){
                console.log("hubo un error "+ err.stack);  
                if (err.code === '23505' && err.constraint === 'usuarios_username_key') {
                req.session.error = 'El nombre de usuario ya existe';
                 res.redirect('/crearUsuario'); 
            }
        }else {
                db.query('SELECT id, role FROM usuarios WHERE username=$1',
                 [nuevoUsuarioEs],
                 (err, result) =>{ 
                        if(err){
                    console.log("hubo un error "+ err.stack);  
                 }else{
                    console.log(result.rows);
                    let usuarioId= result.rows[0].id;
                    console.log(usuarioId);
                    let roleId= result.rows[0].role;
                    console.log(roleId);
                    

                    db.query('INSERT into usuarios_roles (usuario_id, role_id) VALUES ($1, $2)',
                 [usuarioId,roleId ],
                 (err, result) =>{ 
                        if(err){
                    console.log("hubo un error "+ err.stack);  
                 }else{  
                    console.log("usuario creado en base de datos");
                     res.render("menuAdmin.ejs");
                  }
              });                 
                  }
              });  
            }
        });
        }
    });
});

app.all("/historial", (req, res) =>{ //boton historial completo (de menuAdmin.ejs) para ir a historialCompleto.ejs - acepta GET y POST
     if (!req.session.user || req.session.role !== 1) {
    req.session.error = 'No tienes permisos';
    return res.redirect("/");
  }
db.query("SELECT s.id,  TO_CHAR(s.create_at, 'DD-MM-YYYY') AS create_at, id_cliente, estado, nombre FROM public.ordenes_servicio s INNER JOIN clientes c ON (c.id=s.id_cliente) ORDER BY s.Id DESC", (err, result) =>{
            if(err){
                console.log("hubo un error "+ err.stack);
            }else{
                let miArray=result.rows;
                const total=miArray.length;
                res.render("historialCompleto.ejs", {
                    historial:miArray,
                    totalFilas: total
                });
            }
        });


});

app.post("/filtrado", (req, res) => { //boton filtro en /historial historialCompleto.ejs para folioFiltrado.ejs
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let nuevoFiltro = req.body.filtro;
    db.query("SELECT s.id, TO_CHAR(s.create_at, 'DD-MM-YYYY') AS create_at, id_cliente, estado, nombre FROM public.ordenes_servicio s INNER JOIN clientes c ON (c.id=s.id_cliente) WHERE c.nombre ILIKE $1 OR s.estado ILIKE $1 OR s.id::text ILIKE $1", [`%${nuevoFiltro}%`], (err, result) => {
        if (err) {
            console.log("Hubo un error EN PRIMERA INSTANCIA " + err.stack);
        } else if (result.rows.length === 0) {
            console.log("No se encontraron resultados para el filtro");
            let noEncontrado=1;
            db.query("SELECT s.id, TO_CHAR(s.create_at, 'DD-MM-YYYY') AS create_at, id_cliente, estado, nombre FROM public.ordenes_servicio s INNER JOIN clientes c ON (c.id=s.id_cliente)", (err, result) =>{
                if(err){
                    console.log("hubo un error "+ err.stack);  
                }else{
                    let miArray=result.rows;
                    const total=miArray.length;
                    res.render("historialCompleto.ejs", {
                        historial:miArray,
                        totalFilas: total,
                        notFound:noEncontrado
                    });
                }
            });    
        } else {
            let miArray = result.rows;
            res.render("folioFiltrado.ejs", {
                historial: miArray,
                filtro: nuevoFiltro
            });
        }
    });
});

// Vista de detalle de orden (historial inmutable + archivos)
app.get("/orden/:id", (req, res) => {
    if (!req.session.user) {
        req.session.error = 'No estás autenticado';
        return res.redirect("/");
    }

    const ordenId = req.params.id;

    // Query para traer TODOS los datos de la orden con snapshot inmutable
    db.query(`
        SELECT
            o.id as folio,
            TO_CHAR(o.create_at, 'DD-MM-YYYY') AS fecha_creacion,
            TO_CHAR(o.fecha_servicio, 'DD-MM-YYYY') AS fecha_servicio,
            o.estado,
            o.cliente_nombre,
            o.cliente_email,
            o.cliente_rfc,
            o.cliente_telefono,
            o.descripcion_falla,
            o.trabajo_realizado,
            o.comentarios,
            o.modelo,
            o.serie,
            o.volts,
            o.amperes,
            o.watts,
            o.presion_agua,
            o.modified_at,
            o.modified_fields,
            te.nombre as nombre_tipo_equipo,
            m.nombre as nombre_marca
        FROM ordenes_servicio o
        LEFT JOIN tipos_equipo te ON o.id_tipo_equipo = te.id
        LEFT JOIN marcas m ON o.id_marca = m.id
        WHERE o.id = $1
    `, [ordenId], (err, ordenResult) => {
        if (err) {
            console.log("Error al obtener orden: " + err.stack);
            return res.redirect("/historial");
        }

        if (ordenResult.rows.length === 0) {
            console.log("Orden no encontrada");
            return res.redirect("/historial");
        }

        const orden = ordenResult.rows[0];

        // Query para traer archivos (fotos/videos)
        db.query(`
            SELECT id, tipo, ruta, nombre_original, orden
            FROM ordenes_archivos
            WHERE id_orden_servicio = $1
            ORDER BY orden ASC
        `, [ordenId], (err, archivosResult) => {
            if (err) {
                console.log("Error al obtener archivos: " + err.stack);
            }

            const archivos = archivosResult ? archivosResult.rows : [];
            const fotos = archivos.filter(a => a.tipo === 'foto');
            const videos = archivos.filter(a => a.tipo === 'video');

            // Query para traer tipos de servicio
            db.query(`
                SELECT ts.nombre as tipo_servicio
                FROM ordenes_servicio_tipos_servicio osts
                JOIN tipos_servicio ts ON osts.id_tipo_servicio = ts.id
                WHERE osts.id_orden_servicio = $1
            `, [ordenId], (err, tiposServicioResult) => {
                if (err) {
                    console.log("Error al obtener tipos de servicio: " + err.stack);
                }

                const tiposServicio = tiposServicioResult ? tiposServicioResult.rows : [];

                // Query para traer piezas dañadas
                db.query(`
                    SELECT no_parte, cantidad, descripcion
                    FROM piezas_danadas
                    WHERE id_orden_servicio = $1
                `, [ordenId], (err, piezasResult) => {
                    if (err) {
                        console.log("Error al obtener piezas: " + err.stack);
                    }

                    const piezas = piezasResult ? piezasResult.rows : [];

                    // Renderizar vista de detalle
                    res.render("ordenDetalle.ejs", {
                        orden: orden,
                        fotos: fotos,
                        videos: videos,
                        tiposServicio: tiposServicio,
                        piezas: piezas,
                        userRole: req.session.role  // 1=admin, 2=tecnico
                    });
                });
            });
        });
    });
});

app.all("/crearHabitual", (req, res)=>{ //boton crear orden con cliente habitual en menuAdmin.ejs para clienteHabitual.ejs
     if (!req.session.user || req.session.role !== 1) {
    req.session.error = 'No tienes permisos';
    return res.redirect("/");
  }
    db.query("SELECT id, nombre, rfc, email FROM clientes", (err, result) =>{
        if(err){
            console.log("hubo un error "+ err.stack);  
        }else{
            let clientesList=result.rows;
            let clientesListSize= clientesList.length;
            res.render("clienteHabitual.ejs", {
                clientes:clientesList,
                size: clientesListSize
            });
        }
    }); 
});

app.post("/buscarCliente", (req, res) => { //boton filtro /buscarCliente en clienteHabitual.ejs
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let nombreEscrito = req.body.filtro[0];
    db.query(`SELECT id, nombre, rfc, email FROM clientes WHERE nombre ILIKE $1 OR rfc ILIKE $1 OR email ILIKE $1 OR trim(id::text) LIKE $1`, [`%${String(nombreEscrito)}%`], (err, result) => {
        if (err) {
            console.log("Hubo un error " + err.stack);
        } else if (result.rows.length === 0) {
            console.log("No se encontraron resultados para el filtro");
            let noEncontrado=1;
                db.query("SELECT id, nombre, rfc, email FROM clientes", (err, result) =>{
                    if(err){
                        console.log("hubo un error "+ err.stack);  
                    }else{
                        let clientesList=result.rows;
                        let clientesListSize= clientesList.length;
                        res.render("clienteHabitual.ejs", {
                            clientes:clientesList,
                            size: clientesListSize,
                            notFound:noEncontrado
                        });
                    }
                }); 
        } else {
            let miArray = result.rows;
            let size= miArray.length;
            res.render("nombreFiltrado.ejs", {
                cliente: miArray,
                filtro: nombreEscrito,
                size: size
            });
        }
    });
});

app.post("/usarCliente", (req, res)=>{ //boton para seleccionar cliente en clienteHabitual.ejs para clienteHabitualSelected.ejs
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let clienteSelected=req.body.clienteSelecButton;
    console.log("cliente selected es: ", clienteSelected); //es el id del cliente
    db.query("SELECT last_value + 1 AS mayor_folio FROM ordenes_servicio_id_seq", (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
        if(err){
            console.log("hubo un error "+ err.stack);
        }else{
            let nextFolio=result.rows[0].mayor_folio;

            db.query("SELECT s.id, id_cliente, calle_num_ext, colonia_localidad, codigo_postal, telefono, referencia_dir, ciudad, no_int, nombre, rfc, email FROM public.cliente_direccion s INNER JOIN clientes c ON (c.id=s.id_cliente) WHERE s.id_cliente=$1",[clienteSelected], (err, result) =>{ //seleccionar where id=id seleccionado de tablas clientes y cliente_direccion
            if(err){
                console.log("hubo un error "+ err.stack);
            }else{
                let arrayClienteSelected=result.rows;
                // Verificar si hay direcciones para este cliente
                if (arrayClienteSelected.length === 0) {
                    console.log("Cliente sin direcciones registradas");
                    req.session.error = 'Este cliente no tiene direcciones registradas. Por favor agregue una dirección primero.';
                    return res.redirect("/crearHabitual");
                }
                let direccion=result.rows[0].id; //id de direccion tabla cliente_direccion
                let sizeSelectedUno=arrayClienteSelected.length; //numero de direcciones

                // Obtener lista de técnicos
                db.query("SELECT id, username FROM usuarios WHERE role=2 ORDER BY username", (err, tecnicos) =>{
                    if(err){
                        console.log("Error obteniendo técnicos: "+ err.stack);
                        return res.redirect("/");
                    }
                    res.render("clienteHabitualSelected.ejs", {
                        hoy: fecha,
                        nuevoFolio:nextFolio,
                        nuevoCliente:clienteSelected,
                        arrayClienteSelected:arrayClienteSelected,
                        sizeSelectedUno:sizeSelectedUno,
                        direccion:direccion,
                        tecnicos: tecnicos.rows
                    });
                });
            }
          });
        }
    });
});

app.post("/agregarDireccion", (req, res) => { //agregar nueva dirección a cliente habitual (SIN modificar cliente)
    if (!req.session.user) {
        req.session.error = 'No estás autenticado';
        return res.redirect("/");
    }
    const { idCliente, calle, numeroInterior, Colonia, cPostal, telefono, ciudad, referencia } = req.body;

    // Solo insertar la nueva dirección (NO modifica datos del cliente)
    db.query(
        'INSERT INTO cliente_direccion (id_cliente, calle_num_ext, no_int, colonia_localidad, codigo_postal, telefono, ciudad, referencia_dir) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [idCliente, calle, numeroInterior, Colonia, cPostal, telefono, ciudad, referencia],
        (err) => {
            if (err) {
                console.log("Error al agregar dirección: " + err.stack);
                return res.redirect("/crearHabitual");
            }
            // Redirigir de vuelta con el cliente seleccionado
            res.send(`
                <form id="autoForm" action="/usarCliente" method="post">
                    <input type="hidden" name="clienteSelecButton" value="${idCliente}">
                </form>
                <script>document.getElementById('autoForm').submit();</script>
            `);
        }
    );
});

app.post("/direccionSele", (req, res)=>{ //boton para seleccionar cliente en clienteHabitual.ejs para clienteHabitualSelected.ejs
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let opcionPresionada = req.body.opcionPresionada;
    let clienteSelecButton=req.body.botonMaster; //id de direccion cliente
    console.log("direccion a buscar es: ",clienteSelecButton); //id de direccion cliente
    let nuevoCliente=req.body.nuevoCliente;
    console.log("cliente seleccionado es: ",nuevoCliente); //id de cliente
    db.query("SELECT last_value + 1 AS mayor_folio FROM ordenes_servicio_id_seq", (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
        if(err){
            console.log("hubo un error "+ err.stack);
        }else{
            let nextFolio=result.rows[0].mayor_folio;
             db.query("SELECT s.id, id_cliente, calle_num_ext, colonia_localidad, codigo_postal, telefono, referencia_dir, ciudad, no_int, nombre, rfc, email FROM public.cliente_direccion s INNER JOIN clientes c ON (c.id=s.id_cliente) WHERE s.id_cliente=$1",[nuevoCliente], (err, result) =>{ //seleccionar where id=id seleccionado de tablas clientes y cliente_direccion
            if(err){
                console.log("hubo un error "+ err.stack);
            }else{
                let arrayClienteSelected=result.rows;
                let direccion=result.rows[0].id; //id de direccion tabla cliente_direccion
                let sizeSelectedUno=arrayClienteSelected.length; //numero de direcciones
                let arrayClienteSelectedFinal=result.rows[opcionPresionada];

                // Obtener lista de técnicos
                db.query("SELECT id, username FROM usuarios WHERE role=2 ORDER BY username", (err, tecnicos) =>{
                    if(err){
                        console.log("Error obteniendo técnicos: "+ err.stack);
                        return res.redirect("/");
                    }
                    res.render("direccionSele.ejs", {
                        hoy: fecha,
                        nuevoFolio:nextFolio,
                        nuevoCliente:nuevoCliente,
                        arrayClienteSelected:arrayClienteSelected,
                        arrayClienteSelectedFinal:arrayClienteSelectedFinal,
                        sizeSelectedUno:sizeSelectedUno,
                        direccion:direccion,
                        tecnicos: tecnicos.rows
                    });
                });
            }
          });
        }
    });  
});

app.post("/guardarOrdenHabitual", (req, res) =>{ //boton guardar orden de clienteHabitualSelected.ejs
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let fecha= req.body.fecha;
    let esteFolio= req.body.nuevoFolio;
    esteFolio=parseInt(esteFolio);
    let estado= req.body.estado;
    let tecnicoAsignado= req.body.tecnicoAsignado;
    let cliente= req.body.idCliente;
    let nombreCliente= req.body.nombreCliente;
    let correo= req.body.correo;
    let rfc= req.body.rfc;
    let telefono= req.body.telefono;

    // Campos técnicos opcionales
    let checkSelected = req.body.checkBox || [];
    let id_tipo_equipo = req.body.tipo || null;
    let id_marca = req.body.marca || null;
    let modelo = req.body.modelo || null;
    let serie = req.body.serie || null;
    let volts = req.body.voltaje || null;
    let amperes = req.body.amperaje || null;
    let watts = req.body.watts || null;
    let presion_agua = req.body.presion || null;
    let descripcion_falla = req.body.fallaReportada || null;

    console.log("Nuevo folio es "+esteFolio);
    console.log("📸 SNAPSHOT:", { nombreCliente, correo, rfc, telefono });

    // Crear snapshot de datos iniciales del admin
    const snapshotAdmin = JSON.stringify({
        tipos_servicio: checkSelected,
        id_tipo_equipo, id_marca, modelo, serie,
        volts, amperes, watts, presion_agua,
        descripcion_falla
    });

    // Insertar orden con campos técnicos opcionales + snapshot
    db.query(`INSERT INTO ordenes_servicio (id_cliente, estado, cliente_nombre, cliente_email, cliente_rfc, cliente_telefono, id_usu_tecnico, id_tipo_equipo, id_marca, modelo, serie, volts, amperes, watts, presion_agua, descripcion_falla, datos_iniciales_admin) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
        [cliente, estado, nombreCliente, correo, rfc, telefono, tecnicoAsignado, id_tipo_equipo, id_marca, modelo, serie, volts, amperes, watts, presion_agua, descripcion_falla, snapshotAdmin],
        (err, resultOrden) =>{
            if(err){
                console.log("hubo un error "+ err.stack);
                return res.status(500).send("Error al crear orden");
            }
            const ordenId = resultOrden.rows[0].id;
            console.log("Listo db ordenes_servicio con snapshot! ID:", ordenId);

            // Insertar tipos de servicio si se seleccionaron
            if (checkSelected.length > 0) {
                let insertCount = 0;
                checkSelected.forEach(tipoServicio => {
                    db.query(`INSERT INTO ordenes_servicio_tipos_servicio (id_orden_servicio, id_tipo_servicio) VALUES ($1, $2)`,
                        [ordenId, tipoServicio],
                        (err) => {
                            if(err) console.log("Error tipos servicio:", err.message);
                            insertCount++;
                            if (insertCount === checkSelected.length) {
                                res.render("menuAdmin.ejs", {});
                            }
                        }
                    );
                });
            } else {
                res.render("menuAdmin.ejs", {});
            }
        }
    );
});

app.post("/crear", (req, res) =>{ //boton crear orden con nuevo cliente (de menuAdmin.ejs)
     if (!req.session.user || req.session.role !== 1) {
    req.session.error = 'No tienes permisos';
    return res.redirect("/");
  }
    db.query("SELECT last_value + 1 AS mayor_folio FROM ordenes_servicio_id_seq", (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
        if(err){
            console.log("hubo un error "+ err.stack);
        }else{
            let nextFolio=result.rows[0].mayor_folio;
            // Obtener lista de técnicos
            db.query("SELECT id, username FROM usuarios WHERE role=2 ORDER BY username", (err, result) =>{
                if(err){
                    console.log("Error obteniendo técnicos: "+ err.stack);
                    return res.redirect("/");
                }
                res.render("pagina1.ejs", {
                    hoy: fecha,
                    nuevoFolio:nextFolio,
                    tecnicos: result.rows
                });
            });
        }
    });
});

app.post("/guardarOrden", (req, res) =>{ //boton guardar orden de cliente nuevo (de pagina1.ejs) para enviar datos a tablas: clientes, ordenes_servicio, cliente_direccion
    if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let nombreCliente= req.body.nombreCliente;
    let correo= req.body.correo;
    let rfc= req.body.rfc;
    let calle= req.body.calle;
    let numeroInterior= req.body.numeroInterior;
    let colonia= req.body.colonia;
    let cPostal= req.body.cPostal;
    let telefono= req.body.telefono;
    let ciudad= req.body.ciudad;
    let referencia= req.body.referenciaDireccion;
    let fecha= req.body.fecha;
    let esteFolio= req.body.nuevoFolio;
    esteFolio=parseInt(esteFolio);
    let estado= req.body.estado;
    let tecnicoAsignado= req.body.tecnicoAsignado;

    // Campos técnicos opcionales
    let checkSelected = req.body.checkBox || [];
    let id_tipo_equipo = req.body.tipo || null;
    let id_marca = req.body.marca || null;
    let modelo = req.body.modelo || null;
    let serie = req.body.serie || null;
    let volts = req.body.voltaje || null;
    let amperes = req.body.amperaje || null;
    let watts = req.body.watts || null;
    let presion_agua = req.body.presion || null;
    let descripcion_falla = req.body.fallaReportada || null;

    // Crear snapshot de datos iniciales del admin
    const snapshotAdmin = JSON.stringify({
        tipos_servicio: checkSelected,
        id_tipo_equipo, id_marca, modelo, serie,
        volts, amperes, watts, presion_agua,
        descripcion_falla
    });

    // PASO 1: Insertar cliente y obtener el ID real generado
    db.query(`INSERT INTO clientes (nombre, rfc, email) VALUES ($1, $2, $3) RETURNING id`,
        [nombreCliente, rfc, correo],
        (err, resultCliente) =>{
            if(err){
                console.log("hubo un error "+ err.stack);
                return res.status(500).send("Error al crear cliente");
            }

            const nuevoIdCliente = resultCliente.rows[0].id;
            console.log("Listo db clientes! ID:", nuevoIdCliente);

            // PASO 2: Insertar orden con campos técnicos opcionales + snapshot
            db.query(`INSERT INTO ordenes_servicio (id_cliente, fecha_servicio, estado, cliente_nombre, cliente_email, cliente_rfc, cliente_telefono, id_usu_tecnico, id_tipo_equipo, id_marca, modelo, serie, volts, amperes, watts, presion_agua, descripcion_falla, datos_iniciales_admin) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
                [nuevoIdCliente, fecha, estado, nombreCliente, correo, rfc, telefono, tecnicoAsignado, id_tipo_equipo, id_marca, modelo, serie, volts, amperes, watts, presion_agua, descripcion_falla, snapshotAdmin],
                (err, resultOrden) =>{
                    if(err){
                        console.log("hubo un error "+ err.stack);
                        return res.status(500).send("Error al crear orden");
                    }
                    const ordenId = resultOrden.rows[0].id;
                    console.log("Listo db ordenes_servicio! ID:", ordenId);

                    // PASO 3: Insertar dirección del cliente
                    db.query(`INSERT INTO cliente_direccion (id_cliente, calle_num_ext, colonia_localidad, codigo_postal, telefono, referencia_dir, ciudad, no_int) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [nuevoIdCliente, calle, colonia, cPostal, telefono, referencia, ciudad, numeroInterior],
                        (err, result) =>{
                            if(err){
                                console.log("hubo un error "+ err.stack);
                                return res.status(500).send("Error al crear dirección");
                            }
                            console.log("Listo db cliente_direccion!");

                            // PASO 4: Insertar tipos de servicio si se seleccionaron
                            if (checkSelected.length > 0) {
                                let insertCount = 0;
                                checkSelected.forEach(tipoServicio => {
                                    db.query(`INSERT INTO ordenes_servicio_tipos_servicio (id_orden_servicio, id_tipo_servicio) VALUES ($1, $2)`,
                                        [ordenId, tipoServicio],
                                        (err) => {
                                            if(err) console.log("Error tipos servicio:", err.message);
                                            insertCount++;
                                            if (insertCount === checkSelected.length) {
                                                res.render("menuAdmin.ejs", {});
                                            }
                                        }
                                    );
                                });
                            } else {
                                res.render("menuAdmin.ejs", {});
                            }
                        }
                    );
                }
            );
        }
    );
});

app.post("/seguimiento", (req, res) =>{ //Boton para seleccionar orden en sesion tecnico
     if (!req.session.user || req.session.role !== 2) {
    req.session.error = 'No tienes permisos';
    return res.redirect("/");
  }
    let usuario=req.body.usuario;
    let clienteSeleccionado= JSON.parse(req.body.seguimiento);
    const ordenId = clienteSeleccionado.id;

    console.log("🔍 /seguimiento - Cliente seleccionado:", clienteSeleccionado);
    console.log("🔍 /seguimiento - ID Cliente:", clienteSeleccionado.id_cliente);

    // Cargar datos de la orden
    db.query("SELECT * FROM ordenes_servicio WHERE id=$1", [ordenId], (err, ordenResult)=>{
        if(err){
            console.log("Error obteniendo orden:", err.stack);
            return res.redirect("/");
        }
        const orden = ordenResult.rows[0];

        // Cargar tipos de servicio seleccionados para esta orden
        db.query("SELECT id_tipo_servicio FROM ordenes_servicio_tipos_servicio WHERE id_orden_servicio=$1", [ordenId], (err, tiposResult)=>{
            if(err) console.log("Error tipos servicio:", err.message);

            const tiposSeleccionados = tiposResult ? tiposResult.rows.map(t => t.id_tipo_servicio) : [];

            console.log("✅ Pasando a pagina2 - ID Cliente:", orden.id_cliente);

            res.render("pagina2.ejs",{
                usuario: usuario,
                folio: ordenId,
                clienteActual: clienteSeleccionado.nombre,
                idCliente: orden.id_cliente,  // ← Usar id_cliente de la BD, no del JSON
                create_at: clienteSeleccionado.create_at,
                orden: orden,
                tiposSeleccionados: tiposSeleccionados
            });
        });
    });
});

app.post("/verCambios", (req, res)=>{ // Ver comparación datos admin vs técnico
     if (!req.session.user || req.session.role !== 1) {
    req.session.error = 'No tienes permisos';
    return res.redirect("/");
  }
    const ordenId = req.body.ordenId;
    console.log("🔍 Ver cambios - Orden ID:", ordenId);

    // Cargar orden actual con todos los datos
    db.query("SELECT *, id as folio FROM ordenes_servicio WHERE id=$1", [ordenId], (err, ordenResult)=>{
        if(err){
            console.log("Error obteniendo orden:", err.stack);
            return res.redirect("/historial");
        }
        const orden = ordenResult.rows[0];
        console.log("✅ Orden encontrada:", ordenId);

        // Cargar tipos de servicio actuales
        db.query("SELECT id_tipo_servicio FROM ordenes_servicio_tipos_servicio WHERE id_orden_servicio=$1", [ordenId], (err, tiposResult)=>{
            if(err) console.log("Error tipos servicio:", err.message);

            const tiposActuales = tiposResult ? tiposResult.rows.map(t => t.id_tipo_servicio) : [];

            // Parsear datos iniciales del admin
            const datosIniciales = orden.datos_iniciales_admin ? JSON.parse(orden.datos_iniciales_admin) : null;

            console.log("📊 Datos iniciales:", datosIniciales);
            console.log("📊 Tipos actuales:", tiposActuales);
            console.log("🎨 Renderizando comparacionCambios.ejs");

            res.render("comparacionCambios.ejs",{
                orden: orden,
                datosIniciales: datosIniciales,
                tiposActuales: tiposActuales
            });
        });
    });
});

app.post("/pagina3", (req, res)=>{ //boton en pagina2.ejs para ir a pagina 3  
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let create_at= req.body.create_at;
    let idCliente=req.body.idCliente;
    let clienteActual= req.body.clienteActual;
    let folio=req.body.folio;

    console.log("🔍 /pagina3 - ID Cliente:", idCliente, "| Folio:", folio, "| Cliente:", clienteActual);
    let checkSelected=req.body.checkBox;
    if (checkSelected== null) {
         checkSelected=["7"]; //si tecnico no selecciona check box en automatico se elgirá "otro" = 7
    } 
    let tipo=req.body.tipo;
    let marca=req.body.marca;
    let modelo=req.body.modelo;
    console.log(marca);
    let serie=req.body.serie;
    let voltaje=req.body.voltaje;
    let amperaje=req.body.amperaje;
    let watts=req.body.watts;
    let presion=req.body.presion;
    let encargado=req.body.encargado;
    let fallas=req.body.fallas;
    let descripcion=req.body.descripcion;

    // 🔥 GUARDADO INMEDIATO - Guardar datos del equipo ANTES de ir a pagina3
    console.log("💾 GUARDADO INTERMEDIO - Orden:", folio);

    // Primero eliminar tipos de servicio anteriores
    db.query(`DELETE FROM ordenes_servicio_tipos_servicio WHERE id_orden_servicio=$1`, [folio], (err) => {
        if(err) console.log("Error limpiando tipos servicio:", err.message);

        // Insertar nuevos tipos de servicio
        if (checkSelected && checkSelected.length > 0) {
            let insertCount = 0;
            checkSelected.forEach(tipo => {
                db.query(`INSERT INTO ordenes_servicio_tipos_servicio (id_orden_servicio, id_tipo_servicio) VALUES ($1, $2)`,
                    [folio, tipo],
                    (err) => {
                        if(err) console.log("Error guardando tipo servicio:", err.message);
                        insertCount++;
                        if (insertCount === checkSelected.length) {
                            console.log("✅ Tipos de servicio guardados");
                        }
                    }
                );
            });
        }
    });

    // Actualizar datos del equipo
    db.query(`UPDATE ordenes_servicio SET
        id_tipo_equipo=$1, id_marca=$2, modelo=$3, serie=$4,
        volts=$5, amperes=$6, watts=$7, presion_agua=$8, descripcion_falla=$9
        WHERE id=$10`,
        [tipo || null, marca || null, modelo || null, serie || null,
         voltaje || null, amperaje || null, watts || null, presion || null, fallas || null, folio],
        (err) => {
            if(err) {
                console.log("❌ ERROR CRÍTICO guardando equipo:", err.stack);
            } else {
                console.log("✅ Datos del equipo guardados");
            }
        }
    );

    res.render("pagina3.ejs", {
        create_at:create_at,
        idCliente:idCliente,
        clienteActual:clienteActual,
        folio:folio,
        checkSelectedo:checkSelected,
        tipo:tipo,
        marca:marca,
        modelo:modelo,
        serie:serie,
        voltaje:voltaje,
        amperaje:amperaje,
        watts:watts,
        presion:presion,
        encargado:encargado,
        fallas:fallas,
        descripcion:descripcion,
        folio:folio
    });
});

app.post("/enviarOrden", upload.array('archivos', 10), (req, res)=>{ // Permite hasta 10 archivos (fotos/videos)
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    // Los archivos ya están guardados en disco por multer
    const archivosSubidos = req.files || []; // Array de archivos subidos
    console.log(`📁 ${archivosSubidos.length} archivos subidos`);
    let create_at=req.body.create_at;
    let hoy=fecha.split('/').reverse().join('-');
    console.log("📅 Fecha:", hoy);
    let idCliente=req.body.idCliente;
    console.log("🔍 ID Cliente recibido:", idCliente, "| Tipo:", typeof idCliente);
    let clienteActual=req.body.clienteActual;
    console.log("👤 Cliente actual:", clienteActual);

    // Validación crítica
    if (!idCliente || idCliente === '' || idCliente === 'undefined') {
        console.log("❌ ERROR CRÍTICO: idCliente está vacío o undefined");
        console.log("📋 Todos los datos recibidos:", req.body);
        return res.status(400).send("Error: ID de cliente no proporcionado. Por favor, vuelve a seleccionar la orden desde el historial.");
    }
    let folio=req.body.folio;
    const checkSelectedA=req.body.checkSelectedo;
    let id_tipo_equipo=req.body.tipo=== "" ? null : req.body.tipo;
    let id_marca=req.body.marca=== "" ? null : req.body.marca;
    let modelo=req.body.modelo=== "" ? null : req.body.modelo;
    let serie=req.body.serie;
    let volts=req.body.voltaje=== "" ? null : req.body.voltaje;
    let amperes=req.body.amperaje=== "" ? null : req.body.amperaje;
    let watts=req.body.watts=== "" ? null : req.body.watts;
    let presion_agua=req.body.presion=== "" ? null : req.body.presion;
    let encargado=req.body.encargado;
    let descripcion_falla=req.body.fallas;
    let trabajo_realizado=req.body.descripcion;
    let comentarios=req.body.comentarios;
    let estado= "completada"; //completada o Abierto
    let sizeCheckbox=checkSelectedA.length;
     const partesUtilizadas = req.body.partesUtilizadas; 
     console.log(partesUtilizadas)
     let partesUtilizadasSize;
    if(partesUtilizadas===undefined){
    partesUtilizadasSize=0;
    }else{
    partesUtilizadasSize=partesUtilizadas.length;
    }
    console.log("🔥 GUARDADO FINAL - Orden:", folio);

    // Primero eliminar tipos de servicio anteriores (evita duplicados)
    db.query(`DELETE FROM ordenes_servicio_tipos_servicio WHERE id_orden_servicio=$1`, [folio], (err) => {
        if(err) console.log("Error limpiando tipos servicio:", err.message);

        // Insertar tipos de servicio Y esperar a que terminen
        let tiposInsertados = 0;
        const insertarTipos = () => {
            for(let i=0; i < sizeCheckbox; i++){
                db.query(`INSERT INTO ordenes_servicio_tipos_servicio (id_orden_servicio, id_tipo_servicio) VALUES ($1, $2)`,
                    [folio, checkSelectedA[i]],
                    (err) => {
                        if(err) console.log("Error tipos servicio:", err.stack);
                        else console.log("✅ Tipo servicio insertado:", checkSelectedA[i]);

                        tiposInsertados++;
                        if(tiposInsertados === sizeCheckbox) {
                            console.log("✅ TODOS los tipos de servicio guardados");
                            actualizarOrden();
                        }
                    }
                );
            }
        };

        if(sizeCheckbox > 0) {
            insertarTipos();
        } else {
            actualizarOrden();
        }
    });

    function actualizarOrden() {
        db.query(`UPDATE ordenes_servicio SET id_tipo_equipo=$1, id_marca=$2, modelo=$3, serie=$4, descripcion_falla=$5, volts=$6, amperes=$7, watts=$8,
            presion_agua=$9, trabajo_realizado=$10, comentarios=$11, fecha_servicio=$12, estado=$13, imagen=$14 WHERE id= $15`,
            [id_tipo_equipo,id_marca, modelo,serie, descripcion_falla,volts, amperes,watts, presion_agua,trabajo_realizado,comentarios,hoy, estado, null, folio ],
            (err, result) =>{ 
            if(err){
            console.log("hubo un error "+ err.stack);  
        }else{
            console.log("Listo db ordenes_servicio!");
        }

        // Guardar archivos (fotos/videos) en tabla ordenes_archivos
        if (archivosSubidos.length > 0) {
            console.log(`💾 Guardando ${archivosSubidos.length} archivos en BD...`);
            archivosSubidos.forEach((archivo, index) => {
                // Determinar tipo (foto o video)
                const esVideo = /\.(mp4|mov|avi|webm)$/i.test(archivo.filename);
                const tipo = esVideo ? 'video' : 'foto';

                // Ruta relativa desde public/
                const rutaRelativa = path.join('uploads', 'ordenes', folio.toString(), archivo.filename);

                db.query(
                    `INSERT INTO ordenes_archivos (id_orden_servicio, tipo, ruta, nombre_original, orden) VALUES ($1, $2, $3, $4, $5)`,
                    [folio, tipo, rutaRelativa, archivo.originalname, index + 1],
                    (err, result) => {
                        if (err) {
                            console.log("❌ Error al guardar archivo en BD: " + err.stack);
                        } else {
                            console.log(`✅ Archivo ${index + 1} guardado: ${archivo.originalname}`);
                        }
                    }
                );
            });
        } else {
            console.log("ℹ️ No se subieron archivos");
        }

        if(partesUtilizadasSize===0){
            console.log("Ninguna pieza dañanda");
             db.query(`INSERT INTO piezas_danadas (id_orden_servicio, no_parte, cantidad, descripcion) VALUES ($1, $2, $3, $4)`,
             [folio, null, null, null],
             (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
                    if(err){
                          console.log("hubo un error "+ err.stack);  
                       }else{
                         console.log("Listo db piezas_danadas!"); 
                    }
               });
        }else{
        for(let i=0; i < partesUtilizadasSize; i++){ //insertamos en base de datos todos los tipos de servicio seleccionados por el tecnico, pueden ser los 7 incluso
            db.query(`INSERT INTO piezas_danadas (id_orden_servicio, no_parte, cantidad, descripcion) VALUES ($1, $2, $3, $4)`,
             [folio, partesUtilizadas[i].numero, partesUtilizadas[i].repuesto, partesUtilizadas[i].descripcion],
             (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
                    if(err){
                          console.log("hubo un error "+ err.stack);  
                       }else{
                         console.log("Listo db piezas_danadas!"); 
                    }
               }); 
             }
        }    
       
        //query para tomar email de tabla clientes, telefono de tabla clientes_direccion, y datos de variables anteriores para creacion de pdf
        db.query("SELECT telefono, email FROM public.clientes s INNER JOIN cliente_direccion c ON (c.id_cliente=s.id) WHERE s.id=$1", [idCliente], (err, result) =>{
            if(err){
                console.log("hubo un error en ultimo request Join "+ err.stack);  
            }else{
                let numParteUsada=0;
                let repuestoParteUsada=0;
                let descripParteUsada=0;
                if(partesUtilizadas===undefined || partesUtilizadas===null || partesUtilizadas.length === 0){
                   numParteUsada=0;
                   repuestoParteUsada=0;
                   descripParteUsada=0;
             }else{
                 numParteUsada=partesUtilizadas[0].numero;
                 repuestoParteUsada=partesUtilizadas[0].repuesto;
                 descripParteUsada=partesUtilizadas[0].descripcion;
             }
             console.log("para pdf partes usadas hola3: ",numParteUsada, repuestoParteUsada, descripParteUsada);
                let telefono=result.rows[0].telefono;
                let email=result.rows[0].email;
                const mailOpciones=mailOptions(email);
                console.log("enviará a este email: ", email)

                // Rutas de firmas específicas de esta orden
                const firmaTecnicoPath = path.join('public', 'uploads', 'ordenes', folio.toString(), 'firma_tecnico.png');
                const firmaClientePath = path.join('public', 'uploads', 'ordenes', folio.toString(), 'firma_cliente.png');

                createPDF(create_at, hoy,folio, clienteActual, telefono, email, checkSelectedA,id_tipo_equipo, id_marca, modelo, encargado, descripcion_falla, trabajo_realizado, numParteUsada,repuestoParteUsada, descripParteUsada, null, firmaTecnicoPath, firmaClientePath);
                transportador.sendMail(mailOpciones, (error, info) => { //funciones importadas de envioEmails.js
                    if (error) {
                      return console.log(error);
                    }
                    console.log('Correo enviado: ' + info.response);
                  });        
                res.render("fin.ejs",{ });
        }
        });
    }); // Cierra db.query UPDATE ordenes_servicio
    } // Cierra function actualizarOrden
}); // Cierra app.post("/enviarOrden")

app.post('/guardar-firmas', (req, res) => { //metodo post enviado desde documento public/js/signature-pad.js que contiene las imagnes de las firmas
            const firmaTecnico = req.body.firmaTecnico;
            const firmaCliente = req.body.firmaCliente;
            const folio = req.body.folio; // Debe venir del frontend

            if (!folio) {
                return res.status(400).send('Folio requerido');
            }

            // Crear directorio para la orden si no existe
            const uploadPath = path.join('public', 'uploads', 'ordenes', folio.toString());
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }

            const tecnicoPath = path.join(uploadPath, 'firma_tecnico.png');
            const clientePath = path.join(uploadPath, 'firma_cliente.png');

            const bufferTecnico = Buffer.from(firmaTecnico.split(',')[1], 'base64');
            sharp(bufferTecnico)
                .toFormat("png")
                .toFile(tecnicoPath, (err, info) => {
                    if (err) {
                        console.log('Error guardando firma técnico:', err);
                    } else {
                        console.log('Firma técnico guardada en:', tecnicoPath);
                    }
                });

            const bufferCliente = Buffer.from(firmaCliente.split(',')[1], 'base64');
            sharp(bufferCliente)
                .toFormat('png')
                .toFile(clientePath, (err, info) => {
                    if (err) {
                        console.error('Error guardando firma cliente:', err);
                    } else {
                        console.log('Firma cliente guardada en:', clientePath);
                    }
                });

            // Guardar paths en base de datos
            const tecnicoPathDB = path.join('uploads', 'ordenes', folio.toString(), 'firma_tecnico.png');
            const clientePathDB = path.join('uploads', 'ordenes', folio.toString(), 'firma_cliente.png');

            db.query(
                `UPDATE ordenes_servicio
                 SET firma_tecnico_path = $1, firma_cliente_path = $2
                 WHERE id = $3`,
                [tecnicoPathDB, clientePathDB, folio],
                (err) => {
                    if (err) {
                        console.log('Error actualizando paths de firmas:', err.stack);
                    } else {
                        console.log('Paths de firmas guardados en BD');
                    }
                }
            );

            res.send('OK');
        });

// Regenerar PDF de una orden específica (usando snapshot inmutable)
app.get("/regenerar-pdf/:id", (req, res) => {
    if (!req.session.user) {
        req.session.error = 'No estás autenticado';
        return res.redirect("/");
    }

    const ordenId = req.params.id;

    // Consultar datos completos de la orden (snapshot inmutable)
    db.query(`
        SELECT o.*,
               te.nombre as tipo_equipo_nombre,
               m.nombre as marca_nombre
        FROM ordenes_servicio o
        LEFT JOIN tipos_equipo te ON o.id_tipo_equipo = te.id
        LEFT JOIN marcas m ON o.id_marca = m.id
        WHERE o.id = $1
        LIMIT 1
    `, [ordenId], (err, ordenResult) => {
        if (err || ordenResult.rows.length === 0) {
            console.log("Error al obtener orden: " + (err?.stack || "No encontrada"));
            return res.status(404).send("Orden no encontrada");
        }

        const orden = ordenResult.rows[0];

        // Construir rutas de firmas específicas de esta orden
        const firmaTecnicoPath = orden.firma_tecnico_path ?
            path.join('public', orden.firma_tecnico_path) : null;
        const firmaClientePath = orden.firma_cliente_path ?
            path.join('public', orden.firma_cliente_path) : null;

        // Consultar tipos de servicio (IDs como strings para el PDF)
        db.query(`
            SELECT osts.id_tipo_servicio
            FROM ordenes_servicio_tipos_servicio osts
            WHERE osts.id_orden_servicio = $1
        `, [ordenId], (err, tiposResult) => {
            const tiposServicio = tiposResult ? tiposResult.rows.map(t => String(t.id_tipo_servicio)) : [];

            // Consultar piezas
            db.query(`
                SELECT no_parte, cantidad, descripcion
                FROM piezas_danadas
                WHERE id_orden_servicio = $1
                LIMIT 1
            `, [ordenId], (err, piezasResult) => {
                const pieza = piezasResult?.rows[0] || { no_parte: 0, cantidad: 0, descripcion: 0 };

                // Formatear fechas igual que en el PDF automático
                const createAtFormatted = orden.create_at ?
                    new Date(orden.create_at).toLocaleDateString("es-MX") : '';
                const fechaServicioFormatted = orden.fecha_servicio ?
                    new Date(orden.fecha_servicio).toISOString().split('T')[0] : '';

                // Formatear modified_at si existe
                const modifiedAtFormatted = orden.modified_at ?
                    new Date(orden.modified_at).toLocaleString("es-MX") : null;

                // Generar PDF (usa snapshot inmutable)
                createPDF(
                    createAtFormatted,
                    fechaServicioFormatted,
                    String(orden.id),
                    orden.cliente_nombre,
                    orden.cliente_telefono || '',
                    orden.cliente_email || '',
                    tiposServicio,
                    String(orden.id_tipo_equipo || ''),
                    String(orden.id_marca || ''),
                    orden.modelo || '',
                    req.session.user,
                    orden.descripcion_falla || '',
                    orden.trabajo_realizado || '',
                    pieza.no_parte || 0,
                    pieza.cantidad || 0,
                    pieza.descripcion || 0,
                    modifiedAtFormatted,
                    firmaTecnicoPath,
                    firmaClientePath
                );

                // Esperar a que el PDF se genere
                setTimeout(() => {
                    res.download('REPORTE.pdf', `Orden_${ordenId}_${Date.now()}.pdf`, (err) => {
                        if (err) {
                            console.error("Error descargando PDF:", err);
                            res.status(500).send("Error al generar PDF");
                        }
                    });
                }, 500);
            });
        });
    });
});

app.post("/logoutFin", (req, res) => {  //boton log Out de fin.ejs para cierre de sesion y envio a http 'descargar-pdf'
     req.session.destroy((err) => {
    if (err) {
      console.log(err);
    } else {
     res.set("Content-Type", "text/html");
  res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="5;url=/" />
      </head>
      <body>
        <script>
          // Iniciar descarga automática
          window.location.href = 'descargar-pdf'; 
          // Redirigir después de 5 segundos
          setTimeout(() => {
            window.location.href = '/';
          }, 200);
        </script>
      </body>
    </html>
  `);
    }
});   
    
});


app.post("/logout", (req, res) => {  
     req.session.destroy((err) => {
    if (err) {
      console.log(err);
    } else {
    res.redirect("/");
    }
});   
});



app.get('/descargar-pdf', (req, res) => { //metodo get para descargar pdf usado en /logout
  res.download('REPORTE.pdf', (err) => {
    if (err) {
      console.error("Error descargando el archivo:", err);
      res.status(500).send("Error al descargar el archivo");
    }
  });
});

app.post("/inicio", (req, res) => { //boton de inicio de encabezados usuario administrador
    if (!req.session.user || req.session.role !== 1) {
        req.session.error = 'No tienes permisos';
        return res.redirect("/");
    }
    res.render("menuAdmin.ejs");
});

app.post("/inicioTecnico", (req, res) => { //boton de inicio de encabezados usuario tecnico
    if (!req.session.user || req.session.role !== 2) {
        req.session.error = 'No tienes permisos';
        return res.redirect("/");
    }
    const usuario = req.session.user;
    const userId = req.session.userId;

    // Órdenes abiertas asignadas al técnico
    db.query(`SELECT s.id, TO_CHAR(s.create_at, 'DD-MM-YYYY') AS create_at, estado, nombre
        FROM ordenes_servicio s
        INNER JOIN clientes c ON c.id=s.id_cliente
        WHERE s.estado='Abierto' AND s.id_usu_tecnico=$1
        ORDER BY s.id DESC`, [userId], (err, abiertas) =>{
        if(err){
            console.log("Error órdenes abiertas: " + err.stack);
            return res.redirect("/");
        }
        // Órdenes completadas del técnico
        db.query(`SELECT s.id, TO_CHAR(s.create_at, 'DD-MM-YYYY') AS create_at,
            TO_CHAR(s.fecha_servicio, 'DD-MM-YYYY') AS fecha_servicio, estado, nombre
            FROM ordenes_servicio s
            INNER JOIN clientes c ON c.id=s.id_cliente
            WHERE s.estado='completada' AND s.id_usu_tecnico=$1
            ORDER BY s.id DESC`, [userId], (err, completadas) =>{
            if(err){
                console.log("Error órdenes completadas: " + err.stack);
                return res.redirect("/");
            }
            res.render("historialPendientes.ejs", {
                usuario: usuario,
                historialAbiertas: abiertas.rows,
                historialCompletadas: completadas.rows,
                totalAbiertas: abiertas.rows.length,
                totalCompletadas: completadas.rows.length
            });
        });
    });
});



app.listen(port, ()=>{ //inicio de servidor para comenzar a escuchar en puerto 3000
    console.log(`Conectado a servidor ${port}`);
});