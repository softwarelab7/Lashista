export interface FormData {
  // Metadata del Sistema (2 Fases)
  id?: string;
  estado?: 'pendiente_profesional' | 'completada';
  fechaCreacion?: string;
  pdfFase1Url?: string;
  pdfFase2Url?: string;

  // Section 1: Datos Personales
  nombreCompleto: string;
  telefono: string;
  edad: string;
  fechaNacimiento: string;
  fecha: string;
  servicioExtensiones: boolean;
  servicioLifting: boolean;
  
  // Section 2: Historial de Salud
  alergia: string; // 'Si' | 'No' | ''
  alergiaCual: string;
  reaccion: string;
  reaccionCual: string;
  irritacion: string;
  irritacionCual: string;
  condicion: string;
  condicionCual: string;
  lentesContacto: string;
  medicamento: string;
  medicamentoCual: string;
  procedimientoReciente: string;
  primeraVez: string;
  molestiaAnterior: string;
  molestiaAnteriorCual: string;
  observacionesClienta: string;
  
  // Section 3: Evaluación Profesional
  estadoPestanas: string; // 'Bueno' | 'Regular' | 'Débil'
  densidad: string; // 'Baja' | 'Media' | 'Alta'
  observacionesProfesional: string;
  procedimientoRecomendado: string;
  
  // Section 4: Consentimiento Clienta
  autorizacion: boolean;
  firmaClienta: string; // Base64
  nombreFirmaClienta: string;
  documentoFirmaClienta: string;
  fechaFirmaClienta: string;
  
  // Section 5: Servicio Técnico y Firma Profesional
  tecnicaDiseno: string;
  curvatura: string;
  longitud: string;
  grosor: string;
  productos: string;
  observacionesFinales: string;
  firmaProfesional: string; // Base64
  fechaFirmaProfesional: string;
}

export const initialFormData: FormData = {
  id: '',
  estado: 'pendiente_profesional',
  fechaCreacion: '',
  pdfFase1Url: '',
  pdfFase2Url: '',
  nombreCompleto: '',
  telefono: '',
  edad: '',
  fechaNacimiento: '',
  fecha: new Date().toISOString().split('T')[0],
  servicioExtensiones: false,
  servicioLifting: false,
  alergia: '',
  alergiaCual: '',
  reaccion: '',
  reaccionCual: '',
  irritacion: '',
  irritacionCual: '',
  condicion: '',
  condicionCual: '',
  lentesContacto: '',
  medicamento: '',
  medicamentoCual: '',
  procedimientoReciente: '',
  primeraVez: '',
  molestiaAnterior: '',
  molestiaAnteriorCual: '',
  observacionesClienta: '',
  estadoPestanas: '',
  densidad: '',
  observacionesProfesional: '',
  procedimientoRecomendado: '',
  autorizacion: false,
  firmaClienta: '',
  nombreFirmaClienta: '',
  documentoFirmaClienta: '',
  fechaFirmaClienta: '',
  tecnicaDiseno: '',
  curvatura: '',
  longitud: '',
  grosor: '',
  productos: '',
  observacionesFinales: '',
  firmaProfesional: '',
  fechaFirmaProfesional: new Date().toISOString().split('T')[0]
};

