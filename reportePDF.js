import PDFDocument from 'pdfkit';
import fs from 'fs';
// Función para crear el PDF
function createPDF(create_at, fecha,folio, cliente, telefono,correo, tipoServicio, tipoEquipo, marca, modelo, tecnico, falla, trabajo, partesUtilizadas, repuestoParteUsada, descripParteUsada) {
    const doc = new PDFDocument({ size: 'letter' });
    let eleccionTipoServicio;
  switch (tipoServicio){
   case "1":
   eleccionTipoServicio="Recolección";
   break;
   case "2":
   eleccionTipoServicio="Diagnóstico";
   break;
   case "3":
   eleccionTipoServicio="Mantenimiento";
   break;
   case "4":
   eleccionTipoServicio="Puesta en marcha";
   break;
   case "5":
   eleccionTipoServicio="Reparación";
   break;
   case "6":
   eleccionTipoServicio="Instalación";
   break;
   case "Otro":
   eleccionTipoServicio="Otro";
   break;
    
  }
  console.log(eleccionTipoServicio);

      let eleccionTipoEquipo;
  switch (tipoEquipo){
   case "1":
   eleccionTipoEquipo="Centro de lavado";
   break;
   case "2":
   eleccionTipoEquipo="Centro de secado";
   break;
   case "3":
   eleccionTipoEquipo="Sencillo";
   break;
   }
  console.log(eleccionTipoEquipo);

  console.log("en pdf array es: ",tipoServicio);
  console.log(tipoServicio[0]);
  if(tipoServicio[0]=="2"){
    console.log("es correctamente");
  }
  let espacio=114;
  let sizeTipoServicio= tipoServicio.length;
for(let i=0; i < sizeTipoServicio; i++){ 
      espacio=espacio+53;
    if(tipoServicio[i]=="1"){
      doc.fontSize(9)
      .text("Recolección", espacio, 262);
    } else if(tipoServicio[i]=="2"){
      doc.fontSize(9)
      .text("Diagnóstico", espacio, 262);
    }else if(tipoServicio[i]=="3"){
      doc.fontSize(9)
      .text("Mantenimiento", espacio-3, 262);
    }else if(tipoServicio[i]=="4"){
      doc.fontSize(9)
      .text("Puesta en marcha", espacio+5, 262);
    }else if(tipoServicio[i]=="5"){
      doc.fontSize(9)
      .text("Reparación", espacio+27, 262);
    }else if(tipoServicio[i]=="6"){
      doc.fontSize(9)
      .text("Instalación", espacio+22, 262);
    }else if(tipoServicio[i]=="7"){
      doc.fontSize(9)
      .text("Otro", espacio+15, 262);
    }    
  }


let eleccionMarca;
  switch (marca){
   case "1":
   eleccionMarca="ADC";
   break;
   case "2":
   eleccionMarca="DANUBE";
   break;
   case "3":
   eleccionMarca="LG";
   break;
   case "3":
   eleccionMarca="MYTAG";
   break;
   }

    // Agrega texto
    doc.image('public//images/distribucion.png', 430, 10, {fit: [160, 120]})

    doc.fontSize(12)
       .text('FECHA DE EMISION', 50, 120)
       .fontSize(10)
       .text(create_at, 50, 140);
  
    doc.fontSize(12)
       .text('FECHA DE CIERRE', 270, 120)
       .fontSize(10)
       .text(fecha, 270, 140);
    
       doc.fontSize(12)
       .text('FOLIO', 480, 120)
       .fontSize(10)
       .text(folio, 480, 140);
    
       doc.fontSize(12)
       .text('CLIENTE:', 50, 200)
       .fontSize(10)
       .text(cliente, 110, 202);

       doc.fontSize(12)
       .text('TELEFONO:', 50, 230)
       .fontSize(10)
       .text(telefono, 125, 232);

       doc.fontSize(12)
       .text('CORREO:', 320, 230)
       .fontSize(10)
       .text(correo, 380, 232);

        doc.fontSize(12)
       .text('TIPO DE SERVICIO:', 50, 260)

        doc.fontSize(12)
       .text('TIPO DE EQUIPO:', 320, 290)
       .fontSize(10)
       .text(eleccionTipoEquipo, 430, 292);

       doc.fontSize(12)
       .text('MARCA:', 50, 290)
       .fontSize(10)
       .text(eleccionMarca, 110, 292);

       doc.fontSize(12)
       .text('MODELO:', 320, 320)
       .fontSize(10)
       .text(modelo, 380, 322);

       doc.fontSize(12)
       .text('TECNICO ENCARGADO:', 50, 320)
       .fontSize(10)
       .text(tecnico, 190, 322);

       doc.fontSize(12)
       .text('FALLA REPORTADA:', 50, 350)
       .fontSize(10)
       .text(falla, 170, 352);

       doc.fontSize(12)
       .text('TRABAJO REALIZADO:', 50, 400)
       .fontSize(10)
       .text(trabajo, 190, 402);

       doc.fontSize(12)
       .text('PARTE UTILIZADA:', 50, 450)
       .fontSize(10)
       .text(partesUtilizadas, 160, 452);

           doc.fontSize(12)
       .text('REPUESTO:', 320, 450)
       .fontSize(10)
       .text(repuestoParteUsada, 395, 452);

         doc.fontSize(12)
       .text('DESCRIPCIÓN:', 50, 470)
       .fontSize(10)
       .text(descripParteUsada, 140, 472);

       doc.fontSize(10)
       .text('SE ME INDICÓ EL PROBLEMA DEL EQUIPO Y LA REPARACIÓN DESCRITA EN LA ORDEN DE SERVICIO. SE ME MOSTRARON LAS REFACCIONES NUEVAS A UTILIZARSE QUEDANDO EL EQUIPO FUNCIONANDO Y A MI ENTERA SATISFACCIÓN.:', 100, 520)
      
       doc.fontSize(12)
       .text('FIRMAS', 280, 570)

       // Fit the image within the dimensions
      doc.image('firmaTecnico.png', 155, 620, {fit: [100, 100]})
      .text('Firma del Técnico', 155, 705);

      doc.image('firmaCliente.png', 365, 620, {fit: [100, 100]})
      .text('Firma del Cliente', 365, 705);
  
    // Guarda el PDF en un archivo
    const writeStream = fs.createWriteStream('REPORTE.pdf');
    doc.pipe(writeStream);
    doc.end();
  
    console.log('PDF creado correctamente.');
  }

  export{createPDF};