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

dotenv.config({ path: './config.env' }); //asignamos path para dotenv de configuraciones para emailHost y contraseñas

const app= express(); //declaramos nuestro servidor como variable app
const port=3000; //asignamos nuestro puerto para ser el 3000

app.use(expressSession({
     secret: 'mi-secreto',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000 //24 hrs
  }
}));

const transportador =transporter(); //funcion traida desde ./envioEmail.js y programada con loss datos del host, puerto etc del servicio email transportador

const upload = multer({ storage: multer.memoryStorage() }); //asignamos el guardado de imagenes en buffer

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
/*
app.use((req, res, next) => {
  if (!req.session.user) {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', 0);
  }
  next();
});
*/

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
                    req.session.user = usuario;
                    if (role==1){
                         //req.session.user = usuario;
                        res.render("menuAdmin.ejs", {});
                    }else if(role==2){
                        db.query(`SELECT s.id, TO_CHAR(s.create_at, 'DD-MM-YYYY') AS create_at, id_cliente, estado, nombre FROM public.ordenes_servicio s 
                            INNER JOIN clientes c ON (c.id=s.id_cliente)WHERE estado=$1 ORDER BY s.id DESC`,[`Abierto`], (err, result) =>{ 
                            if(err){
                                console.log("hubo un error "+ err.stack);  
                            }else{
                                let miArrayPendientes=result.rows;
                                const total=miArrayPendientes.length;
                                res.render("historialPendientes.ejs", {
                                    usuario:usuario,
                                    historialPendientes:miArrayPendientes,
                                    totalFilas: total
                                });
                            }
                        });    
                    }
                }
            });
            }
          
        });
        }
    });

