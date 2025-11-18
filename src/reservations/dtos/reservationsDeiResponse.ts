import { ReservationCleaningEvent } from './reservationCleaningEvent';

export interface ReservationDeiResponse {
  links: any[];
  message: null;
  reservations: Reservation[];
  startDateTime: string;
  endDateTime: string;
  cleaningEvents?: ReservationCleaningEvent[];
}

export interface ReservationDeiResponseWithCleaningEvents
  extends ReservationDeiResponse {
  cleaningEvents: ReservationCleaningEvent[];
}

export interface Reservation {
  links: Link[];
  message: null;
  referenceNumber: string;
  startDate: string;
  endDate: string;
  firstName: string;
  lastName: string;
  resourceName: string;
  title: string;
  description: string;
  requiresApproval: boolean;
  isRecurring: boolean;
  scheduleId: string;
  userId: string;
  resourceId: string;
  duration: string;
  bufferTime: string;
  bufferedStartDate: string;
  bufferedEndDate: string;
  participants: any[];
  invitees: any[];
  participatingGuests: any[];
  invitedGuests: any[];
  startReminder: null;
  endReminder: null;
  color: string;
  textColor: string;
  checkInDate: string;
  checkOutDate: string;
  originalEndDate: string;
  isCheckInEnabled: boolean;
  autoReleaseMinutes: null;
  resourceStatusId: string;
  creditsConsumed: null;
}

interface Link {
  href: string;
  title: string;
}
