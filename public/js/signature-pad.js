const canvasTecnico = document.getElementById('signature-padTecnico');
const signaturePadTecnico = new SignaturePad(canvasTecnico, {
  backgroundColor: 'rgb(255, 255, 255)',
  penColor: 'rgb(47, 144, 201)',
});

document.getElementById('clearTecnico').addEventListener('click', () => {
  signaturePadTecnico.clear();
});

////////////////////////////////////////////////////////////////////////////////////////////////////////

const canvasCliente = document.getElementById('signature-padCliente');
const signaturePadCliente = new SignaturePad(canvasCliente, {
  backgroundColor: 'rgb(255, 255, 255)',
  penColor: 'rgb(47, 144, 201)',
});


document.getElementById('clearCliente').addEventListener('click', () => {
  signaturePadCliente.clear();
});

////////////////////////////////////////////////////////////////////////////////////////////////////////

document.getElementById('saveAll').addEventListener('click', () => {
  const signatureCliente = signaturePadCliente.toDataURL();
  const signatureTecnico = signaturePadTecnico.toDataURL();
  //document.getElementById('signature-img').src = signature;
  const firmas = {
    firmaCliente: signatureCliente,
    firmaTecnico: signatureTecnico,
  };

  // Envía la firma al servidor
  fetch('/guardar-firmas', { //enviarOrden
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(firmas), //envio de cadena json para ser usado con req.body en post /guardar-firmas
  })
  .then((response) => response.text())
  .then((message) => console.log(message))
  .catch((error) => console.error(error));
});
