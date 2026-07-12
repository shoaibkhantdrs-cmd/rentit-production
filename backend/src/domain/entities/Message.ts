export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type NewMessage = Pick<Message, "conversationId" | "senderId"> & {
  body?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
};
