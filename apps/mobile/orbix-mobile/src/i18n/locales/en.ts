import type { TranslationSchema } from './es';

/** English — typed against the Spanish schema, so a missing key fails `tsc`. */
export const en: TranslationSchema = {
  common: {
    continue: 'Continue',
    back: 'Back',
    skip: 'Skip',
    start: 'Get started',
    retry: 'Try again',
    cancel: 'Cancel',
    close: 'Close',
    loading: 'Loading…',
    show: 'Show',
    hide: 'Hide',
    or: 'or continue with',
    offline: 'No internet connection',
    genericError: 'Something went wrong. Please try again.',
  },

  splash: {
    tagline: 'Run your business, anywhere',
  },

  onboarding: {
    slide1: {
      title: 'Run your business from anywhere',
      description: 'Manage your operation from your phone, wherever you are.',
    },
    slide2: {
      title: 'Track sales, inventory and customers',
      description: 'Everything you need to run your business, in one place.',
    },
    slide3: {
      title: 'Everything synced in real time',
      description: 'Changes show up instantly across all your devices.',
    },
  },

  auth: {
    signUp: {
      title: 'Create your account',
      subtitle: 'Sign up to start using Orbix.',
      submit: 'Create account',
      haveAccount: 'Already have an account?',
      signIn: 'Sign in',
    },
    signIn: {
      title: 'Welcome back',
      subtitle: 'Sign in to continue.',
      submit: 'Sign in',
      noAccount: "Don't have an account?",
      signUp: 'Create account',
      forgotPassword: 'Forgot your password?',
    },
    google: {
      button: 'Continue with Google',
      unavailable: 'Google sign-in is not available yet.',
      notConfigured: 'Google credentials are not configured.',
    },
    fields: {
      name: 'Name',
      namePlaceholder: 'Your full name',
      email: 'Email',
      emailPlaceholder: 'you@email.com',
      password: 'Password',
      passwordPlaceholder: 'At least 6 characters',
    },
    errors: {
      invalidCredentials: 'Incorrect email or password.',
      emailTaken: 'An account with this email already exists.',
      tooManyAttempts: 'Too many attempts. Wait a minute and try again.',
    },
  },

  validation: {
    nameRequired: 'Enter your name.',
    nameTooShort: 'Name must be at least 2 characters.',
    emailRequired: 'Enter your email.',
    emailInvalid: 'Enter a valid email.',
    passwordRequired: 'Enter your password.',
    passwordTooShort: 'Password must be at least 6 characters.',
    companyNameRequired: 'Enter the company name.',
    ownerNameRequired: "Enter the owner's name.",
    phoneRequired: 'Enter your phone number.',
    phoneInvalid: 'Phone number must have 10 digits.',
    businessTypeRequired: 'Pick a business type.',
    otpIncomplete: 'Enter all 6 digits.',
  },

  wizard: {
    stepLabel: 'Step {{current}} of {{total}}',
    step1: {
      title: 'Basic information',
      subtitle: 'Tell us about your business.',
      companyName: 'Company name',
      companyNamePlaceholder: 'e.g. Luna Bakery',
      ownerName: 'Owner name',
      ownerNamePlaceholder: 'Your name',
      phone: 'Phone',
      phonePlaceholder: '10 digits',
      country: 'Country',
      currency: 'Currency',
    },
    step2: {
      title: 'Business type',
      subtitle: 'Pick the option that describes you best.',
    },
    step3: {
      title: 'Verify your phone',
      subtitle: 'We sent a 6-digit code to your number ending in ••{{last2}}.',
      resend: 'Resend code',
      resendIn: 'Resend code in {{seconds}}s',
      verifying: 'Verifying…',
      verified: 'Verified!',
      invalidCode: 'That code is not valid. Try again.',
    },
    success: {
      title: 'Your company is ready!',
      subtitle: 'You can now sell, track inventory and manage customers from Orbix.',
      enter: 'Enter the app',
      entering: 'Entering…',
    },
    draftRestored: 'We restored the progress you had left.',
  },

  home: {
    welcome: 'Welcome, {{name}}',
    kpiSales: "Today's sales",
    kpiCustomers: 'Customers',
    kpiProducts: 'Products in inventory',
    firstSteps: 'First steps',
    addProducts: 'Add your first products',
    inviteTeam: 'Invite your team',
    setupPos: 'Set up your first point of sale',
    goToDashboard: 'Go to the full dashboard',
  },

  tenant: {
    selectTitle: 'Choose your company',
    selectSubtitle: 'Your account belongs to more than one company.',
    createNew: 'Create a new company',
    switching: 'Switching company…',
  },

  businessTypes: {
    tienda: 'Retail / Store',
    restaurante: 'Restaurant',
    cafeteria: 'Coffee shop',
    belleza: 'Beauty',
    salud: 'Health',
    gimnasio: 'Gym',
    servicios: 'Services',
    distribuidora: 'Distribution',
    educacion: 'Education',
    otro: 'Other',
  },

  countries: {
    MX: 'Mexico',
    CO: 'Colombia',
    AR: 'Argentina',
    CL: 'Chile',
    PE: 'Peru',
    US: 'United States',
  },

  errors: {
    notImplemented: 'This feature is not available on the server yet.',
    network: 'We could not reach Orbix. Check your connection.',
    timeout: 'The request took too long. Try again.',
    server: 'Orbix ran into a problem. Try again in a few minutes.',
    forbidden: 'You do not have permission to do this.',
  },

  a11y: {
    back: 'Go back',
    togglePassword: 'Show or hide the password',
    otpDigit: 'Digit {{index}} of {{total}}',
    selectBusinessType: 'Select {{label}}',
    progress: 'Step {{current}} of {{total}}',
  },
};
