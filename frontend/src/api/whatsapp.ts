import { httpClient } from "./httpClient";

export const whatsappApi = {
  contactOwner: (propertyId: string) =>
    httpClient.post<{ message: string }>("/whatsapp/contact-owner", { propertyId }),

  sendInquiry: (propertyId: string, message: string) =>
    httpClient.post<{ message: string }>("/whatsapp/inquiry", { propertyId, message }),

  shareProperty: (propertyId: string, toPhone: string) =>
    httpClient.post<{ message: string }>("/whatsapp/share", { propertyId, toPhone }, false),
};
