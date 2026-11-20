export interface SmsMessage {
  toE164: string;
  body: string;
  locale: 'bn' | 'en';
}

export interface SmsSendResult {
  provider: string;
  messageId: string;
  accepted: boolean;
}

export interface SmsPort {
  send(message: SmsMessage): Promise<SmsSendResult>;
}

export const SMS_PORT = Symbol('SMS_PORT');
