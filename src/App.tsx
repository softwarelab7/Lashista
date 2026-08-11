import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FormData, initialFormData } from './types';
import { Eye, CheckCircle, Download, FileSpreadsheet, User, ShieldCheck, FileText, PlusCircle, ArrowLeft, Clock, LogOut } from 'lucide-react';
import eyelashImage from './assets/images/banner.jpg';
import flowersImage from './assets/images/flowers.png';
import { exportToExcel } from './utils/excelExport';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

// Reusable components
const FloralDecoration = ({ className }: { className?: string }) => (
  <img src={flowersImage} alt="Floral decoration" className={`mix-blend-multiply object-contain ${className}`} />
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#8B6FA8] text-white px-5 py-1.5 uppercase font-medium text-sm rounded-r-full rounded-l-sm inline-block mb-4 shadow-sm">
    {children}
  </div>
);

const PaperInput = ({ label, name, value, onChange, type = "text", width = "w-full", containerClassName = "w-full", disabled = false }: { label?: string, name: string, value: string | number, onChange: any, type?: string, width?: string, containerClassName?: string, disabled?: boolean }) => (
  <div className={`flex flex-col gap-1 ${containerClassName}`}>
    {label && <label className="text-sm text-gray-700">{label}</label>}
    <input 
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`paper-input ${width} ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
    />
  </div>
);

const PaperCheckbox = ({ label, name, checked, onChange, disabled = false }: { label: string, name: string, checked: boolean, onChange: any, disabled?: boolean }) => (
  <label className={`flex items-center gap-2 text-sm text-gray-700 ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
    <input 
      type="checkbox" 
      name={name} 
      checked={checked} 
      onChange={onChange}
      disabled={disabled}
      className="custom-checkbox shrink-0" 
    />
    <span className="mt-0.5">{label}</span>
  </label>
);

