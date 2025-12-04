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

  // Obtener el folio de la página
  const folioInput = document.querySelector('input[name="folio"]');
  const folio = folioInput ? folioInput.value : null;

  if (!folio) {
    console.error('No se encontró el folio');
    return;
  }

  const firmas = {
    firmaCliente: signatureCliente,
    firmaTecnico: signatureTecnico,
    folio: folio
  };

  // Envía la firma al servidor
  fetch('/guardar-firmas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(firmas),
  })
  .then((response) => response.text())
  .then((message) => console.log(message))
  .catch((error) => console.error(error));
});
