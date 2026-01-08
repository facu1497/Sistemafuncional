import { utils, writeFile } from 'xlsx';

const data = [
    {
        "Siniestro": "12345/2024",
        "Compania": "Rivadavia",
        "Asegurado": "Juan Pérez",
        "Fecha Asignacion": "08/01/2026",
        "DNI": "20334455",
        "Poliza": "998877",
        "Patente": "AB123CD",
        "Ramo": "Automotores",
        "Telefono": "1122334455",
        "Mail": "juan@mail.com",
        "Analista": "HM",
        "Causa": "Choque en cadena",
        "Tramitador": "Gomez",
        "Fecha Siniestro": "01/01/2026",
        "Fecha Denuncia": "02/01/2026",
        "Observaciones": "Derivado por urgencia",
        "Calle": "Av. Rivadavia 100",
        "Nro": "100",
        "Localidad": "CABA",
        "Provincia": "Buenos Aires",
        "Calle Riesgo": "Av. Corrientes 500",
        "Localidad Riesgo": "CABA",
        "Estado": "ENTREVISTAR"
    },
    {
        "Siniestro": "67890/2024",
        "Compania": "San Cristobal",
        "Asegurado": "María Garcia",
        "Fecha Asignacion": "07/01/2026",
        "DNI": "25888999",
        "Poliza": "554433",
        "Patente": "AF444GG",
        "Ramo": "Hogar",
        "Telefono": "1166778899",
        "Mail": "maria@mail.com",
        "Analista": "GIBERT",
        "Causa": "Incendio parcial",
        "Tramitador": "Lopez",
        "Fecha Siniestro": "05/01/2026",
        "Calle": "Calle Falsa 123",
        "Localidad": "Lanus",
        "Provincia": "Buenos Aires",
        "Estado": "EN GESTION"
    }
];

const ws = utils.json_to_sheet(data);
const wb = utils.book_new();
utils.book_append_sheet(wb, ws, "Casos");

writeFile(wb, "Ejemplo_Importacion_Casos.xlsx");
console.log("Archivo 'Ejemplo_Importacion_Casos.xlsx' generado correctamente.");
