import nodemailer from "nodemailer"; //modulo para envio de correos
import dotenv from 'dotenv'; //libreria para uso de archivo .env (variables de entorono para configuraciones)

dotenv.config({ path: './config.env' });

//datos prdefinidos en config.env para funcion transporter
const transporterHost= process.env.emailHost; 
const transporterPort= process.env.emailPort;
const transporterSecure= process.env.emailSecure;
const transporterAuthUser= process.env.emailAuthUser;
const transporterAuthPass= process.env.emailAuthPass;

//Programando funcion transporter para crear host de transporte de email, puerto y contraseñas
function transporter(){  //usamos modulo nodemailer para construir nuestra funcion transporter
let transporter = nodemailer.createTransport({
    host: transporterHost,
    port: transporterPort,
    secure:transporterSecure,
    auth: {
      user: transporterAuthUser,
      pass: transporterAuthPass,
    },
  });
  return transporter;
}

//datos prdefinidos en config.env para funcion mailOptions
const mailOptionsFrom= process.env.emailFrom;
const mailOptionsTo= process.env.emailTo;
const mailOptionsSubject= process.env.emailSubject;
const mailOptionsText= process.env.emailText;


//Programando funcion mailOptions para contenido de email así como emisor y receptor
function mailOptions(e){ //funcion mailOptions donde "e" es valor email de cliente, tomado de la base de datos para la orden del cliente
let mailOptions = {
    from: mailOptionsFrom,
    to: [mailOptionsTo,e] , //enviamos a email definido en archivo config.env (ventas distribucion) y valor de email de cliente "e"
    subject: mailOptionsSubject,
    text: mailOptionsText,
    attachments: [
      {
        filename: 'REPORTE.pdf',
        path: './REPORTE.pdf' 
      }
    ]
  }; 
  return mailOptions;
}
export{transporter, mailOptions};
