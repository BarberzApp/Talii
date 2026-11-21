// Navigation types. Data shapes come from @barber-app/shared (API contracts
// and generated database rows); the old hand-written row types were removed
// because they no longer matched the schema.
import type { PublicService } from '@barber-app/shared';

export type RootStackParamList = {
  MainTabs: {
    screen?: string;
    params?: any;
  };
  Home: undefined;
  Login: undefined;
  SignUp: undefined;
  Browse: undefined;
  Settings: undefined;
  ForgotPassword: undefined;
  BarberOnboarding: undefined;
  BarberDashboard: undefined;
  BookingSuccess: undefined;
  BookingPage: {
    barberId: string;
    barberName: string;
  };
  BookingCalendar: {
    barberId: string;
    barberName: string;
    preSelectedService?: PublicService;
    guestMode?: boolean;
  };
  EmailConfirmation: {
    email: string;
    userType: 'client' | 'barber';
  };
  Terms: undefined;
  PrivacyPolicy: undefined;
  BookingWebView: {
    barberId: string;
    barberName: string;
  };
  ProfilePortfolio: {
    barberId?: string;
  };
  ProfilePreview: {
    /** barbers.id */
    barberId: string;
  };
};
