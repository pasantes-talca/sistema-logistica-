export function destinatariosRecibo(texto: string) {
  return [...new Set(texto.split(/[;,\s]+/).map(email => email.trim().toLowerCase()).filter(Boolean))];
}

export function errorDestinatariosRecibo(texto: string) {
  const correos = destinatariosRecibo(texto);
  if (correos.length > 20) return "Podés indicar hasta 20 correos por recibo.";
  const invalido = correos.find(email => email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email));
  return invalido ? `Revisá el correo «${invalido}»: no tiene un formato válido.` : "";
}
