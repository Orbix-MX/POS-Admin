/**
 * Spanish — the reference locale. Copy is taken verbatim from the Claude Design
 * prototype so the implementation reads identically to the approved design.
 */
export const es = {
  common: {
    continue: 'Continuar',
    back: 'Atrás',
    skip: 'Saltar',
    start: 'Comenzar',
    retry: 'Reintentar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    loading: 'Cargando…',
    show: 'Mostrar',
    hide: 'Ocultar',
    or: 'o continúa con',
    offline: 'Sin conexión a internet',
    genericError: 'Algo salió mal. Inténtalo de nuevo.',
  },

  splash: {
    tagline: 'Gestiona tu negocio, en cualquier lugar',
  },

  onboarding: {
    slide1: {
      title: 'Gestiona tu negocio desde cualquier lugar',
      description: 'Controla tu operación desde el celular, sin importar dónde estés.',
    },
    slide2: {
      title: 'Controla ventas, inventario y clientes',
      description: 'Todo lo que necesitas para operar tu negocio, en un solo lugar.',
    },
    slide3: {
      title: 'Todo sincronizado en tiempo real',
      description: 'Los cambios se reflejan al instante en todos tus dispositivos.',
    },
  },

  auth: {
    signUp: {
      title: 'Crea tu cuenta',
      subtitle: 'Regístrate para empezar a usar Orbix.',
      submit: 'Crear cuenta',
      haveAccount: '¿Ya tienes cuenta?',
      signIn: 'Iniciar sesión',
    },
    signIn: {
      title: 'Bienvenido de vuelta',
      subtitle: 'Inicia sesión para continuar.',
      submit: 'Iniciar sesión',
      noAccount: '¿No tienes cuenta?',
      signUp: 'Crear cuenta',
      forgotPassword: '¿Olvidaste tu contraseña?',
    },
    google: {
      button: 'Continuar con Google',
      unavailable: 'El inicio de sesión con Google aún no está disponible.',
      notConfigured: 'Falta configurar las credenciales de Google.',
    },
    fields: {
      name: 'Nombre',
      namePlaceholder: 'Tu nombre completo',
      email: 'Correo',
      emailPlaceholder: 'tu@correo.com',
      password: 'Contraseña',
      passwordPlaceholder: 'Mínimo 6 caracteres',
    },
    errors: {
      invalidCredentials: 'Correo o contraseña incorrectos.',
      emailTaken: 'Ya existe una cuenta con este correo.',
      tooManyAttempts: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
    },
  },

  validation: {
    nameRequired: 'Escribe tu nombre.',
    nameTooShort: 'El nombre debe tener al menos 2 caracteres.',
    emailRequired: 'Escribe tu correo.',
    emailInvalid: 'Escribe un correo válido.',
    passwordRequired: 'Escribe tu contraseña.',
    passwordTooShort: 'La contraseña debe tener al menos 6 caracteres.',
    companyNameRequired: 'Escribe el nombre de la empresa.',
    ownerNameRequired: 'Escribe el nombre del propietario.',
    phoneRequired: 'Escribe tu teléfono.',
    phoneInvalid: 'El teléfono debe tener 10 dígitos.',
    businessTypeRequired: 'Elige un tipo de negocio.',
    otpIncomplete: 'Escribe los 6 dígitos.',
  },

  wizard: {
    stepLabel: 'Paso {{current}} de {{total}}',
    step1: {
      title: 'Información básica',
      subtitle: 'Cuéntanos sobre tu negocio.',
      companyName: 'Nombre de la empresa',
      companyNamePlaceholder: 'Ej. Panadería Luna',
      ownerName: 'Nombre del propietario',
      ownerNamePlaceholder: 'Tu nombre',
      phone: 'Teléfono',
      phonePlaceholder: '10 dígitos',
      country: 'País',
      currency: 'Moneda',
    },
    step2: {
      title: 'Tipo de negocio',
      subtitle: 'Elige la opción que mejor te describe.',
    },
    step3: {
      title: 'Verifica tu teléfono',
      subtitle: 'Enviamos un código de 6 dígitos a tu número terminando en ••{{last2}}.',
      resend: 'Reenviar código',
      resendIn: 'Reenviar código en {{seconds}}s',
      verifying: 'Verificando…',
      verified: '¡Verificado!',
      invalidCode: 'El código no es válido. Inténtalo de nuevo.',
    },
    success: {
      title: '¡Tu empresa está lista!',
      subtitle:
        'Ya puedes empezar a vender, controlar tu inventario y gestionar clientes desde Orbix.',
      enter: 'Entrar al sistema',
      entering: 'Entrando…',
    },
    draftRestored: 'Recuperamos el progreso que habías dejado.',
  },

  home: {
    welcome: 'Bienvenido, {{name}}',
    kpiSales: 'Ventas de hoy',
    kpiCustomers: 'Clientes',
    kpiProducts: 'Productos en inventario',
    firstSteps: 'Primeros pasos',
    addProducts: 'Agrega tus primeros productos',
    inviteTeam: 'Invita a tu equipo',
    setupPos: 'Configura tu primer punto de venta',
    goToDashboard: 'Ir al dashboard completo',
  },

  tenant: {
    selectTitle: 'Elige tu empresa',
    selectSubtitle: 'Tu cuenta pertenece a más de una empresa.',
    createNew: 'Crear una empresa nueva',
    switching: 'Cambiando de empresa…',
  },

  businessTypes: {
    tienda: 'Comercio / Tienda',
    restaurante: 'Restaurante',
    cafeteria: 'Cafetería',
    belleza: 'Belleza',
    salud: 'Salud',
    gimnasio: 'Gimnasio',
    servicios: 'Servicios',
    distribuidora: 'Distribuidora',
    educacion: 'Educación',
    otro: 'Otro',
  },

  countries: {
    MX: 'México',
    CO: 'Colombia',
    AR: 'Argentina',
    CL: 'Chile',
    PE: 'Perú',
    US: 'Estados Unidos',
  },

  errors: {
    notImplemented: 'Esta función todavía no está disponible en el servidor.',
    network: 'No pudimos conectar con Orbix. Revisa tu conexión.',
    timeout: 'La solicitud tardó demasiado. Inténtalo de nuevo.',
    server: 'Orbix tuvo un problema. Inténtalo en unos minutos.',
    forbidden: 'No tienes permisos para hacer esto.',
  },

  a11y: {
    back: 'Volver',
    togglePassword: 'Mostrar u ocultar la contraseña',
    otpDigit: 'Dígito {{index}} de {{total}}',
    selectBusinessType: 'Seleccionar {{label}}',
    progress: 'Paso {{current}} de {{total}}',
  },
};

/**
 * Not `as const`: the literal types would make every other locale a type error
 * ("Continue" is not assignable to "Continuar"). What must match across locales
 * is the key structure, not the copy.
 */
export type TranslationSchema = typeof es;
