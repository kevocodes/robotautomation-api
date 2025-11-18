export class ResourcesDeiResponse {
  resources: Resource[];
}

interface Resource {
  links: Link[];
  message: null;
  resourceId: string;
  name: string;
  location: string;
  contact: null | string;
  notes: null | string;
  minLength: string;
  maxLength: string;
  requiresApproval: number;
  allowMultiday: string;
  maxParticipants: null | string;
  minNoticeAdd: string;
  minNoticeUpdate: string;
  minNoticeDelete: string;
  maxNotice: string;
  description: null | string;
  scheduleId: string;
  icsUrl: null;
  statusId: string;
  statusReasonId: null;
  customAttributes: any[];
  typeId: null | string;
  groupIds: string[];
  bufferTime: string;
  autoReleaseMinutes: null;
  requiresCheckIn: number;
  color: string;
  creditsPerSlot: string;
  peakCreditsPerSlot: string;
  maxConcurrentReservations: number;
}

interface Link {
  href: string;
  title: string;
}