app.all("/crearUsuario", (req, res) =>{ //app.all para aceptar post de boton en /entrar y redirect app.get en /nuevoUsuario para error de "username ya existe"
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
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

app.post("/historial", (req, res) =>{ //boton historial completo (de menuAdmin.ejs) para ir a historialCompleto.ejs
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
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

app.post("/crearHabitual", (req, res)=>{ //boton crear orden con cliente habitual en menuAdmin.ejs para clienteHabitual.ejs
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
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
    db.query("SELECT MAX(id) AS mayor_folio FROM ordenes_servicio ", (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
        if(err){
            console.log("hubo un error "+ err.stack);  
        }else{
            let folioMax=result.rows[0].mayor_folio;
            folioMax=parseInt(folioMax);
            let nextFolio=folioMax+1;

            db.query("SELECT s.id, id_cliente, calle_num_ext, colonia_localidad, codigo_postal, telefono, referencia_dir, ciudad, no_int, nombre, rfc, email FROM public.cliente_direccion s INNER JOIN clientes c ON (c.id=s.id_cliente) WHERE s.id_cliente=$1",[clienteSelected], (err, result) =>{ //seleccionar where id=id seleccionado de tablas clientes y cliente_direccion
            if(err){
                console.log("hubo un error "+ err.stack);  
            }else{

                let arrayClienteSelected=result.rows;
                let direccion=result.rows[0].id; //id de direccion tabla cliente_direccion
                console.log("id de cliente: ", direccion); //id de direccion tabla cliente_direccion
                console.log("todas las direcciones del cliente: ",arrayClienteSelected); //todas las direcciones de un cliente
                let sizeSelectedUno=arrayClienteSelected.length; //numero de direcciones
                console.log("numero de direcciones ",sizeSelectedUno);
                
                res.render("clienteHabitualSelected.ejs", {
                hoy: fecha,
                nuevoFolio:nextFolio,
                nuevoCliente:clienteSelected,
                arrayClienteSelected:arrayClienteSelected,
                sizeSelectedUno:sizeSelectedUno,
                direccion:direccion

            });
            }
          });
        }
    });  
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
    db.query("SELECT MAX(id) AS mayor_folio FROM ordenes_servicio ", (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
        if(err){
            console.log("hubo un error "+ err.stack);  
        }else{
            let folioMax=result.rows[0].mayor_folio;
            folioMax=parseInt(folioMax);
            let nextFolio=folioMax+1;
             db.query("SELECT s.id, id_cliente, calle_num_ext, colonia_localidad, codigo_postal, telefono, referencia_dir, ciudad, no_int, nombre, rfc, email FROM public.cliente_direccion s INNER JOIN clientes c ON (c.id=s.id_cliente) WHERE s.id_cliente=$1",[nuevoCliente], (err, result) =>{ //seleccionar where id=id seleccionado de tablas clientes y cliente_direccion
            if(err){
                console.log("hubo un error "+ err.stack);  
            }else{

                let arrayClienteSelected=result.rows;
                let direccion=result.rows[0].id; //id de direccion tabla cliente_direccion
                console.log("id de cliente: ", direccion); //id de direccion tabla cliente_direccion
                console.log("todas las direcciones del cliente: ",arrayClienteSelected); //todas las direcciones de un cliente
                let sizeSelectedUno=arrayClienteSelected.length; //numero de direcciones
                console.log("numero de direcciones ",sizeSelectedUno);

                let arrayClienteSelectedFinal=result.rows[opcionPresionada];
                console.log("array opcion tomada es: ", arrayClienteSelectedFinal);
                 console.log("Referencioa array opcion tomada es: ", arrayClienteSelectedFinal.referencia_dir);
                res.render("direccionSele.ejs", {
                hoy: fecha,
                nuevoFolio:nextFolio,
                nuevoCliente:nuevoCliente,
                arrayClienteSelected:arrayClienteSelected,
                arrayClienteSelectedFinal:arrayClienteSelectedFinal,
                sizeSelectedUno:sizeSelectedUno,
                direccion:direccion
            });
            }
          });
        }
    });  
});

app.post("/guardarOrdenHabitual", (req, res) =>{ //boton guardar orden de clienteHabitualSelected.ejs (Solo es necesario enviar datos a tabla orden_servicio)
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let fecha= req.body.fecha;
    let esteFolio= req.body.nuevoFolio;
    esteFolio=parseInt(esteFolio);
    let estado= req.body.estado;
    let cliente= req.body.idCliente; //valor precargado en pagina, traido desde base de datos currval al presionar boton /crear
    console.log("Nuevo folio es "+esteFolio);
        //enviar a base de datos tabla ordenes_servicio
        db.query(`INSERT INTO ordenes_servicio (id_cliente, estado) VALUES ($1, $2)`,
            [cliente, estado],
            (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
                  if(err){
                      console.log("hubo un error "+ err.stack);  
                  }else{
                      console.log("Listo db ordenes_servicio!"); 
                      res.render("menuAdmin.ejs",{            
                      });
                  }
              });      
});

app.post("/crear", (req, res) =>{ //boton crear orden con nuevo cliente (de menuAdmin.ejs)
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    db.query("SELECT MAX(id) AS mayor_folio FROM ordenes_servicio ", (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
        if(err){
            console.log("hubo un error "+ err.stack);  
        }else{
            let folioMax=result.rows[0].mayor_folio;
            folioMax=parseInt(folioMax);
            let nextFolio=folioMax+1;
            db.query("SELECT last_value FROM clientes_id_seq", (err, result) =>{ //"SELECT currval('clientes_id_seq')"
            if(err){
                console.log("hubo un error "+ err.stack);  
            }else{
                let clienteMax=result.rows[0];
                clienteMax=parseInt(clienteMax.last_value);
                let nextCliente=clienteMax+1;
                console.log("Nuevo id cliente es "+nextCliente);
                res.render("pagina1.ejs", {
                hoy: fecha,
                nuevoFolio:nextFolio,
                nuevoCliente:nextCliente
            });
            }
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
    let nuevoIdCliente= req.body.idCliente; //valor precargado en pagina, traido desde base de datos SELECT last_value FROM clientes_id_seq
    db.query(`INSERT INTO clientes (nombre, rfc, email) VALUES ($1, $2, $3)`,    //enviar a base de datos tabla clientes
  [nombreCliente, rfc, correo],
  (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
        if(err){
            console.log("hubo un error "+ err.stack);  
        }else{
            console.log("Listo db clientes!"); 
        }
    }); 
        db.query(`INSERT INTO ordenes_servicio (id_cliente, fecha_servicio, estado) VALUES ($1, $2, $3)`, //enviar a base de datos tabla ordenes_servicio
            [nuevoIdCliente, fecha, estado],
            (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
                  if(err){
                      console.log("hubo un error "+ err.stack);  
                  }else{
                      console.log("Listo db ordenes_servicio!"); 
                  }
              }); 
        db.query(`INSERT INTO cliente_direccion (id_cliente, calle_num_ext, colonia_localidad, codigo_postal, telefono, referencia_dir, ciudad, no_int ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, //enviar a base de datos tabla cliente_direccion
           [nuevoIdCliente,calle, colonia,cPostal, telefono,referencia, ciudad, numeroInterior ],
            (err, result) =>{     //folio es "id" en base de datos tabla ordenes_servicio
                  if(err){
                      console.log("hubo un error "+ err.stack);  
                  }else{
                      console.log("Listo db ordenes_servicio!"); 
                      res.render("menuAdmin.ejs",{
                      });
                  } 
              });         
});

app.post("/seguimiento", (req, res) =>{ //Boton para seleccionar orden en sesion tecnico
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let usuario=req.body.usuario;
    let clienteSeleccionado= JSON.parse(req.body.seguimiento);  //desde historialPendientes.ejs
    db.query("SELECT * FROM tipos_servicio",(err, result)=>{//para desplegar las opciones que haya en la DB, ahora 7
        if(err){
            console.log("Hubo un error en seguimiento");
        } else{
            let respuesta=result.rows;
            
            console.log(respuesta[6]);
            res.render("pagina2.ejs",{
            usuario: usuario,
            folio:clienteSeleccionado.id,
            clienteActual: clienteSeleccionado.nombre,
            idCliente:clienteSeleccionado.id_cliente,
            create_at: clienteSeleccionado.create_at
    });
        }
    })
           
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

app.post("/enviarOrden", upload.single('imagenSelected'), (req, res)=>{
     if (!req.session.user) {
    req.session.error = 'No estás autenticado';
    return res.redirect("/");
  }
    let imagen = req.file ? req.file : null; //verificando con ? : si un valor existe o es null
    if (imagen) {
        imagen=imagen.buffer;
    } else {
        imagen=null;
    }
    let create_at=req.body.create_at;
    let hoy=fecha.split('/').reverse().join('-');
    console.log(hoy);  
    let idCliente=req.body.idCliente;
    console.log(idCliente);
    let clienteActual=req.body.clienteActual;
    console.log(clienteActual);
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
    for(let i=0; i < sizeCheckbox; i++){ //insertamos en base de datos todos los tipos de servicio seleccionados por el tecnico, pueden ser los 7 incluso
       db.query(`INSERT INTO ordenes_servicio_tipos_servicio (id_orden_servicio, id_tipo_servicio ) VALUES ($1, $2)`,
        [folio, checkSelectedA[i]],
        (err, result) =>{ 
            if(err){
            console.log("hubo un error "+ err.stack);  
        }else{
            console.log("ordenes_servicio_tipos_servicio!",i,checkSelectedA[i]); 
        }  
        });  
        }
    db.query(`UPDATE ordenes_servicio SET id_tipo_equipo=$1, id_marca=$2, modelo=$3, serie=$4, descripcion_falla=$5, volts=$6, amperes=$7, watts=$8, 
        presion_agua=$9, trabajo_realizado=$10, comentarios=$11, fecha_servicio=$12, estado=$13, imagen=$14 WHERE id= $15`,
        [id_tipo_equipo,id_marca, modelo,serie, descripcion_falla,volts, amperes,watts, presion_agua,trabajo_realizado,comentarios,hoy, estado, imagen, folio ],
        (err, result) =>{ 
            if(err){
            console.log("hubo un error "+ err.stack);  
        }else{
            console.log("Listo db ordenes_servicio!"); 
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
                createPDF(create_at, hoy,folio, clienteActual, telefono, email, checkSelectedA,id_tipo_equipo, id_marca, modelo, encargado, descripcion_falla, trabajo_realizado, numParteUsada,repuestoParteUsada, descripParteUsada);
                transportador.sendMail(mailOpciones, (error, info) => { //funciones importadas de envioEmails.js
                    if (error) {
                      return console.log(error);
                    }
                    console.log('Correo enviado: ' + info.response);
                  });        
                res.render("fin.ejs",{ });
        }
        });
    });
});
        app.post('/guardar-firmas', (req, res) => { //metodo post enviado desde documento public/js/signature-pad.js que contiene las imagnes de las firmas
            const firmaTecnico= req.body.firmaTecnico;
            const firmaCliente = req.body.firmaCliente;
            
            const bufferTecnico= Buffer.from(firmaTecnico.split(',')[1], 'base64'); //almacenando las imagenes en variable bufferTecnico
                    sharp(bufferTecnico)
                    .toFormat("png")
                    .toFile('firmaTecnico.png', (err, info)=>{ //conversion de imagen a png
                        if(err){
                            console.log(err);
                        } else{
                            console.log('Firma tecnico guardada correctamente');
                        }
                    });
            
            const bufferCliente = Buffer.from(firmaCliente.split(',')[1], 'base64');
                  sharp(bufferCliente)
                    .toFormat('png')
                    .toFile('firmaCliente.png', (err, info) => {
                      if (err) {
                        console.error(err);
                      } else {
                        console.log('Firma cliente guardada correctamente');
                      }
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
    res.render("menuAdmin.ejs");
});

app.post("/inicioTecnico", (req, res) => { //boton de inicio de encabezados usuario tecnico
    let usuario=req.body.valorOculto; //valor actual de tecnico pasado a través de include header ejs en pagina2 y pagina3
    console.log("tecnico sesion abierta es: ", usuario)
    db.query(`SELECT s.id, TO_CHAR(s.create_at, 'DD-MM-YYYY') AS create_at, id_cliente, estado, nombre FROM public.ordenes_servicio s 
                            INNER JOIN clientes c ON (c.id=s.id_cliente)WHERE estado=$1 ORDER BY s.id DESC`,[`Abierto`], (err, result) =>{ 
                            if(err){
                                console.log("hubo un error "+ err.stack);  
                            }else{
                                let miArrayPendientes=result.rows;
                                const total=miArrayPendientes.length;
                                res.render("historialPendientes.ejs", {
                                    usuario:usuario,
                                    historialPendientes:miArrayPendientes,
                                    totalFilas: total
                                });
                            }
                        });    
});



app.listen(port, ()=>{ //inicio de servidor para comenzar a escuchar en puerto 3000
    console.log(`Conectado a servidor ${port}`);
});