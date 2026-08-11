import * as XLSX from 'xlsx';
import { FormData } from '../types';

export const exportToExcel = (fichas: FormData[], fileName = 'Fichas_Lashista_Maestro.xlsx') => {
  if (!fichas || fichas.length === 0) {
    alert('No hay fichas registradas para exportar.');
    return;
  }

  // Map each record to a clean row object for Excel
  const dataForExcel = fichas.map((f, index) => ({
    'ID Ficha': f.id || `FCH-${1000 + index}`,
    'Estado': f.estado === 'completada' ? 'Completada' : 'Pendiente de Profesional',
    'Fecha Registro': f.fechaCreacion || f.fecha || '',
    
    // Fase 1: Datos Clienta
    'Nombre Clienta': f.nombreCompleto || '',
    'Teléfono': f.telefono || '',
    'Edad': f.edad || '',
    'Fecha Cita': f.fecha || '',
    'Servicio Extensiones': f.servicioExtensiones ? 'Sí' : 'No',
    'Servicio Lifting': f.servicioLifting ? 'Sí' : 'No',
    
    // Historial Médico / Salud
    'Alergia': f.alergia || '',
    'Alergia Cuál': f.alergiaCual || '',
    'Reacción': f.reaccion || '',
    'Reacción Cuál': f.reaccionCual || '',
    'Irritación': f.irritacion || '',
    'Irritación Cuál': f.irritacionCual || '',
    'Condición Ocular/Piel': f.condicion || '',
    'Condición Cuál': f.condicionCual || '',
    'Lentes de Contacto': f.lentesContacto || '',
    'Medicamentos': f.medicamento || '',
    'Medicamentos Cuál': f.medicamentoCual || '',
    'Procedimiento Reciente': f.procedimientoReciente || '',
    'Primera Vez': f.primeraVez || '',
    'Molestia Anterior': f.molestiaAnterior || '',
    'Molestia Anterior Cuál': f.molestiaAnteriorCual || '',
    'Observaciones Clienta': f.observacionesClienta || '',
    'Documento Clienta': f.documentoFirmaClienta || '',
    'Fecha Firma Clienta': f.fechaFirmaClienta || '',

    // Fase 2: Profesional
    'Estado Pestañas': f.estadoPestanas || '',
    'Densidad': f.densidad || '',
    'Observaciones Evaluación': f.observacionesProfesional || '',
    'Procedimiento Recomendado': f.procedimientoRecomendado || '',
    'Técnica / Diseño': f.tecnicaDiseno || '',
    'Curvatura': f.curvatura || '',
    'Longitud': f.longitud || '',
    'Grosor': f.grosor || '',
    'Productos Utilizados': f.productos || '',
    'Observaciones Finales': f.observacionesFinales || '',
    'Fecha Firma Profesional': f.fechaFirmaProfesional || '',
    'Enlace PDF Fase 1': f.pdfFase1Url || '',
    'Enlace PDF Final': f.pdfFase2Url || ''
  }));

  // Create worksheet and workbook
  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fichas de Clientes');

  // Trigger browser download
  XLSX.writeFile(workbook, fileName);
};