const PaperRadio = ({ label, name, value, checked, onChange, disabled = false }: { label: string, name: string, value: string, checked: boolean, onChange: any, disabled?: boolean }) => (
  <label className={`flex items-center gap-2 text-sm text-gray-700 ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
    <input 
      type="radio" 
      name={name} 
      value={value}
      checked={checked} 
      onChange={() => !disabled && onChange(name, value)}
      disabled={disabled}
      className="custom-checkbox shrink-0" 
    />
    <span className="mt-0.5">{label}</span>
  </label>
);

const YesNoQuestion = ({ title, name, formData, handleChange, handleRadio, hasCual = false, disabled = false }: { title: string, name: string, formData: any, handleChange: any, handleRadio: any, hasCual?: boolean, disabled?: boolean }) => (
  <div className="mb-4 text-sm">
    <div className="flex justify-between items-start gap-4">
      <p className="text-gray-700 max-w-[70%]">{title}</p>
      <div className="flex gap-4 shrink-0">
        <PaperRadio label="Sí" name={name} value="Si" checked={formData[name] === 'Si'} onChange={handleRadio} disabled={disabled} />
        <PaperRadio label="No" name={name} value="No" checked={formData[name] === 'No'} onChange={handleRadio} disabled={disabled} />
      </div>
    </div>
    {hasCual && formData[name] === 'Si' && (
      <div className="mt-1 flex items-end gap-2">
        <span className="text-gray-600">¿Cuál?</span>
        <input 
          type="text" 
          name={`${name}Cual`} 
          value={formData[`${name}Cual`]} 
          onChange={handleChange}
          disabled={disabled}
          className={`paper-input flex-1 ${disabled ? 'bg-gray-100 text-gray-500' : ''}`}
        />
      </div>
    )}
  </div>
);

export default function App() {
  const [viewMode, setViewMode] = useState<'clienta' | 'admin'>('clienta');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successPhase, setSuccessPhase] = useState<'fase1' | 'fase2' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Google Authentication & Approved Admin Accounts State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authError, setAuthError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Lista estricta y segura de correos de Google autorizados para acceder al Panel
  const AUTHORIZED_ADMIN_EMAILS = [
    'erikajohanalozano@gmail.com',
    'nortivystore@gmail.com'
  ];

  const isAdminUnlocked = !!(user && user.email && AUTHORIZED_ADMIN_EMAILS.some(e => e.toLowerCase() === user.email?.toLowerCase()));

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Store all client records in state and sync with localStorage
  const [fichas, setFichas] = useState<FormData[]>(() => {
    try {
      const saved = localStorage.getItem('lashista_fichas_store');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [activeFichaId, setActiveFichaId] = useState<string | null>(null);

  const sigClientRef = useRef<SignatureCanvas>(null);
  const sigProfRef = useRef<SignatureCanvas>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleAdminAccess = () => {
    if (isAdminUnlocked) {
      setViewMode('admin');
    } else {
      setAuthError('');
      setShowAuthModal(true);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const loggedEmail = result.user.email?.toLowerCase() || '';

      const isApproved = AUTHORIZED_ADMIN_EMAILS.some(e => e.toLowerCase() === loggedEmail);

      if (isApproved) {
        setShowAuthModal(false);
        setViewMode('admin');
      } else {
        await signOut(auth);
        setUser(null);
        setAuthError(`⛔ Acceso Denegado: El correo (${loggedEmail}) no está autorizado para acceder al panel.`);
      }
    } catch (err: any) {
      console.error("Error en Google Sign In:", err);
      setAuthError("Error iniciando sesión con Google: " + (err.message || 'Intenta nuevamente'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAddCurrentEmailToApproved = () => {
    if (user && user.email) {
      const newEmail = user.email.toLowerCase();
      if (!approvedEmails.includes(newEmail)) {
        setApprovedEmails(prev => [...prev, newEmail]);
        setShowAuthModal(false);
        setViewMode('admin');
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    startNewForm();
  };

  useEffect(() => {
    try {
      localStorage.setItem('lashista_fichas_store', JSON.stringify(fichas));
    } catch (e) {
      console.error("Error saving to localStorage", e);
    }
  }, [fichas]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleRadio = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const startNewForm = () => {
    setFormData({
      ...initialFormData,
      id: `FCH-${Math.floor(1000 + Math.random() * 9000)}`,
      fechaCreacion: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      estado: 'pendiente_profesional'
    });
    setActiveFichaId(null);
    setSuccessPhase(null);
    setErrorMsg('');
    sigClientRef.current?.clear();
    sigProfRef.current?.clear();
    setViewMode('clienta');
  };

  // Helper to generate PDF blob and trigger download
  const generateAndDownloadPDF = async (filename: string): Promise<string | null> => {
    if (!formRef.current) return null;
    try {
      const canvas = await html2canvas(formRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      
      // Save locally
      pdf.save(filename);

      // Return base64 string for Drive upload
      return pdf.output('datauristring');
    } catch (err) {
      console.error("Error al generar PDF:", err);
      return null;
    }
  };

  // Upload PDF to Google Drive via server endpoint
  const uploadPdfToDrive = async (pdfBase64: string, fileName: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, fileName }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.webViewLink || data.webContentLink || null;
      }
    } catch (e) {
      console.log("Servidor sin credenciales de Drive activas:", e);
    }
    return null;
  };

  // Submit to Google Sheets via server endpoint
  const submitToGoogleSheets = async (ficha: FormData) => {
    const rowData = [
      ficha.id,
      ficha.estado === 'completada' ? 'Completada' : 'Pendiente de Profesional',
      ficha.fechaCreacion || ficha.fecha,
      ficha.nombreCompleto,
      ficha.telefono,
      ficha.edad,
      ficha.fecha,
      [ficha.servicioExtensiones ? 'Extensiones' : '', ficha.servicioLifting ? 'Lifting' : ''].filter(Boolean).join(', '),
      ficha.alergia,
      ficha.alergia === 'Si' ? ficha.alergiaCual : '',
      ficha.reaccion,
      ficha.reaccion === 'Si' ? ficha.reaccionCual : '',
      ficha.irritacion,
      ficha.irritacion === 'Si' ? ficha.irritacionCual : '',
      ficha.condicion,
      ficha.condicion === 'Si' ? ficha.condicionCual : '',
      ficha.lentesContacto,
      ficha.medicamento,
      ficha.medicamento === 'Si' ? ficha.medicamentoCual : '',
      ficha.procedimientoReciente,
      ficha.primeraVez,
      ficha.molestiaAnterior === 'Si' && ficha.molestiaAnteriorCual ? 'Sí: ' + ficha.molestiaAnteriorCual : ficha.molestiaAnterior,
      ficha.observacionesClienta,
      ficha.estadoPestanas,
      ficha.densidad,
      ficha.observacionesProfesional,
      ficha.procedimientoRecomendado,
      ficha.autorizacion ? 'Sí' : 'No',
      ficha.nombreFirmaClienta,
      ficha.documentoFirmaClienta,
      ficha.fechaFirmaClienta,
      ficha.tecnicaDiseno,
      ficha.curvatura,
      ficha.longitud,
      ficha.grosor,
      ficha.productos,
      ficha.observacionesFinales,
      ficha.fechaFirmaProfesional,
      ficha.pdfFase1Url || '',
      ficha.pdfFase2Url || ''
    ];

    try {
      await fetch('/api/submit-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowData }),
      });
    } catch (e) {
      console.log("No se pudo conectar a Google Sheets server:", e);
    }
  };

  // Submit Handler for Client (Phase 1)
  const handleSubmitPhase1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.nombreCompleto.trim()) return setErrorMsg("El nombre completo es obligatorio.");
    if (!formData.telefono.trim()) return setErrorMsg("El teléfono es obligatorio.");
    if (!formData.autorizacion) return setErrorMsg("Debes autorizar el consentimiento informado.");
    if (sigClientRef.current?.isEmpty()) return setErrorMsg("La firma de la clienta es obligatoria.");

    setIsSubmitting(true);

    try {
      const clientSig = sigClientRef.current?.getTrimmedCanvas().toDataURL('image/png') || '';
      const fichaId = formData.id || `FCH-${Math.floor(1000 + Math.random() * 9000)}`;
      const fechaActual = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const updatedData: FormData = {
        ...formData,
        id: fichaId,
        fechaCreacion: fechaActual,
        estado: 'pendiente_profesional',
        firmaClienta: clientSig,
        nombreFirmaClienta: formData.nombreFirmaClienta || formData.nombreCompleto,
        fechaFirmaClienta: formData.fechaFirmaClienta || formData.fecha
      };

      setFormData(updatedData);

      // MANDATORY PDF GENERATION FOR PHASE 1
      const filename = `Fase1_Consentimiento_${updatedData.nombreCompleto.replace(/\s+/g, '_')}_${fichaId}.pdf`;
      const pdfBase64 = await generateAndDownloadPDF(filename);

      let driveUrl: string | null = null;
      if (pdfBase64) {
        driveUrl = await uploadPdfToDrive(pdfBase64, filename);
      }

      const finalFicha = { ...updatedData, pdfFase1Url: driveUrl || '' };

      // Update state & localStorage
      setFichas(prev => [finalFicha, ...prev.filter(f => f.id !== fichaId)]);
      
      // Sync to Google Sheets
      await submitToGoogleSheets(finalFicha);

      // Create event in Google Calendar
      try {
        const servicioStr = [finalFicha.servicioExtensiones ? 'Extensiones' : '', finalFicha.servicioLifting ? 'Lifting' : ''].filter(Boolean).join(', ');
        await fetch('/api/create-calendar-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombreCompleto: finalFicha.nombreCompleto,
            telefono: finalFicha.telefono,
            fecha: finalFicha.fecha,
            servicio: servicioStr,
            fichaId: finalFicha.id
          })
        });
      } catch (calErr) {
        console.log("Aviso de calendario:", calErr);
      }

      setSuccessPhase('fase1');
      window.scrollTo(0, 0);
    } catch (err: any) {
      setErrorMsg("Error procesando la Fase 1: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Handler for Professional (Phase 2)
  const handleSubmitPhase2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (sigProfRef.current?.isEmpty()) {
      return setErrorMsg("La firma de la profesional es obligatoria para completar la ficha.");
    }

    setIsSubmitting(true);

    try {
      const profSig = sigProfRef.current?.getTrimmedCanvas().toDataURL('image/png') || '';
      
      const updatedData: FormData = {
        ...formData,
        estado: 'completada',
        firmaProfesional: profSig,
        fechaFirmaProfesional: formData.fechaFirmaProfesional || new Date().toISOString().split('T')[0]
      };

      setFormData(updatedData);

      // MANDATORY FINAL PDF GENERATION FOR PHASE 2
      const filename = `Ficha_Completa_${updatedData.nombreCompleto.replace(/\s+/g, '_')}_${updatedData.id}.pdf`;
      const pdfBase64 = await generateAndDownloadPDF(filename);

      let driveUrl: string | null = null;
      if (pdfBase64) {
        driveUrl = await uploadPdfToDrive(pdfBase64, filename);
      }

      const finalFicha = { ...updatedData, pdfFase2Url: driveUrl || '' };

      // Update state & localStorage
      setFichas(prev => prev.map(f => f.id === finalFicha.id ? finalFicha : f));

      // Sync to Google Sheets
      await submitToGoogleSheets(finalFicha);

      setSuccessPhase('fase2');
      window.scrollTo(0, 0);
    } catch (err: any) {
      setErrorMsg("Error completando la Fase 2: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open existing ficha in Phase 2 Professional Mode
  const openFichaForPhase2 = (ficha: FormData) => {
    setFormData(ficha);
    setActiveFichaId(ficha.id || null);
    setErrorMsg('');
    setSuccessPhase(null);
    setViewMode('admin');
    window.scrollTo(0, 500); // Scroll down to the form
  };

  return (
    <div className="min-h-screen pb-20 flex flex-col items-center relative overflow-hidden bg-[#Fdfbfc]">
      
      {/* Top Navbar / Mode Selector */}
      <header className="w-full bg-white border-b border-purple-100 shadow-sm py-3 px-4 md:px-8 flex justify-between items-center z-30 sticky top-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[#8B6FA8] text-white flex items-center justify-center font-script text-xl">
            EJ
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-bold text-gray-800 tracking-wide uppercase">Lashista Profesional</h1>
            <p className="text-[10px] text-[#8B6FA8]">Erika Johana Lozano</p>
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-2">
          {viewMode === 'admin' && (
            <button
              type="button"
              onClick={() => startNewForm()}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Modo Clienta</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleAdminAccess}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'admin' 
                ? 'bg-[#634b79] text-white shadow-sm' 
                : 'bg-purple-50 text-[#8B6FA8] hover:bg-purple-100 border border-purple-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isAdminUnlocked ? 'Panel Lashista' : '🔒 Acceso Lashista'}</span>
            {fichas.filter(f => f.estado === 'pendiente_profesional').length > 0 && (
              <span className="bg-amber-400 text-gray-900 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
                {fichas.filter(f => f.estado === 'pendiente_profesional').length}
              </span>
            )}
          </button>

          {user && (
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión de Google"
              className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-all text-xs font-semibold flex items-center gap-1 px-2.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          )}
        </div>
      </header>

      {/* GOOGLE AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-purple-100 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center text-[#8B6FA8] mx-auto mb-3">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#634b79] mb-1">Acceso Lashista (Google Auth)</h3>
            <p className="text-xs text-gray-500 mb-6">
              El panel de fichas está reservado para cuentas de Google autorizadas.
            </p>
            
            <div className="space-y-4">
              {/* Google Sign In Button */}
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={handleGoogleLogin}
                className="w-full py-3 px-4 bg-white border-2 border-gray-200 hover:border-[#8B6FA8] hover:bg-purple-50/50 rounded-2xl text-xs font-bold text-gray-700 transition-all flex items-center justify-center gap-3 shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isLoggingIn ? 'Conectando con Google...' : 'Iniciar Sesión con Google'}</span>
              </button>

              {user && (
                <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100 text-left">
                  <p className="text-[11px] text-gray-500 font-medium">Cuenta actual conectada:</p>
                  <p className="text-xs font-bold text-[#634b79] truncate">{user.email}</p>
                </div>
              )}

              {authError && (
                <p className="text-xs text-red-500 font-medium bg-red-50 p-2.5 rounded-xl border border-red-100">{authError}</p>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="w-full py-2.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decorative side flowers */}
      <FloralDecoration className="fixed bottom-0 right-0 w-64 md:w-96 h-auto text-[#8B6FA8] opacity-60 pointer-events-none transform translate-x-10 translate-y-10 z-0" />

      {/* ADMIN PANEL TABLE VIEW */}
      {viewMode === 'admin' && !activeFichaId && (
        <div className="max-w-[1100px] w-full p-4 md:p-8 z-20">
          <div className="bg-white rounded-2xl shadow-xl border border-purple-100 p-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-[#634b79] flex items-center gap-2">
                  <FileText className="w-6 h-6 text-[#8B6FA8]" />
                  Panel de Fichas de Atencion (Lashista)
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Gestiona las fichas enviadas por tus clientas (Fase 1) y completa la evaluación técnica (Fase 2).
                </p>
              </div>

              <div className="flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => exportToExcel(fichas)}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Descargar Excel Maestro (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={startNewForm}
                  className="bg-[#8B6FA8] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#73598e] transition-all flex items-center gap-2 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  Nueva Ficha Clienta
                </button>
              </div>
            </div>

            {/* Table of Fichas */}
            {fichas.length === 0 ? (
              <div className="text-center py-12 bg-purple-50/50 rounded-xl border border-dashed border-purple-200">
                <Clock className="w-12 h-12 text-[#8B6FA8] opacity-50 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">No hay fichas registradas aún.</p>
                <p className="text-xs text-gray-500 mt-1 mb-4">Las clientas llenarán la Fase 1 desde el Modo Clienta.</p>
                <button
                  onClick={startNewForm}
                  className="bg-[#8B6FA8] text-white px-5 py-2 rounded-full text-xs font-medium"
                >
                  Abrir Formulario Clienta
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8FC] text-[#634b79] uppercase tracking-wider font-semibold border-b border-purple-100">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Clienta</th>
                      <th className="py-3 px-4">Teléfono</th>
                      <th className="py-3 px-4">Fecha Cita</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fichas.map((f) => (
                      <tr key={f.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#8B6FA8]">{f.id}</td>
                        <td className="py-3.5 px-4 font-medium text-gray-800">{f.nombreCompleto}</td>
                        <td className="py-3.5 px-4 text-gray-600">{f.telefono}</td>
                        <td className="py-3.5 px-4 text-gray-600">{f.fecha}</td>
                        <td className="py-3.5 px-4">
                          {f.estado === 'completada' ? (
                            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Completada (Fase 1 + 2)
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pendiente Profesional
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openFichaForPhase2(f)}
                              className="bg-[#8B6FA8] text-white px-3 py-1.5 rounded-lg text-[11px] font-medium hover:bg-[#725a8a] transition-all"
                            >
                              {f.estado === 'completada' ? 'Revisar / Editar' : '✏️ Completar Servicio'}
                            </button>

                            {f.pdfFase1Url && (
                              <a
                                href={f.pdfFase1Url}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-purple-100 text-[#634b79] px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-purple-200 transition-all"
                              >
                                PDF 1
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUCCESS SCREENS */}
      {successPhase === 'fase1' && (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 z-20">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border-t-8 border-[#8B6FA8]">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-serif text-[#634b79] font-bold mb-1">¡Consentimiento Registrado!</h2>
            <p className="text-xs text-gray-500 mb-4">Fase 1 completada por la clienta</p>
            
            <div className="bg-purple-50 p-4 rounded-2xl mb-6 border border-purple-100">
              <p className="text-xs text-gray-600 uppercase font-semibold tracking-wider">Código de Ficha:</p>
              <p className="text-3xl font-mono font-bold text-[#8B6FA8] my-1">{formData.id}</p>
              <p className="text-[11px] text-gray-500 mt-2">
                ✅ El comprobante en PDF de tu consentimiento se ha descargado automáticamente en tu dispositivo.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('✨ Cita Pestañas - ' + formData.nombreCompleto)}&details=${encodeURIComponent('Cita de Pestañas en Lashista Studio (Erika Johana Lozano). Código Ficha: ' + formData.id)}&dates=${(formData.fecha || '').replace(/-/g, '')}/${(formData.fecha || '').replace(/-/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-all font-medium text-sm shadow-md flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>📅 Agendar Cita en mi Google Calendar</span>
              </a>

              <button 
                onClick={startNewForm}
                className="w-full bg-[#8B6FA8] text-white py-3 rounded-xl hover:bg-[#725a8a] transition-all font-medium text-sm shadow-md"
              >
                Llenar otra ficha de clienta
              </button>
              <button 
                onClick={() => setViewMode('admin')}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 transition-all font-medium text-sm"
              >
                Ir al Panel de la Lashista
              </button>
            </div>
          </div>
        </div>
      )}

      {successPhase === 'fase2' && (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 z-20">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border-t-8 border-emerald-500">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-serif text-[#634b79] font-bold mb-1">¡Servicio Completado!</h2>
            <p className="text-xs text-gray-500 mb-4">Fase 2 finalizada y guardada exitosamente</p>
            
            <div className="bg-emerald-50 p-4 rounded-2xl mb-6 border border-emerald-100 text-left">
              <p className="text-xs font-semibold text-emerald-900">Clienta: {formData.nombreCompleto}</p>
              <p className="text-xs text-emerald-800">Ficha: {formData.id}</p>
              <p className="text-xs text-emerald-700 mt-2">
                ✅ El PDF completo con la valoración y el registro técnico se ha generado y descargado.
              </p>
            </div>

            <button 
              onClick={() => { setSuccessPhase(null); setViewMode('admin'); setActiveFichaId(null); }}
              className="w-full bg-[#634b79] text-white py-3 rounded-xl hover:bg-[#4d395e] transition-all font-medium text-sm shadow-md"
            >
              Volver al Panel de Fichas
            </button>
          </div>
        </div>
      )}

      {/* FORM CONTAINER (Shown when filling Phase 1 or Phase 2) */}
      {!successPhase && (viewMode === 'clienta' || activeFichaId) && (
        <div ref={formRef} className="bg-white max-w-[1100px] w-full shadow-2xl rounded-[2rem] overflow-hidden text-gray-800 relative z-10 mb-8 mx-4 md:mx-8">
          
          {/* Header Banner */}
          <div className="relative flex flex-col md:flex-row bg-[#FAF8FC] rounded-t-[2rem] overflow-hidden min-h-[350px] md:min-h-[450px]">
            <div className="absolute top-0 right-0 w-full md:w-1/2 h-full z-0">
              <img 
                src={eyelashImage} 
                alt="Lash Extension Procedure"
                className="w-full h-full object-cover object-center"
              />
            </div>

            <div className="relative z-10 w-full md:w-[60%] bg-white flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-br-[40%] md:rounded-r-[150px] shadow-[10px_0_20px_-10px_rgba(0,0,0,0.15)]">
              <div className="absolute top-0 left-0 w-64 h-64 pointer-events-none overflow-hidden rounded-tl-[2rem] z-0">
                 <FloralDecoration className="absolute -top-8 -left-12 w-full h-full text-[#8B6FA8] transform -rotate-12 scale-110 opacity-80" />
              </div>

              <h1 className="font-script text-[4rem] md:text-[6.5rem] text-[#634b79] leading-[1.1] mb-3 text-shadow-sm relative z-10">Ficha de Cliente</h1>
              
              <div className="flex items-center justify-center gap-2 mb-4 w-full relative z-10">
                <span className="text-[#4a4a4a] text-[10px] md:text-[14px]">✦</span>
                <h2 className="text-[10px] md:text-[14px] uppercase tracking-[0.2em] text-[#4a4a4a] font-bold">Extensiones & Realce de Pestañas</h2>
                <span className="text-[#4a4a4a] text-[10px] md:text-[14px]">✦</span>
              </div>
              
              <div className="flex items-center justify-center gap-2 mb-5 text-[#8B6FA8] opacity-90 relative z-10">
                <span className="text-[11px] md:text-[13px] uppercase tracking-[0.25em] font-semibold">Tu mirada, mi pasión</span>
                <span className="text-[12px]">♥</span>
              </div>

              <h3 className="font-script text-[3.5rem] md:text-[4.5rem] text-[#4a4a4a] mb-3 leading-none relative z-10">Erika Johana Lozano</h3>
              
              <div className="flex items-center justify-center w-full mt-2 relative z-10">
                 <div className="h-[1px] bg-[#d8cce4] w-8 md:w-16 absolute left-[10%] md:left-[20%]"></div>
                 <p className="text-[10px] md:text-[13px] uppercase tracking-[0.3em] text-[#8B6FA8] font-bold z-10 bg-white px-3">Lashista Profesional</p>
                 <div className="h-[1px] bg-[#d8cce4] w-8 md:w-16 absolute right-[10%] md:right-[20%]"></div>
              </div>

              <div className="mt-6 flex items-center justify-center text-[#4a4a4a] gap-3">
                 <svg width="45" height="20" viewBox="0 0 100 50" fill="currentColor"><path d="M10,40 C30,20 70,20 90,40 C80,30 50,25 10,40 Z M20,28 L15,15 M35,24 L30,5 M50,22 L50,0 M65,24 L70,5 M80,28 L85,15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
                 <span className="text-[10px] text-[#8B6FA8] mt-1">♥</span>
                 <svg width="45" height="20" viewBox="0 0 100 50" fill="currentColor"><path d="M10,40 C30,20 70,20 90,40 C80,30 50,25 10,40 Z M20,28 L15,15 M35,24 L30,5 M50,22 L50,0 M65,24 L70,5 M80,28 L85,15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" transform="scale(-1, 1) translate(-100, 0)" /></svg>
              </div>
            </div>
          </div>

          {/* Phase Banner Indicator */}
          <div className="bg-[#FAF8FC] px-8 py-3 border-b border-purple-100 flex justify-between items-center">
            <span className="text-xs font-mono font-semibold text-[#8B6FA8]">
              Ficha ID: {formData.id || 'NUEVA'}
            </span>
            {activeFichaId ? (
              <span className="bg-purple-600 text-white text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                Fase 2: Evaluación Técnica & Servicio (Lashista)
              </span>
            ) : (
              <span className="bg-[#8B6FA8] text-white text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                Fase 1: Datos & Consentimiento (Clienta)
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="mx-8 mt-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={activeFichaId ? handleSubmitPhase2 : handleSubmitPhase1} className="px-4 md:px-10 py-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-8">
              {/* 1. DATOS DE LA CLIENTA */}
              <div>
                <SectionTitle>1. Datos de la Clienta</SectionTitle>
                <div className="space-y-4 px-2">
                  <PaperInput label="Nombre completo:" name="nombreCompleto" value={formData.nombreCompleto} onChange={handleChange} disabled={!!activeFichaId} />
                  <PaperInput label="Teléfono / WhatsApp:" name="telefono" value={formData.telefono} onChange={handleChange} type="tel" disabled={!!activeFichaId} />
                  <PaperInput label="Edad:" name="edad" value={formData.edad} onChange={handleChange} type="number" disabled={!!activeFichaId} />
                  <PaperInput label="Fecha:" name="fecha" value={formData.fecha} onChange={handleChange} type="date" disabled={!!activeFichaId} />
                  
                  <div className="pt-2">
                    <p className="text-sm text-gray-700 mb-2">Servicio que desea:</p>
                    <div className="flex gap-6 flex-wrap">
                      <PaperCheckbox label="Extensiones de pestañas" name="servicioExtensiones" checked={formData.servicioExtensiones} onChange={handleChange} disabled={!!activeFichaId} />
                      <PaperCheckbox label="Realce / lifting de pestañas" name="servicioLifting" checked={formData.servicioLifting} onChange={handleChange} disabled={!!activeFichaId} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. VALORACIÓN DE LA PROFESIONAL */}
              <div className={!activeFichaId ? 'opacity-50 pointer-events-none' : ''}>
                <SectionTitle>3. Valoración de la Profesional <span className="text-sm font-normal opacity-80 normal-case">(Uso exclusivo)</span></SectionTitle>
                {!activeFichaId && (
                  <div className="bg-amber-50 border border-amber-100 p-2 text-center text-amber-800 text-xs font-medium mb-4 rounded-md">
                    🔒 Esta sección se diligencia en la Fase 2 por la profesional.
                  </div>
                )}
                <div className="space-y-4 px-2">
                  <div>
                    <p className="text-sm text-gray-700 mb-2">Estado de las pestañas naturales:</p>
                    <div className="flex gap-6">
                      <PaperRadio label="Bueno" name="estadoPestanas" value="Bueno" checked={formData.estadoPestanas === 'Bueno'} onChange={handleRadio} disabled={!activeFichaId} />
                      <PaperRadio label="Regular" name="estadoPestanas" value="Regular" checked={formData.estadoPestanas === 'Regular'} onChange={handleRadio} disabled={!activeFichaId} />
                      <PaperRadio label="Débil" name="estadoPestanas" value="Débil" checked={formData.estadoPestanas === 'Débil'} onChange={handleRadio} disabled={!activeFichaId} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 mb-2">Densidad:</p>
                    <div className="flex gap-6">
                      <PaperRadio label="Baja" name="densidad" value="Baja" checked={formData.densidad === 'Baja'} onChange={handleRadio} disabled={!activeFichaId} />
                      <PaperRadio label="Media" name="densidad" value="Media" checked={formData.densidad === 'Media'} onChange={handleRadio} disabled={!activeFichaId} />
                      <PaperRadio label="Alta" name="densidad" value="Alta" checked={formData.densidad === 'Alta'} onChange={handleRadio} disabled={!activeFichaId} />
                    </div>
                  </div>
                  <div className="pt-2 space-y-4">
                     <PaperInput label="Observaciones:" name="observacionesProfesional" value={formData.observacionesProfesional} onChange={handleChange} disabled={!activeFichaId} />
                     <PaperInput label="Procedimiento recomendado:" name="procedimientoRecomendado" value={formData.procedimientoRecomendado} onChange={handleChange} disabled={!activeFichaId} />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-8">
              {/* 2. ANTECEDENTES IMPORTANTES */}
              <div className="h-full bg-[#f9f8fc] -m-4 p-4 rounded-xl border border-purple-50/50 md:m-0 md:bg-transparent md:p-0 md:rounded-none md:border-none">
                <SectionTitle>2. Antecedentes Importantes</SectionTitle>
                <p className="text-xs text-gray-500 px-2 mb-4">Por favor marca Si o No según corresponda.</p>
                <div className="px-2">
                  <YesNoQuestion title="¿Tienes alguna alergia conocida?" name="alergia" formData={formData} handleChange={handleChange} handleRadio={handleRadio} hasCual={true} disabled={!!activeFichaId} />
                  <YesNoQuestion title="¿Has tenido alguna reacción a productos, adhesivos o procedimientos de pestañas?" name="reaccion" formData={formData} handleChange={handleChange} handleRadio={handleRadio} hasCual={true} disabled={!!activeFichaId} />
                  <YesNoQuestion title="¿Presentas actualmente irritación, enrojecimiento, picazón, inflamación o infección en los ojos?" name="irritacion" formData={formData} handleChange={handleChange} handleRadio={handleRadio} hasCual={true} disabled={!!activeFichaId} />
                  <YesNoQuestion title="¿Tienes alguna condición o enfermedad ocular?" name="condicion" formData={formData} handleChange={handleChange} handleRadio={handleRadio} hasCual={true} disabled={!!activeFichaId} />
                  <YesNoQuestion title="¿Utilizas lentes de contacto?" name="lentesContacto" formData={formData} handleChange={handleChange} handleRadio={handleRadio} disabled={!!activeFichaId} />
                  <YesNoQuestion title="¿Estás utilizando algún medicamento o tratamiento en los ojos?" name="medicamento" formData={formData} handleChange={handleChange} handleRadio={handleRadio} hasCual={true} disabled={!!activeFichaId} />
                  <YesNoQuestion title="¿Te has realizado recientemente un lifting, extensiones u otro procedimiento en las pestañas?" name="procedimientoReciente" formData={formData} handleChange={handleChange} handleRadio={handleRadio} disabled={!!activeFichaId} />
                  <YesNoQuestion title="¿Es la primera vez que realizas este servicio?" name="primeraVez" formData={formData} handleChange={handleChange} handleRadio={handleRadio} disabled={!!activeFichaId} />
                  <YesNoQuestion title="Si has realizado anteriormente el procedimiento, ¿tuviste alguna molestia o reacción?" name="molestiaAnterior" formData={formData} handleChange={handleChange} handleRadio={handleRadio} hasCual={true} disabled={!!activeFichaId} />
                  
                  <div className="mt-4">
                    <PaperInput label="Observaciones importantes de la clienta:" name="observacionesClienta" value={formData.observacionesClienta} onChange={handleChange} disabled={!!activeFichaId} />
                  </div>
                </div>
              </div>
            </div>

            {/* FULL WIDTH BOTTOM SECTIONS */}
            <div className="md:col-span-2 flex flex-col gap-8">
               
               {/* 4. CONSENTIMIENTO INFORMADO */}
               <div className="bg-[#FAF8FC] border border-[#E8DEF2] rounded-xl overflow-hidden shadow-sm relative">
                  <div className="absolute top-4 left-4 w-10 h-10 bg-[#8B6FA8] rounded-xl flex items-center justify-center rotate-3">
                     <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="ml-16 pt-5 pr-6 pb-2">
                     <SectionTitle>4. Consentimiento Informado</SectionTitle>
                  </div>
                  
                  <div className="px-6 pb-6 pt-2">
                     <div className="text-xs text-gray-700 leading-relaxed space-y-2 mb-5 relative z-10">
                        <p>Declaro que la información proporcionada en esta ficha es verdadera y completa. Informé a la profesional sobre cualquier alergia, sensibilidad, condición ocular, tratamiento o antecedente relevante.</p>
                        <p>Entiendo que las extensiones y el realce de pestañas son procedimientos estéticos que se realizan cerca de una zona delicada y que pueden presentarse molestias, sensibilidad, irritación o reacciones a determinados productos.</p>
                        <p>Comprendo que el resultado puede variar de acuerdo con las características y condiciones de mis pestañas naturales y me comprometo a seguir las recomendaciones de cuidado posterior proporcionadas por la profesional.</p>
                        
                        <div className="absolute -right-4 top-0 opacity-20 pointer-events-none hidden sm:block">
                           <Eye className="w-32 h-32 text-[#8B6FA8]" />
                        </div>
                     </div>
                     
                     <div className="bg-[#E8DEF2]/40 px-4 py-2 rounded-lg inline-block mb-6">
                        <PaperCheckbox label="Autorizo la realización del procedimiento seleccionado." name="autorizacion" checked={formData.autorizacion} onChange={handleChange} disabled={!!activeFichaId} />
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                           <div className="border border-dashed border-gray-300 bg-white h-20 mb-2 relative">
                              {formData.firmaClienta ? (
                                <img src={formData.firmaClienta} alt="Firma Clienta" className="w-full h-full object-contain p-2" />
                              ) : (
                                <>
                                  <SignatureCanvas ref={sigClientRef} canvasProps={{ className: 'w-full h-full cursor-crosshair' }} penColor="#8B6FA8" />
                                  <button type="button" onClick={() => sigClientRef.current?.clear()} className="absolute bottom-1 right-1 text-[10px] text-gray-400 hover:text-[#8B6FA8]">Borrar</button>
                                </>
                              )}
                           </div>
                           <PaperInput label="Firma de la clienta:" name="firmaClientaHidden" value="" onChange={() => {}} disabled={true} />
                        </div>
                        <div className="space-y-4 pt-4 md:pt-0 flex flex-col justify-end">
                           <PaperInput label="Nombre:" name="nombreFirmaClienta" value={formData.nombreFirmaClienta || formData.nombreCompleto} onChange={handleChange} disabled={!!activeFichaId} />
                           <PaperInput label="Documento:" name="documentoFirmaClienta" value={formData.documentoFirmaClienta} onChange={handleChange} disabled={!!activeFichaId} />
                           <PaperInput label="Fecha:" name="fechaFirmaClienta" value={formData.fechaFirmaClienta || formData.fecha} onChange={handleChange} type="date" disabled={!!activeFichaId} />
                        </div>
                     </div>
                  </div>
               </div>

               {/* 5. REGISTRO DEL SERVICIO */}
               <div className={`bg-[#F6F4F8] rounded-xl border border-gray-200 overflow-hidden relative ${!activeFichaId ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="absolute top-4 left-4 text-gray-400 opacity-50">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <div className="ml-12 pt-4 pr-6 pb-0">
                     <SectionTitle>5. Registro del Servicio - Uso exclusivo de la Profesional</SectionTitle>
                  </div>
                  
                  {!activeFichaId && (
                    <div className="mx-6 mb-4 bg-amber-50 border border-amber-100 p-2 text-center text-amber-800 text-xs font-medium rounded-md">
                       🔒 Esta sección debe ser diligenciada únicamente por la profesional en la Fase 2.
                    </div>
                  )}
                  
                  <div className="px-6 pb-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <PaperInput label="Técnica / diseño:" name="tecnicaDiseno" value={formData.tecnicaDiseno} onChange={handleChange} disabled={!activeFichaId} />
                        <PaperInput label="Curvatura:" name="curvatura" value={formData.curvatura} onChange={handleChange} disabled={!activeFichaId} />
                        <PaperInput label="Longitud:" name="longitud" value={formData.longitud} onChange={handleChange} disabled={!activeFichaId} />
                        <PaperInput label="Grosor:" name="grosor" value={formData.grosor} onChange={handleChange} disabled={!activeFichaId} />
                        <PaperInput label="Productos:" name="productos" value={formData.productos} onChange={handleChange} disabled={!activeFichaId} />
                     </div>
                     
                     <div className="mb-6">
                        <PaperInput label="Observaciones finales:" name="observacionesFinales" value={formData.observacionesFinales} onChange={handleChange} disabled={!activeFichaId} />
                     </div>

                     <div className="flex flex-col md:flex-row justify-between items-end gap-8 relative">
                        <div className="w-full md:w-1/2">
                           <div className="border border-dashed border-gray-300 bg-white h-20 mb-2 relative">
                              <SignatureCanvas ref={sigProfRef} canvasProps={{ className: 'w-full h-full cursor-crosshair' }} penColor="#8B6FA8" />
                              <button type="button" onClick={() => sigProfRef.current?.clear()} className="absolute bottom-1 right-1 text-[10px] text-gray-400 hover:text-[#8B6FA8]">Borrar</button>
                           </div>
                           <PaperInput label="Firma profesional:" name="firmaProfesionalHidden" value="" onChange={() => {}} disabled={true} />
                        </div>
                        
                        <div className="w-full md:w-auto md:pr-40 relative z-10">
                           <PaperInput label="Fecha:" name="fechaFirmaProfesional" value={formData.fechaFirmaProfesional} onChange={handleChange} type="date" width="w-32" disabled={!activeFichaId} />
                        </div>
                        
                        {/* EJL Custom Logo */}
                        <div className="absolute right-4 bottom-2 flex flex-col items-center hidden md:flex opacity-90 z-0 pointer-events-none">
                           <svg width="24" height="16" viewBox="0 0 32 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#d4af37] mb-1">
                              <path d="M4,18 L28,18 L25,10 L19,15 L16,5 L13,15 L7,10 Z" fill="currentColor" />
                              <circle cx="16" cy="3" r="2" fill="currentColor" />
                              <circle cx="4" cy="8" r="2" fill="currentColor" />
                              <circle cx="28" cy="8" r="2" fill="currentColor" />
                              <rect x="5" y="20" width="22" height="2" fill="currentColor" />
                           </svg>
                           <div className="font-script text-5xl text-[#5c4a75] leading-none mb-1">
                              EJL
                           </div>
                           <div className="flex flex-col items-center font-sans mt-1">
                              <span className="text-[10px] uppercase tracking-[0.35em] font-bold text-[#5c4a75] ml-1">Lashista</span>
                              <span className="text-[9px] text-[#5c4a75] mt-0.5">♥</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

            </div>

            <div className="md:col-span-2 pt-8 border-t border-gray-200 flex justify-between items-center">
               {activeFichaId && (
                 <button
                   type="button"
                   onClick={() => { setActiveFichaId(null); setViewMode('admin'); }}
                   className="bg-gray-100 text-gray-700 font-medium px-6 py-3 rounded-full hover:bg-gray-200 transition-all flex items-center gap-2"
                 >
                   <ArrowLeft className="w-4 h-4" /> Volver al Panel
                 </button>
               )}
               
               <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="ml-auto bg-[#8B6FA8] text-white font-medium text-lg px-10 py-3.5 rounded-full shadow-lg hover:bg-[#725a8a] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
               >
                  {isSubmitting ? (
                    'Procesando y generando PDF...'
                  ) : activeFichaId ? (
                    '✨ Completar Servicio y Generar PDF Final (Fase 2)'
                  ) : (
                    '📋 Guardar Consentimiento y Descargar PDF (Fase 1)'
                  )}
               </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
